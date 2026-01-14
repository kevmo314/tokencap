/**
 * Tokencap Proxy Server
 * LLM proxy with pre-execution cost prediction and budget enforcement
 * MIT License
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import type {
  ProxyConfig,
  SetBudgetRequest,
  CreateAlertRequest,
  UpdateAlertRequest,
  RegisterRequest,
  LoginRequest,
  CreateApiKeyRequest,
  AuthContext,
} from './types.js';
import {
  initDatabase,
  closeDatabase,
  getUsageSummary,
  getRecentUsage,
  setBudget,
  resetBudgetSpent,
  deleteBudget,
  getUserById,
  createAlert,
  getAlertsByUserId,
  getAlertById,
  updateAlert,
  deleteAlert,
  getAlertHistoryByUserId,
  getApiKeysByUserId,
  createApiKey,
  revokeApiKey,
  getProjectsByUserId,
} from './db.js';
import { proxyOpenAI, proxyAnthropic, getProjectId } from './proxy.js';
import { cleanupEncoders } from './tokenizer.js';
import { getRemainingBudget, getBudgetUtilization } from './budget.js';
import { getDefaultThreshold, isValidAlertType } from './alerts.js';
import {
  registerUser,
  loginUser,
  logoutUser,
  apiKeyAuth,
  sessionAuth,
  flexAuth,
  checkPlanLimits,
  getAuthContext,
  maskApiKey,
} from './auth.js';

// ============================================================================
// Configuration
// ============================================================================

const config: ProxyConfig = {
  port: parseInt(process.env.PORT || '3456', 10),
  host: process.env.HOST || '0.0.0.0',
  dbPath: process.env.DB_PATH || './tokencap.db',
  openaiApiKey: process.env.OPENAI_API_KEY,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  defaultMaxTokens: parseInt(process.env.DEFAULT_MAX_TOKENS || '4096', 10),
  defaultProjectId: process.env.DEFAULT_PROJECT_ID || 'default',
  resendApiKey: process.env.RESEND_API_KEY,
};

// ============================================================================
// Initialize
// ============================================================================

// Initialize database
initDatabase(config.dbPath);

// Create Hono app
const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger());

// ============================================================================
// Health Check
// ============================================================================

app.get('/', (c) => {
  return c.json({
    name: 'Tokencap Proxy',
    version: '0.1.0',
    status: 'healthy',
    endpoints: {
      openai: 'POST /v1/chat/completions',
      anthropic: 'POST /v1/messages',
      usage: 'GET /v1/usage',
      budget: 'POST /v1/budget',
    },
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// ============================================================================
// Authentication Endpoints (Public)
// ============================================================================

/**
 * Register a new user account
 */
app.post('/v1/auth/register', async (c) => {
  let body: RegisterRequest;
  try {
    body = await c.req.json<RegisterRequest>();
  } catch {
    return c.json(
      {
        error: {
          type: 'invalid_request',
          message: 'Invalid JSON in request body',
        },
      },
      400
    );
  }

  if (!body.email || !body.password) {
    return c.json(
      {
        error: {
          type: 'invalid_request',
          message: 'Required fields: email, password',
        },
      },
      400
    );
  }

  const result = await registerUser(body.email, body.password);

  if (!result.success) {
    return c.json(
      {
        error: {
          type: 'invalid_request',
          message: result.error,
        },
      },
      400
    );
  }

  return c.json(
    {
      success: true,
      user: {
        id: result.user!.id,
        email: result.user!.email,
        plan: result.user!.plan,
      },
    },
    201
  );
});

/**
 * Login and get session token
 */
app.post('/v1/auth/login', async (c) => {
  let body: LoginRequest;
  try {
    body = await c.req.json<LoginRequest>();
  } catch {
    return c.json(
      {
        error: {
          type: 'invalid_request',
          message: 'Invalid JSON in request body',
        },
      },
      400
    );
  }

  if (!body.email || !body.password) {
    return c.json(
      {
        error: {
          type: 'invalid_request',
          message: 'Required fields: email, password',
        },
      },
      400
    );
  }

  const result = await loginUser(body.email, body.password);

  if (!result.success) {
    return c.json(
      {
        error: {
          type: 'unauthorized',
          message: result.error,
        },
      },
      401
    );
  }

  return c.json({
    success: true,
    user: {
      id: result.user!.id,
      email: result.user!.email,
      plan: result.user!.plan,
    },
    token: result.session!.token,
    expiresAt: result.session!.expiresAt.toISOString(),
  });
});

/**
 * Logout (requires session token)
 */
