/**
 * SQLite Database Module
 * Handles all database operations for usage tracking and budgets
 * MIT License
 */

import Database from 'better-sqlite3';
import type { Provider, Budget, UsageRecord, UsageSummary, Alert, AlertHistory, AlertType, User, Plan, ApiKey, Session, Project } from './types.js';

let db: Database.Database | null = null;

/**
 * Initialize the database connection and create tables
 */
export function initDatabase(dbPath: string): Database.Database {
  db = new Database(dbPath);

  // Enable WAL mode for better concurrent performance
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    -- Usage records table
    CREATE TABLE IF NOT EXISTS usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      cost_usd REAL NOT NULL,
      request_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Budgets table
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL UNIQUE,
      limit_usd REAL NOT NULL,
      spent_usd REAL NOT NULL DEFAULT 0,
      period_start TEXT NOT NULL DEFAULT (datetime('now')),
      period_end TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_usage_project_id ON usage(project_id);
    CREATE INDEX IF NOT EXISTS idx_usage_created_at ON usage(created_at);
    CREATE INDEX IF NOT EXISTS idx_budgets_project_id ON budgets(project_id);

    -- Users table (with full authentication support)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'free',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- API Keys table
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT 'Default',
      last_used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      revoked_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Sessions table (for login sessions)
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Projects table (for multi-project support)
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Indexes for auth tables
    CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

    -- Alerts table
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      type TEXT NOT NULL,
      threshold REAL NOT NULL DEFAULT 80,
      enabled INTEGER NOT NULL DEFAULT 1,
      webhook_url TEXT,
      email TEXT,
      last_triggered_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Alert history table
    CREATE TABLE IF NOT EXISTS alert_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_id TEXT NOT NULL,
      triggered_at TEXT NOT NULL DEFAULT (datetime('now')),
      details TEXT NOT NULL,
      FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
    );

    -- Indexes for alerts
    CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_project_id ON alerts(project_id);
    CREATE INDEX IF NOT EXISTS idx_alert_history_alert_id ON alert_history(alert_id);
  `);

  return db;
}

/**
 * Get the database instance
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase first.');
  }
  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// ============================================================================
// Usage Operations
// ============================================================================

/**
 * Record a usage event
 */
export function recordUsage(
  projectId: string,
  provider: Provider,
  model: string,
  inputTokens: number,
  outputTokens: number,
  costUsd: number,
  requestId: string
): UsageRecord {
  const database = getDatabase();

  const stmt = database.prepare(`
    INSERT INTO usage (project_id, provider, model, input_tokens, output_tokens, cost_usd, request_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(projectId, provider, model, inputTokens, outputTokens, costUsd, requestId);

  // Also update budget spent
  updateBudgetSpent(projectId, costUsd);

  return {
    id: result.lastInsertRowid as number,
    projectId,
    provider,
    model,
    inputTokens,
    outputTokens,
    costUsd,
    requestId,
    createdAt: new Date(),
  };
}

/**
 * Get usage summary for a project
 */
export function getUsageSummary(projectId: string): UsageSummary {
  const database = getDatabase();

  // Get usage totals
  const usageStmt = database.prepare(`
    SELECT
      COUNT(*) as total_requests,
      COALESCE(SUM(input_tokens), 0) as total_input_tokens,
      COALESCE(SUM(output_tokens), 0) as total_output_tokens,
      COALESCE(SUM(cost_usd), 0) as total_cost_usd
    FROM usage
    WHERE project_id = ?
  `);

  const usageRow = usageStmt.get(projectId) as {
    total_requests: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_cost_usd: number;
  };

  // Get budget info
  const budget = getBudget(projectId);

  return {
    projectId,
    totalRequests: usageRow.total_requests,
    totalInputTokens: usageRow.total_input_tokens,
    totalOutputTokens: usageRow.total_output_tokens,
    totalCostUsd: usageRow.total_cost_usd,
    budgetLimitUsd: budget?.limitUsd ?? null,
    budgetRemainingUsd: budget ? budget.limitUsd - budget.spentUsd : null,
  };
}

