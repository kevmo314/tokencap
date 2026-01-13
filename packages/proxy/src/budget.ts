/**
 * Budget Enforcement Module
 * Handles budget checking and enforcement before API calls
 * MIT License
 */

import type { CostEstimate, BudgetCheckResult } from './types.js';
import { getBudget, getCurrentSpend } from './db.js';

/**
 * Check if a request is within budget
 * Returns detailed information about the budget status
 */
export function checkBudget(
  projectId: string,
  estimatedCost: CostEstimate
): BudgetCheckResult {
  const budget = getBudget(projectId);

  // No budget set - always allow
  if (!budget) {
    return {
      allowed: true,
      currentSpendUsd: getCurrentSpend(projectId),
      limitUsd: null,
      estimatedCostUsd: estimatedCost.totalEstimatedCostUsd,
      remainingAfterRequestUsd: null,
    };
  }

  // Check if budget period has expired
  if (budget.periodEnd && new Date() > budget.periodEnd) {
    // Budget period expired - allow but warn
    return {
      allowed: true,
      currentSpendUsd: budget.spentUsd,
      limitUsd: budget.limitUsd,
      estimatedCostUsd: estimatedCost.totalEstimatedCostUsd,
      remainingAfterRequestUsd: null,
      reason: 'Budget period has expired. Consider resetting the budget.',
    };
  }

  const currentSpend = budget.spentUsd;
  const remainingBudget = budget.limitUsd - currentSpend;
  const estimatedCostUsd = estimatedCost.totalEstimatedCostUsd;
  const remainingAfterRequest = remainingBudget - estimatedCostUsd;

  // Check if request would exceed budget
  if (estimatedCostUsd > remainingBudget) {
    return {
      allowed: false,
      currentSpendUsd: currentSpend,
      limitUsd: budget.limitUsd,
      estimatedCostUsd,
      remainingAfterRequestUsd: remainingAfterRequest,
      reason: `Request would exceed budget. Estimated cost: $${estimatedCostUsd.toFixed(6)}, Remaining budget: $${remainingBudget.toFixed(6)}`,
    };
  }

  // Request is within budget
  return {
    allowed: true,
    currentSpendUsd: currentSpend,
    limitUsd: budget.limitUsd,
    estimatedCostUsd,
    remainingAfterRequestUsd: remainingAfterRequest,
  };
}

/**
 * Check if adding a specific cost would exceed budget
 * Simpler version for quick checks
 */
export function wouldExceedBudget(projectId: string, costUsd: number): boolean {
  const budget = getBudget(projectId);

  if (!budget) return false;

  // Ignore expired budgets
  if (budget.periodEnd && new Date() > budget.periodEnd) {
    return false;
  }

  const remainingBudget = budget.limitUsd - budget.spentUsd;
  return costUsd > remainingBudget;
}

/**
 * Get remaining budget for a project
 */
export function getRemainingBudget(projectId: string): number | null {
  const budget = getBudget(projectId);

  if (!budget) return null;

  return Math.max(0, budget.limitUsd - budget.spentUsd);
}

/**
 * Get budget utilization percentage
 */
export function getBudgetUtilization(projectId: string): number | null {
  const budget = getBudget(projectId);

  if (!budget || budget.limitUsd === 0) return null;

  return (budget.spentUsd / budget.limitUsd) * 100;
}

/**
 * Format budget error for API response
 */
export function formatBudgetError(checkResult: BudgetCheckResult): {
  type: 'budget_exceeded';
  message: string;
  details: {
    currentSpendUsd: number;
    limitUsd: number | null;
    estimatedCostUsd: number;
    remainingBudgetUsd: number;
  };
} {
  const remainingBudget = checkResult.limitUsd
    ? Math.max(0, checkResult.limitUsd - checkResult.currentSpendUsd)
    : 0;

  return {
    type: 'budget_exceeded',
    message: checkResult.reason || 'Request would exceed budget limit',
    details: {
      currentSpendUsd: checkResult.currentSpendUsd,
      limitUsd: checkResult.limitUsd,
      estimatedCostUsd: checkResult.estimatedCostUsd,
      remainingBudgetUsd: remainingBudget,
    },
  };
}

/**
 * Calculate safe max_tokens that fits within budget
 * Useful for graceful degradation
 */
export function calculateSafeMaxTokens(
  projectId: string,
  inputTokens: number,
  inputCostUsd: number,
  outputPricePerMillion: number
): number | null {
  const remaining = getRemainingBudget(projectId);

  if (remaining === null) return null;

  // Budget remaining after input cost
  const budgetForOutput = remaining - inputCostUsd;

  if (budgetForOutput <= 0) return 0;

  // Calculate max tokens we can afford
  const maxAffordableTokens = Math.floor(
    (budgetForOutput / outputPricePerMillion) * 1_000_000
  );

  return maxAffordableTokens;
}