app.post('/v1/auth/logout', sessionAuth, async (c) => {
  const auth = getAuthContext(c);
  if (auth?.session) {
    logoutUser(auth.session.token);
  }
  return c.json({ success: true, message: 'Logged out successfully' });
});

// ============================================================================
// API Key Management Endpoints (Requires Session Auth)
// ============================================================================

/**
 * Create a new API key
 */
app.post('/v1/auth/api-keys', sessionAuth, async (c) => {
  const auth = getAuthContext(c)!;

  let body: CreateApiKeyRequest = {};
  try {
    body = await c.req.json<CreateApiKeyRequest>();
  } catch {
    // Body is optional, use defaults
  }

  const apiKey = createApiKey(auth.user.id, body.name || 'Default');

  return c.json(
    {
      success: true,
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        key: apiKey.key, // Full key only shown once on creation
        keyPrefix: maskApiKey(apiKey.key),
        createdAt: apiKey.createdAt.toISOString(),
      },
    },
    201
  );
});

/**
 * List all API keys for the user
 */
app.get('/v1/auth/api-keys', sessionAuth, (c) => {
  const auth = getAuthContext(c)!;

  const apiKeys = getApiKeysByUserId(auth.user.id);

  return c.json({
    apiKeys: apiKeys.map((key) => ({
      id: key.id,
      name: key.name,
      keyPrefix: maskApiKey(key.key),
      lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
      createdAt: key.createdAt.toISOString(),
    })),
  });
});

/**
 * Revoke an API key
 */
app.delete('/v1/auth/api-keys/:id', sessionAuth, (c) => {
  const auth = getAuthContext(c)!;
  const keyId = c.req.param('id');

  const revoked = revokeApiKey(keyId, auth.user.id);

  if (!revoked) {
    return c.json(
      {
        error: {
          type: 'not_found',
          message: 'API key not found or already revoked',
        },
      },
      404
    );
  }

  return c.json({ success: true, message: 'API key revoked successfully' });
});

/**
 * Get current user info (requires any auth)
 */
app.get('/v1/auth/me', flexAuth, (c) => {
  const auth = getAuthContext(c)!;

  const projects = getProjectsByUserId(auth.user.id);

  return c.json({
    user: {
      id: auth.user.id,
      email: auth.user.email,
      plan: auth.user.plan,
      createdAt: auth.user.createdAt.toISOString(),
    },
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      createdAt: p.createdAt.toISOString(),
    })),
  });
});

// ============================================================================
// Proxy Endpoints (Requires API Key Auth)
// ============================================================================

/**
 * OpenAI Chat Completions Proxy
 * Compatible with OpenAI SDK - just change the base URL
 * Requires API key authentication
 */
app.post('/v1/chat/completions', apiKeyAuth, checkPlanLimits, async (c) => {
  return proxyOpenAI(c, config);
});

/**
 * Anthropic Messages Proxy
 * Compatible with Anthropic SDK - just change the base URL
 * Requires API key authentication
 */
app.post('/v1/messages', apiKeyAuth, checkPlanLimits, async (c) => {
  return proxyAnthropic(c, config);
});

// ============================================================================
// Usage Endpoints (Requires API Key Auth)
// ============================================================================

/**
 * Get usage summary for a project
 */
app.get('/v1/usage', apiKeyAuth, (c) => {
  const projectId = getProjectId(c, config);

  const summary = getUsageSummary(projectId);
  const utilization = getBudgetUtilization(projectId);

  return c.json({
    usage: {
      ...summary,
      budgetUtilizationPercent: utilization,
    },
  });
});

/**
 * Get recent usage records
 */
app.get('/v1/usage/history', apiKeyAuth, (c) => {
  const projectId = getProjectId(c, config);
  const limit = parseInt(c.req.query('limit') || '100', 10);

  const records = getRecentUsage(projectId, limit);

  return c.json({ records });
});

// ============================================================================
// Budget Endpoints (Requires API Key Auth)
// ============================================================================

/**
 * Set budget for a project
 */
app.post('/v1/budget', apiKeyAuth, async (c) => {
  let body: SetBudgetRequest;
  try {
    body = await c.req.json<SetBudgetRequest>();
  } catch {
    return c.json(
      {
        error: {
          type: 'invalid_request',
          message: 'Invalid JSON in request body',
        },
      },
      400
    );
  }

  if (!body.projectId || typeof body.limitUsd !== 'number' || body.limitUsd < 0) {
    return c.json(
      {
        error: {
          type: 'invalid_request',
          message: 'Invalid request. Required: projectId (string), limitUsd (number >= 0)',
        },
      },
      400
    );
  }

  const budget = setBudget(body.projectId, body.limitUsd, body.periodDays);

  return c.json({
    success: true,
    budget: {
      projectId: budget.projectId,
      limitUsd: budget.limitUsd,
      spentUsd: budget.spentUsd,
      remainingUsd: budget.limitUsd - budget.spentUsd,
      periodStart: budget.periodStart.toISOString(),
      periodEnd: budget.periodEnd?.toISOString() ?? null,
    },
  });
});