/**
 * Get recent usage records for a project
 */
export function getRecentUsage(projectId: string, limit: number = 100): UsageRecord[] {
  const database = getDatabase();

  const stmt = database.prepare(`
    SELECT id, project_id, provider, model, input_tokens, output_tokens, cost_usd, request_id, created_at
    FROM usage
    WHERE project_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const rows = stmt.all(projectId, limit) as Array<{
    id: number;
    project_id: string;
    provider: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    request_id: string;
    created_at: string;
  }>;

  return rows.map(row => ({
    id: row.id,
    projectId: row.project_id,
    provider: row.provider as Provider,
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    costUsd: row.cost_usd,
    requestId: row.request_id,
    createdAt: new Date(row.created_at),
  }));
}

// ============================================================================
// Budget Operations
// ============================================================================

/**
 * Create or update a budget for a project
 */
export function setBudget(
  projectId: string,
  limitUsd: number,
  periodDays?: number
): Budget {
  const database = getDatabase();

  const id = `budget_${projectId}_${Date.now()}`;
  const periodStart = new Date();
  const periodEnd = periodDays
    ? new Date(periodStart.getTime() + periodDays * 24 * 60 * 60 * 1000)
    : null;

  // Get current spent amount if budget exists
  const existingBudget = getBudget(projectId);
  const spentUsd = existingBudget?.spentUsd ?? 0;

  const stmt = database.prepare(`
    INSERT INTO budgets (id, project_id, limit_usd, spent_usd, period_start, period_end)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id) DO UPDATE SET
      limit_usd = excluded.limit_usd,
      period_start = excluded.period_start,
      period_end = excluded.period_end,
      updated_at = datetime('now')
  `);

  stmt.run(
    id,
    projectId,
    limitUsd,
    spentUsd,
    periodStart.toISOString(),
    periodEnd?.toISOString() ?? null
  );

  return {
    id,
    projectId,
    limitUsd,
    spentUsd,
    periodStart,
    periodEnd,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Get budget for a project
 */
export function getBudget(projectId: string): Budget | null {
  const database = getDatabase();

  const stmt = database.prepare(`
    SELECT id, project_id, limit_usd, spent_usd, period_start, period_end, created_at, updated_at
    FROM budgets
    WHERE project_id = ?
  `);

  const row = stmt.get(projectId) as {
    id: string;
    project_id: string;
    limit_usd: number;
    spent_usd: number;
    period_start: string;
    period_end: string | null;
    created_at: string;
    updated_at: string;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    projectId: row.project_id,
    limitUsd: row.limit_usd,
    spentUsd: row.spent_usd,
    periodStart: new Date(row.period_start),
    periodEnd: row.period_end ? new Date(row.period_end) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Update the spent amount for a budget
 */
function updateBudgetSpent(projectId: string, additionalCostUsd: number): void {
  const database = getDatabase();

  const stmt = database.prepare(`
    UPDATE budgets
    SET spent_usd = spent_usd + ?,
        updated_at = datetime('now')
    WHERE project_id = ?
  `);

  stmt.run(additionalCostUsd, projectId);
}

/**
 * Reset budget spent amount (for new billing period)
 */
export function resetBudgetSpent(projectId: string): void {
  const database = getDatabase();

  const stmt = database.prepare(`
    UPDATE budgets
    SET spent_usd = 0,
        period_start = datetime('now'),
        updated_at = datetime('now')
    WHERE project_id = ?
  `);

  stmt.run(projectId);
}

/**
 * Delete a budget
 */
export function deleteBudget(projectId: string): boolean {
  const database = getDatabase();

  const stmt = database.prepare(`
    DELETE FROM budgets WHERE project_id = ?
  `);

  const result = stmt.run(projectId);
  return result.changes > 0;
}

/**
 * Get current spend for a project
 */
export function getCurrentSpend(projectId: string): number {
  const budget = getBudget(projectId);
  return budget?.spentUsd ?? 0;
}

// ============================================================================
// User Operations
// ============================================================================

/**
 * Create a new user
 */
export function createUser(
  email: string,
  passwordHash: string,
  plan: Plan = 'free'
): User {
  const database = getDatabase();
  const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const stmt = database.prepare(`
    INSERT INTO users (id, email, password_hash, plan)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run(id, email, passwordHash, plan);

  return {
    id,
    email,
    passwordHash,
    plan,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Get user by ID
 */
export function getUserById(userId: string): User | null {
  const database = getDatabase();

  const stmt = database.prepare(`
    SELECT id, email, password_hash, plan, created_at, updated_at FROM users WHERE id = ?
  `);
  const row = stmt.get(userId) as {
    id: string;
    email: string;
    password_hash: string;
    plan: string;
    created_at: string;
    updated_at: string;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    plan: row.plan as Plan,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Get user by email
 */
export function getUserByEmail(email: string): User | null {
  const database = getDatabase();

  const stmt = database.prepare(`
    SELECT id, email, password_hash, plan, created_at, updated_at
    FROM users
    WHERE email = ?
  `);

  const row = stmt.get(email) as {
    id: string;
    email: string;
    password_hash: string;
    plan: string;
    created_at: string;
    updated_at: string;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    plan: row.plan as Plan,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Update user plan
 */
export function updateUserPlan(userId: string, plan: Plan): boolean {
  const database = getDatabase();

  const stmt = database.prepare(`
    UPDATE users
    SET plan = ?, updated_at = datetime('now')
    WHERE id = ?
  `);

  const result = stmt.run(plan, userId);
  return result.changes > 0;
}

// ============================================================================
// API Key Operations
// ============================================================================

/**
 * Generate a cryptographically secure random token
 */
function generateSecureToken(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => chars[byte % chars.length]).join('');
}

/**
 * Create a new API key
 */
export function createApiKey(userId: string, name: string = 'Default'): ApiKey {
  const database = getDatabase();
  const id = `key_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  // Generate API key with tc_ prefix
  const key = `tc_${generateSecureToken(24)}`;

  const stmt = database.prepare(`
    INSERT INTO api_keys (id, user_id, key, name)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run(id, userId, key, name);

  return {
    id,
    userId,
    key,
    name,
    lastUsedAt: null,
    createdAt: new Date(),
    revokedAt: null,
  };
}

/**
 * Get API key by key value
 */
export function getApiKeyByKey(key: string): ApiKey | null {
  const database = getDatabase();

  const stmt = database.prepare(`
    SELECT id, user_id, key, name, last_used_at, created_at, revoked_at
    FROM api_keys
    WHERE key = ? AND revoked_at IS NULL
  `);

  const row = stmt.get(key) as {
    id: string;
    user_id: string;
    key: string;
    name: string;
    last_used_at: string | null;
    created_at: string;
    revoked_at: string | null;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    key: row.key,
    name: row.name,
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : null,
    createdAt: new Date(row.created_at),
    revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
  };
}

/**
 * Get all API keys for a user
 */
export function getApiKeysByUserId(userId: string): ApiKey[] {
  const database = getDatabase();

  const stmt = database.prepare(`
    SELECT id, user_id, key, name, last_used_at, created_at, revoked_at
    FROM api_keys
    WHERE user_id = ? AND revoked_at IS NULL
    ORDER BY created_at DESC
  `);

  const rows = stmt.all(userId) as Array<{
    id: string;
    user_id: string;
    key: string;
    name: string;
    last_used_at: string | null;
    created_at: string;
    revoked_at: string | null;
  }>;

  return rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    key: row.key,
    name: row.name,
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : null,
    createdAt: new Date(row.created_at),
    revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
  }));
}

/**
 * Revoke an API key
 */
export function revokeApiKey(keyId: string, userId: string): boolean {
  const database = getDatabase();

  const stmt = database.prepare(`
    UPDATE api_keys
    SET revoked_at = datetime('now')
    WHERE id = ? AND user_id = ? AND revoked_at IS NULL
  `);

  const result = stmt.run(keyId, userId);
  return result.changes > 0;
}

/**
 * Update API key last used time
 */
export function updateApiKeyLastUsed(keyId: string): void {
  const database = getDatabase();

  const stmt = database.prepare(`
    UPDATE api_keys
    SET last_used_at = datetime('now')
    WHERE id = ?
  `);

  stmt.run(keyId);
}

// ============================================================================
// Session Operations
// ============================================================================

/**
 * Create a new session
 */
export function createSession(userId: string, expiresInHours: number = 24 * 7): Session {
  const database = getDatabase();
  const id = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const token = generateSecureToken(32);
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  const stmt = database.prepare(`
    INSERT INTO sessions (id, user_id, token, expires_at)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run(id, userId, token, expiresAt.toISOString());

  return {
    id,
    userId,
    token,
    expiresAt,
    createdAt: new Date(),
  };
}

/**
 * Get session by token
 */
export function getSessionByToken(token: string): Session | null {
  const database = getDatabase();

  const stmt = database.prepare(`
    SELECT id, user_id, token, expires_at, created_at
    FROM sessions
    WHERE token = ? AND expires_at > datetime('now')
  `);

  const row = stmt.get(token) as {
    id: string;
    user_id: string;
    token: string;
    expires_at: string;
    created_at: string;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    token: row.token,
    expiresAt: new Date(row.expires_at),
    createdAt: new Date(row.created_at),
  };
}

/**
 * Delete a session
 */
export function deleteSession(token: string): boolean {
  const database = getDatabase();

  const stmt = database.prepare(`
    DELETE FROM sessions WHERE token = ?
  `);

  const result = stmt.run(token);
  return result.changes > 0;
}

/**
 * Delete all sessions for a user
 */
export function deleteUserSessions(userId: string): void {
  const database = getDatabase();

  const stmt = database.prepare(`
    DELETE FROM sessions WHERE user_id = ?
  `);

  stmt.run(userId);
}

/**
 * Clean up expired sessions
 */
export function cleanupExpiredSessions(): number {
  const database = getDatabase();

  const stmt = database.prepare(`
    DELETE FROM sessions WHERE expires_at <= datetime('now')
  `);

  const result = stmt.run();
  return result.changes;
}

// ============================================================================
// Project Operations
// ============================================================================

/**
 * Create a new project
 */
export function createProject(userId: string, name: string): Project {
  const database = getDatabase();
  const id = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const stmt = database.prepare(`
    INSERT INTO projects (id, user_id, name)
    VALUES (?, ?, ?)
  `);

  stmt.run(id, userId, name);

  return {
    id,
    userId,
    name,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Get project by ID
 */
export function getProjectById(projectId: string): Project | null {
  const database = getDatabase();

  const stmt = database.prepare(`
    SELECT id, user_id, name, created_at, updated_at
    FROM projects
    WHERE id = ?
  `);

  const row = stmt.get(projectId) as {
    id: string;
    user_id: string;
    name: string;
    created_at: string;
    updated_at: string;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Get all projects for a user
 */
export function getProjectsByUserId(userId: string): Project[] {
  const database = getDatabase();

  const stmt = database.prepare(`
    SELECT id, user_id, name, created_at, updated_at
    FROM projects
    WHERE user_id = ?
    ORDER BY created_at DESC
  `);

  const rows = stmt.all(userId) as Array<{
    id: string;
    user_id: string;
    name: string;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }));
}

/**
 * Count projects for a user
 */
export function countUserProjects(userId: string): number {
  const database = getDatabase();

  const stmt = database.prepare(`
    SELECT COUNT(*) as count FROM projects WHERE user_id = ?
  `);

  const row = stmt.get(userId) as { count: number };
  return row.count;
}

/**
 * Delete a project
 */
export function deleteProject(projectId: string, userId: string): boolean {
  const database = getDatabase();

  const stmt = database.prepare(`
    DELETE FROM projects WHERE id = ? AND user_id = ?
  `);

  const result = stmt.run(projectId, userId);
  return result.changes > 0;
}

// ============================================================================
// Usage Count Operations (for plan limits)
// ============================================================================

/**
 * Get monthly request count for a user across all their projects
 */
export function getMonthlyRequestCount(userId: string): number {
  const database = getDatabase();

  // Get start of current month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const stmt = database.prepare(`
    SELECT COUNT(*) as count
    FROM usage u
    INNER JOIN projects p ON u.project_id = p.id
    WHERE p.user_id = ? AND u.created_at >= ?
  `);

  const row = stmt.get(userId, startOfMonth.toISOString()) as { count: number };
  return row.count;
}

// ============================================================================
// Alert Operations
// ============================================================================

/**
 * Create an alert
 */
export function createAlert(
  userId: string,
  projectId: string,
  type: AlertType,
  threshold: number,
  webhookUrl: string | null,
  email: string | null
): Alert {
  const database = getDatabase();

  const id = `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const stmt = database.prepare(`
    INSERT INTO alerts (id, user_id, project_id, type, threshold, webhook_url, email)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, userId, projectId, type, threshold, webhookUrl, email);

  return {
    id,
    userId,
    projectId,
    type,
    threshold,
    enabled: true,
    webhookUrl,
    email,
    lastTriggeredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Get alert by ID
 */
export function getAlertById(alertId: string): Alert | null {
  const database = getDatabase();

  const stmt = database.prepare(`
    SELECT id, user_id, project_id, type, threshold, enabled, webhook_url, email, last_triggered_at, created_at, updated_at
    FROM alerts WHERE id = ?
  `);
  const row = stmt.get(alertId) as {
    id: string;
    user_id: string;
    project_id: string;
    type: string;
    threshold: number;
    enabled: number;
    webhook_url: string | null;
    email: string | null;
    last_triggered_at: string | null;
    created_at: string;
    updated_at: string;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    type: row.type as AlertType,
    threshold: row.threshold,
    enabled: row.enabled === 1,
    webhookUrl: row.webhook_url,
    email: row.email,
    lastTriggeredAt: row.last_triggered_at ? new Date(row.last_triggered_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Get all alerts for a user
 */
export function getAlertsByUserId(userId: string): Alert[] {
  const database = getDatabase();

  const stmt = database.prepare(`
    SELECT id, user_id, project_id, type, threshold, enabled, webhook_url, email, last_triggered_at, created_at, updated_at
    FROM alerts WHERE user_id = ? ORDER BY created_at DESC
  `);
  const rows = stmt.all(userId) as Array<{
    id: string;
    user_id: string;
    project_id: string;
    type: string;
    threshold: number;
    enabled: number;
    webhook_url: string | null;
    email: string | null;
    last_triggered_at: string | null;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    type: row.type as AlertType,
    threshold: row.threshold,
    enabled: row.enabled === 1,
    webhookUrl: row.webhook_url,
    email: row.email,
    lastTriggeredAt: row.last_triggered_at ? new Date(row.last_triggered_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }));
}

/**
 * Get enabled alerts for a project
 */
export function getEnabledAlertsByProjectId(projectId: string): Alert[] {
  const database = getDatabase();

  const stmt = database.prepare(`
    SELECT id, user_id, project_id, type, threshold, enabled, webhook_url, email, last_triggered_at, created_at, updated_at
    FROM alerts WHERE project_id = ? AND enabled = 1
  `);
  const rows = stmt.all(projectId) as Array<{
    id: string;
    user_id: string;
    project_id: string;
    type: string;
    threshold: number;
    enabled: number;
    webhook_url: string | null;
    email: string | null;
    last_triggered_at: string | null;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    type: row.type as AlertType,
    threshold: row.threshold,
    enabled: row.enabled === 1,
    webhookUrl: row.webhook_url,
    email: row.email,
    lastTriggeredAt: row.last_triggered_at ? new Date(row.last_triggered_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }));
}

/**
 * Update an alert
 */
export function updateAlert(
  alertId: string,
  updates: {
    type?: AlertType;
    threshold?: number;
    enabled?: boolean;
    webhookUrl?: string | null;
    email?: string | null;
  }
): Alert | null {
  const database = getDatabase();

  const existing = getAlertById(alertId);
  if (!existing) return null;

  const fields: string[] = ['updated_at = datetime(\'now\')'];
  const values: (string | number | null)[] = [];

  if (updates.type !== undefined) {
    fields.push('type = ?');
    values.push(updates.type);
  }
  if (updates.threshold !== undefined) {
    fields.push('threshold = ?');
    values.push(updates.threshold);
  }
  if (updates.enabled !== undefined) {
    fields.push('enabled = ?');
    values.push(updates.enabled ? 1 : 0);
  }
  if (updates.webhookUrl !== undefined) {
    fields.push('webhook_url = ?');
    values.push(updates.webhookUrl);
  }
  if (updates.email !== undefined) {
    fields.push('email = ?');
    values.push(updates.email);
  }

  values.push(alertId);

  const stmt = database.prepare(`
    UPDATE alerts SET ${fields.join(', ')} WHERE id = ?
  `);
  stmt.run(...values);

  return getAlertById(alertId);
}

/**
 * Update alert's last triggered timestamp
 */
export function updateAlertLastTriggered(alertId: string): void {
  const database = getDatabase();

  const stmt = database.prepare(`
    UPDATE alerts SET last_triggered_at = datetime('now'), updated_at = datetime('now') WHERE id = ?
  `);
  stmt.run(alertId);
}

/**
 * Delete an alert
 */
export function deleteAlert(alertId: string): boolean {
  const database = getDatabase();

  const stmt = database.prepare(`
    DELETE FROM alerts WHERE id = ?
  `);
  const result = stmt.run(alertId);
  return result.changes > 0;
}

// ============================================================================
// Alert History Operations
// ============================================================================

/**
 * Record an alert trigger in history
 */
export function recordAlertHistory(alertId: string, details: string): AlertHistory {
  const database = getDatabase();

  const stmt = database.prepare(`
    INSERT INTO alert_history (alert_id, details) VALUES (?, ?)
  `);
  const result = stmt.run(alertId, details);

  return {
    id: result.lastInsertRowid as number,
    alertId,
    triggeredAt: new Date(),
    details,
  };
}

/**
 * Get alert history for a user (across all their alerts)
 */
export function getAlertHistoryByUserId(userId: string, limit: number = 100): AlertHistory[] {
  const database = getDatabase();

  const stmt = database.prepare(`
    SELECT ah.id, ah.alert_id, ah.triggered_at, ah.details
    FROM alert_history ah
    JOIN alerts a ON ah.alert_id = a.id
    WHERE a.user_id = ?
    ORDER BY ah.triggered_at DESC
    LIMIT ?
  `);
  const rows = stmt.all(userId, limit) as Array<{
    id: number;
    alert_id: string;
    triggered_at: string;
    details: string;
  }>;

  return rows.map(row => ({
    id: row.id,
    alertId: row.alert_id,
    triggeredAt: new Date(row.triggered_at),
    details: row.details,
  }));
}

// ============================================================================
// Daily Spend Queries (for alerts)
// ============================================================================

/**
 * Get today's total spend for a project
 */
export function getTodaySpend(projectId: string): number {
  const database = getDatabase();

  const stmt = database.prepare(`
    SELECT COALESCE(SUM(cost_usd), 0) as total
    FROM usage
    WHERE project_id = ? AND date(created_at) = date('now')
  `);
  const row = stmt.get(projectId) as { total: number };
  return row.total;
}

/**
 * Get average daily spend for a project (last 30 days, excluding today)
 */
export function getAverageDailySpend(projectId: string): number {
  const database = getDatabase();

  const stmt = database.prepare(`
    SELECT COALESCE(AVG(daily_total), 0) as average
    FROM (
      SELECT date(created_at) as day, SUM(cost_usd) as daily_total
      FROM usage
      WHERE project_id = ?
        AND date(created_at) >= date('now', '-30 days')
        AND date(created_at) < date('now')
      GROUP BY date(created_at)
    )
  `);
  const row = stmt.get(projectId) as { average: number };
  return row.average;
}
