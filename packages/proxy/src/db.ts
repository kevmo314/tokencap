/**
 * SQLite Database Module
 * Handles all database operations for usage tracking and budgets
 * MIT License
 */

import Database from 'better-sqlite3';
import type { Provider, Budget, UsageRecord, UsageSummary } from './types.js';

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