/**
 * Get budget for a project
 */
app.get('/v1/budget', apiKeyAuth, (c) => {
  const projectId = getProjectId(c, config);
  const remaining = getRemainingBudget(projectId);

  if (remaining === null) {
    return c.json({
      budget: null,
      message: 'No budget set for this project',
    });
  }

  const summary = getUsageSummary(projectId);

  return c.json({
    budget: {
      projectId,
      limitUsd: summary.budgetLimitUsd,
      spentUsd: summary.totalCostUsd,
      remainingUsd: summary.budgetRemainingUsd,
    },
  });
});

/**
 * Reset budget spent amount
 */
app.post('/v1/budget/reset', apiKeyAuth, async (c) => {
  const projectId = getProjectId(c, config);

  resetBudgetSpent(projectId);

  return c.json({
    success: true,
    message: `Budget reset for project: ${projectId}`,
  });
});

/**
 * Delete budget
 */
app.delete('/v1/budget', apiKeyAuth, (c) => {
  const projectId = getProjectId(c, config);

  const deleted = deleteBudget(projectId);

  if (!deleted) {
    return c.json(
      {
        success: false,
        message: 'No budget found for this project',
      },
      404
    );
  }

  return c.json({
    success: true,
    message: `Budget deleted for project: ${projectId}`,
  });
});

// ============================================================================
// Alert Endpoints (PRO tier feature)
// ============================================================================

/**
 * Helper to get user ID from request headers or auth context
 * For backward compatibility, supports X-Tokencap-User-Id header
 * For new auth, uses the auth context
 */
function getUserIdFromRequest(c: { req: { header: (name: string) => string | undefined }, get: (key: string) => unknown }): string | null {
  // Try auth context first (new auth system)
  const auth = c.get('auth') as AuthContext | undefined;
  if (auth?.user) {
    return auth.user.id;
  }

  // Fallback to legacy header for backward compatibility
  const userId = c.req.header('X-Tokencap-User-Id');
  return userId || null;
}

/**
 * Create a new alert (PRO tier only)
 */
app.post('/v1/alerts', async (c) => {
  const userId = getUserIdFromRequest(c);

  if (!userId) {
    return c.json(
      {
        error: {
          type: 'unauthorized',
          message: 'Authentication required. Pass X-Tokencap-User-Id header.',
        },
      },
      401
    );
  }

  // Check if user exists and has PRO plan
  const user = getUserById(userId);
  if (!user) {
    return c.json(
      {
        error: {
          type: 'not_found',
          message: 'User not found',
        },
      },
      404
    );
  }

  if (user.plan === 'free') {
    return c.json(
      {
        error: {
          type: 'forbidden',
          message: 'Alerts are a PRO tier feature. Please upgrade your plan.',
        },
      },
      403
    );
  }

  // Parse request body
  let body: CreateAlertRequest;
  try {
    body = await c.req.json<CreateAlertRequest>();
  } catch {
    return c.json(
      {
        error: {
          type: 'invalid_request',
          message: 'Invalid JSON in request body',
        },
      },
      400
    );
  }

  // Validate required fields
  if (!body.projectId || !body.type) {
    return c.json(
      {
        error: {
          type: 'invalid_request',
          message: 'Required fields: projectId, type',
        },
      },
      400
    );
  }

  // Validate alert type
  if (!isValidAlertType(body.type)) {
    return c.json(
      {
        error: {
          type: 'invalid_request',
          message: 'Invalid alert type. Must be one of: budget_warning, budget_exceeded, daily_spend_spike',
        },
      },
      400
    );
  }

  // Must have at least one delivery method
  if (!body.webhookUrl && !body.email) {
    return c.json(
      {
        error: {
          type: 'invalid_request',
          message: 'At least one delivery method required: webhookUrl or email',
        },
      },
      400
    );
  }

  // Use default threshold if not provided
  const threshold = body.threshold ?? getDefaultThreshold(body.type);

  // Create the alert
  const alert = createAlert(
    userId,
    body.projectId,
    body.type,
    threshold,
    body.webhookUrl ?? null,
    body.email ?? null
  );

  return c.json({
    success: true,
    alert: {
      id: alert.id,
      projectId: alert.projectId,
      type: alert.type,
      threshold: alert.threshold,
      enabled: alert.enabled,
      webhookUrl: alert.webhookUrl,
      email: alert.email,
      createdAt: alert.createdAt.toISOString(),
    },
  }, 201);
});

