/**
 * Tokencap SDK
 *
 * Lightweight LLM cost optimization with pre-execution prediction.
 * Zero dependencies. Works with OpenAI and Anthropic SDKs.
 *
 * @packageDocumentation
 */

// ============================================================================
// Main Exports
// ============================================================================

// Main wrapper function
export { tokencap, createTokencap, TokencapBudgetExceededError } from './wrapper.js';

// Cost estimation
export { estimate, calculateActualCost, getModelPricing, getAllModelPricing, getCheapestModel } from './estimate.js';

// Token counting
export { countTokens, countMessagesTokens, estimateOutputTokens, detectProvider } from './tokenizer.js';

// ============================================================================
// Type Exports
// ============================================================================

export type {
  // Provider types
  Provider,
  ModelId,

  // Message types
  Message,
  MessageRole,
  MessageContent,
  ContentPart,

  // Cost types
  EstimateRequest,
  CostEstimate,
  ActualCost,
  ModelPricing,

  // Budget types
  BudgetConfig,
  BudgetStatus,

  // Configuration types
  TokencapConfig,
  OnCostCallback,
  OnBudgetWarningCallback,
  OnBudgetExceededCallback,
  OnEstimateCallback,

  // Token types
  TokenCount,
  TokenizerOptions,

  // Client types
  GenericSDKClient,
  WrappedClient,
} from './types.js';
