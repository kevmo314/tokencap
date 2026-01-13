/**
 * Tokencap Proxy Server
 * LLM proxy with pre-execution cost prediction and budget enforcement
 * MIT License
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import type { ProxyConfig, SetBudgetRequest } from './types.js';
import { initDatabase, closeDatabase, getUsageSummary, getRecentUsage, setBudget, resetBudgetSpent, deleteBudget } from './db.js';
import { proxyOpenAI, proxyAnthropic, getProjectId } from './proxy.js';
import { cleanupEncoders } from './tokenizer.js';
import { getRemainingBudget, getBudgetUtilization } from './budget.js';

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
// Proxy Endpoints
// ============================================================================

/**
 * OpenAI Chat Completions Proxy
 * Compatible with OpenAI SDK - just change the base URL
 */
app.post('/v1/chat/completions', async (c) => {
  return proxyOpenAI(c, config);
});

/**
 * Anthropic Messages Proxy
 * Compatible with Anthropic SDK - just change the base URL
 */
app.post('/v1/messages', async (c) => {
  return proxyAnthropic(c, config);
});

// ============================================================================
// Usage Endpoints
// ============================================================================

/**
 * Get usage summary for a project
 */
app.get('/v1/usage', (c) => {
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
app.get('/v1/usage/history', (c) => {
  const projectId = getProjectId(c, config);
  const limit = parseInt(c.req.query('limit') || '100', 10);

  const records = getRecentUsage(projectId, limit);

  return c.json({ records });
});

// ============================================================================
// Budget Endpoints
// ============================================================================

/**
 * Set budget for a project
 */
app.post('/v1/budget', async (c) => {
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
app.get('/v1/budget', (c) => {
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
app.post('/v1/budget/reset', async (c) => {
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
app.delete('/v1/budget', (c) => {
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

Endpoints:
  - POST /v1/chat/completions  (OpenAI proxy)
  - POST /v1/messages          (Anthropic proxy)
  - GET  /v1/usage             (Get usage stats)
  - POST /v1/budget            (Set budget)
  - GET  /v1/budget            (Get budget)
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