/**
 * List all alerts for the authenticated user
 */
app.get('/v1/alerts', (c) => {
  const userId = getUserIdFromRequest(c);

  if (!userId) {
    return c.json(
      {
        error: {
          type: 'unauthorized',
          message: 'Authentication required. Pass X-Tokencap-User-Id header.',
        },
      },
      401
    );
  }

  const user = getUserById(userId);
  if (!user) {
    return c.json(
      {
        error: {
          type: 'not_found',
          message: 'User not found',
        },
      },
      404
    );
  }

  if (user.plan === 'free') {
    return c.json(
      {
        error: {
          type: 'forbidden',
          message: 'Alerts are a PRO tier feature. Please upgrade your plan.',
        },
      },
      403
    );
  }

  const alerts = getAlertsByUserId(userId);

  return c.json({
    alerts: alerts.map(alert => ({
      id: alert.id,
      projectId: alert.projectId,
      type: alert.type,
      threshold: alert.threshold,
      enabled: alert.enabled,
      webhookUrl: alert.webhookUrl,
      email: alert.email,
      lastTriggeredAt: alert.lastTriggeredAt?.toISOString() ?? null,
      createdAt: alert.createdAt.toISOString(),
      updatedAt: alert.updatedAt.toISOString(),
    })),
  });
});

/**
 * Update an alert
 */
app.put('/v1/alerts/:id', async (c) => {
  const userId = getUserIdFromRequest(c);
  const alertId = c.req.param('id');

  if (!userId) {
    return c.json(
      {
        error: {
          type: 'unauthorized',
          message: 'Authentication required. Pass X-Tokencap-User-Id header.',
        },
      },
      401
    );
  }

  const user = getUserById(userId);
  if (!user) {
    return c.json(
      {
        error: {
          type: 'not_found',
          message: 'User not found',
        },
      },
      404
    );
  }

  if (user.plan === 'free') {
    return c.json(
      {
        error: {
          type: 'forbidden',
          message: 'Alerts are a PRO tier feature. Please upgrade your plan.',
        },
      },
      403
    );
  }

  // Get existing alert and verify ownership
  const existingAlert = getAlertById(alertId);
  if (!existingAlert) {
    return c.json(
      {
        error: {
          type: 'not_found',
          message: 'Alert not found',
        },
      },
      404
    );
  }

  if (existingAlert.userId !== userId) {
    return c.json(
      {
        error: {
          type: 'forbidden',
          message: 'You do not own this alert',
        },
      },
      403
    );
  }

  // Parse request body
  let body: UpdateAlertRequest;
  try {
    body = await c.req.json<UpdateAlertRequest>();
  } catch {
    return c.json(
      {
        error: {
          type: 'invalid_request',
          message: 'Invalid JSON in request body',
        },
      },
      400
    );
  }

  // Validate alert type if provided
  if (body.type && !isValidAlertType(body.type)) {
    return c.json(
      {
        error: {
          type: 'invalid_request',
          message: 'Invalid alert type. Must be one of: budget_warning, budget_exceeded, daily_spend_spike',
        },
      },
      400
    );
  }

  // Update the alert
  const updatedAlert = updateAlert(alertId, body);

  if (!updatedAlert) {
    return c.json(
      {
        error: {
          type: 'internal_error',
          message: 'Failed to update alert',
        },
      },
      500
    );
  }

  return c.json({
    success: true,
    alert: {
      id: updatedAlert.id,
      projectId: updatedAlert.projectId,
      type: updatedAlert.type,
      threshold: updatedAlert.threshold,
      enabled: updatedAlert.enabled,
      webhookUrl: updatedAlert.webhookUrl,
      email: updatedAlert.email,
      lastTriggeredAt: updatedAlert.lastTriggeredAt?.toISOString() ?? null,
      createdAt: updatedAlert.createdAt.toISOString(),
      updatedAt: updatedAlert.updatedAt.toISOString(),
    },
  });
});

/**
 * Delete an alert
 */
app.delete('/v1/alerts/:id', (c) => {
  const userId = getUserIdFromRequest(c);
  const alertId = c.req.param('id');

  if (!userId) {
    return c.json(
      {
        error: {
          type: 'unauthorized',
          message: 'Authentication required. Pass X-Tokencap-User-Id header.',
        },
      },
      401
    );
  }

  const user = getUserById(userId);
  if (!user) {
    return c.json(
      {
        error: {
          type: 'not_found',
          message: 'User not found',
        },
      },
      404
    );
  }

  // Get existing alert and verify ownership
  const existingAlert = getAlertById(alertId);
  if (!existingAlert) {
    return c.json(
      {
        error: {
          type: 'not_found',
          message: 'Alert not found',
        },
      },
      404
    );
  }

  if (existingAlert.userId !== userId) {
    return c.json(
      {
        error: {
          type: 'forbidden',
          message: 'You do not own this alert',
        },
      },
      403
    );
  }

  const deleted = deleteAlert(alertId);

  if (!deleted) {
    return c.json(
      {
        error: {
          type: 'internal_error',
          message: 'Failed to delete alert',
        },
      },
      500
    );
  }

  return c.json({
    success: true,
    message: 'Alert deleted successfully',
  });
});

/**
 * Get alert history for the authenticated user
 */
app.get('/v1/alerts/history', (c) => {
  const userId = getUserIdFromRequest(c);

  if (!userId) {
    return c.json(
      {
        error: {
          type: 'unauthorized',
          message: 'Authentication required. Pass X-Tokencap-User-Id header.',
        },
      },
      401
    );
  }

  const user = getUserById(userId);
  if (!user) {
    return c.json(
      {
        error: {
          type: 'not_found',
          message: 'User not found',
        },
      },
      404
    );
  }

  if (user.plan === 'free') {
    return c.json(
      {
        error: {
          type: 'forbidden',
          message: 'Alerts are a PRO tier feature. Please upgrade your plan.',
        },
      },
      403
    );
  }

  const limit = parseInt(c.req.query('limit') || '100', 10);
  const history = getAlertHistoryByUserId(userId, limit);

  return c.json({
    history: history.map(entry => ({
      id: entry.id,
      alertId: entry.alertId,
      triggeredAt: entry.triggeredAt.toISOString(),
      details: JSON.parse(entry.details),
    })),
  });
});

// ============================================================================
// Error Handling
// ============================================================================

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json(
    {
      error: {
        type: 'internal_error',
        message: 'An unexpected error occurred',
      },
    },
    500
  );
});

app.notFound((c) => {
  return c.json(
    {
      error: {
        type: 'not_found',
        message: `Route not found: ${c.req.method} ${c.req.path}`,
      },
    },
    404
  );
});

// ============================================================================
// Server
// ============================================================================

console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    Tokencap Proxy                         ║
║       LLM Cost Prediction & Budget Enforcement            ║
╚═══════════════════════════════════════════════════════════╝

Configuration:
  - Port: ${config.port}
  - Host: ${config.host}
  - Database: ${config.dbPath}
  - OpenAI API Key: ${config.openaiApiKey ? '✓ configured' : '✗ not set'}
  - Anthropic API Key: ${config.anthropicApiKey ? '✓ configured' : '✗ not set'}
  - Default Project: ${config.defaultProjectId}

Authentication Endpoints (Public):
  - POST /v1/auth/register     (Create account)
  - POST /v1/auth/login        (Get session token)
  - POST /v1/auth/logout       (End session)

API Key Management (Session Auth):
  - POST   /v1/auth/api-keys   (Create API key)
  - GET    /v1/auth/api-keys   (List API keys)
  - DELETE /v1/auth/api-keys/:id (Revoke key)
  - GET    /v1/auth/me         (Get user info)

Protected Endpoints (API Key Auth):
  - POST /v1/chat/completions  (OpenAI proxy)
  - POST /v1/messages          (Anthropic proxy)
  - GET  /v1/usage             (Get usage stats)
  - POST /v1/budget            (Set budget)
  - GET  /v1/budget            (Get budget)
  - POST /v1/alerts            (Create alert - PRO)
  - GET  /v1/alerts            (List alerts - PRO)
  - PUT  /v1/alerts/:id        (Update alert - PRO)
  - DELETE /v1/alerts/:id      (Delete alert - PRO)
  - GET  /v1/alerts/history    (Alert history - PRO)

Email Alerts:
  - RESEND_API_KEY: ${config.resendApiKey ? '✓ configured' : '✗ not set (will log to console)'}
`);

const server = serve({
  fetch: app.fetch,
  port: config.port,
  hostname: config.host,
});

console.log(`Server running at http://${config.host}:${config.port}`);

// ============================================================================
// Graceful Shutdown
// ============================================================================

function shutdown() {
  console.log('\nShutting down...');
  cleanupEncoders();
  closeDatabase();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { app };
