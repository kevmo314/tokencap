/**
 * Tokencap Cost Estimation
 *
 * Pre-execution cost estimation for LLM API calls.
 * Provides accurate input costs and estimated output costs.
 */

import type {
  EstimateRequest,
  CostEstimate,
  ModelPricing,
  ModelId,
  Provider,
  Message,
} from './types.js';
import { countMessagesTokens, estimateOutputTokens, detectProvider } from './tokenizer.js';

// ============================================================================
// Model Pricing Database
// ============================================================================

/**
 * Pricing data for popular models (as of January 2026)
 *
 * Prices are stored in CENTS per 1 million tokens for precision.
 * Example: $30/1M tokens = 3000 cents/1M tokens
 *
 * This is embedded to ensure zero API calls for basic estimates.
 * Can be supplemented with live pricing from Tokencap API.
 */
const MODEL_PRICING: Map<string, ModelPricing> = new Map([
  // OpenAI GPT-4 family
  [
    'gpt-4',
    {
      model: 'gpt-4',
      provider: 'openai',
      inputPricePerMillion: 3000, // $30/1M = 3000 cents
      outputPricePerMillion: 6000, // $60/1M = 6000 cents
      contextWindow: 8192,
      maxOutput: 8192,
    },
  ],
  [
    'gpt-4-turbo',
    {
      model: 'gpt-4-turbo',
      provider: 'openai',
      inputPricePerMillion: 1000, // $10/1M
      outputPricePerMillion: 3000, // $30/1M
      contextWindow: 128000,
      maxOutput: 4096,
    },
  ],
  [
    'gpt-4-turbo-preview',
    {
      model: 'gpt-4-turbo-preview',
      provider: 'openai',
      inputPricePerMillion: 1000,
      outputPricePerMillion: 3000,
      contextWindow: 128000,
      maxOutput: 4096,
    },
  ],
  [
    'gpt-4o',
    {
      model: 'gpt-4o',
      provider: 'openai',
      inputPricePerMillion: 250, // $2.50/1M
      outputPricePerMillion: 1000, // $10/1M
      contextWindow: 128000,
      maxOutput: 16384,
    },
  ],
  [
    'gpt-4o-mini',
    {
      model: 'gpt-4o-mini',
      provider: 'openai',
      inputPricePerMillion: 15, // $0.15/1M
      outputPricePerMillion: 60, // $0.60/1M
      contextWindow: 128000,
      maxOutput: 16384,
    },
  ],
  // OpenAI GPT-3.5
  [
    'gpt-3.5-turbo',
    {
      model: 'gpt-3.5-turbo',
      provider: 'openai',
      inputPricePerMillion: 50, // $0.50/1M
      outputPricePerMillion: 150, // $1.50/1M
      contextWindow: 16385,
      maxOutput: 4096,
    },
  ],
  [
    'gpt-3.5-turbo-16k',
    {
      model: 'gpt-3.5-turbo-16k',
      provider: 'openai',
      inputPricePerMillion: 300, // $3/1M
      outputPricePerMillion: 400, // $4/1M
      contextWindow: 16385,
      maxOutput: 4096,
    },
  ],
  // OpenAI o1 models
  [
    'o1-preview',
    {
      model: 'o1-preview',
      provider: 'openai',
      inputPricePerMillion: 1500, // $15/1M
      outputPricePerMillion: 6000, // $60/1M
      contextWindow: 128000,
      maxOutput: 32768,
    },
  ],
  [
    'o1-mini',
    {
      model: 'o1-mini',
      provider: 'openai',
      inputPricePerMillion: 300, // $3/1M
      outputPricePerMillion: 1200, // $12/1M
      contextWindow: 128000,
      maxOutput: 65536,
    },
  ],
  // Anthropic Claude 3 family
  [
    'claude-3-opus-20240229',
    {
      model: 'claude-3-opus-20240229',
      provider: 'anthropic',
      inputPricePerMillion: 1500, // $15/1M
      outputPricePerMillion: 7500, // $75/1M
      contextWindow: 200000,
      maxOutput: 4096,
    },
  ],
  [
    'claude-3-sonnet-20240229',
    {
      model: 'claude-3-sonnet-20240229',
      provider: 'anthropic',
      inputPricePerMillion: 300, // $3/1M
      outputPricePerMillion: 1500, // $15/1M
      contextWindow: 200000,
      maxOutput: 4096,
    },
  ],
  [
    'claude-3-haiku-20240307',
    {
      model: 'claude-3-haiku-20240307',
      provider: 'anthropic',
      inputPricePerMillion: 25, // $0.25/1M
      outputPricePerMillion: 125, // $1.25/1M
      contextWindow: 200000,
      maxOutput: 4096,
    },
  ],
  // Anthropic Claude 3.5 family
  [
    'claude-3-5-sonnet-20240620',
    {
      model: 'claude-3-5-sonnet-20240620',
      provider: 'anthropic',
      inputPricePerMillion: 300, // $3/1M
      outputPricePerMillion: 1500, // $15/1M
      contextWindow: 200000,
      maxOutput: 8192,
    },
  ],
  [
    'claude-3-5-sonnet-20241022',
    {
      model: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
      inputPricePerMillion: 300, // $3/1M
      outputPricePerMillion: 1500, // $15/1M
      contextWindow: 200000,
      maxOutput: 8192,
    },
  ],
  [
    'claude-3-5-haiku-20241022',
    {
      model: 'claude-3-5-haiku-20241022',
      provider: 'anthropic',
      inputPricePerMillion: 100, // $1/1M
      outputPricePerMillion: 500, // $5/1M
      contextWindow: 200000,
      maxOutput: 8192,
    },
  ],
]);

// Aliases for common model names
const MODEL_ALIASES: Map<string, string> = new Map([
  ['gpt-4-0613', 'gpt-4'],
  ['gpt-4-0314', 'gpt-4'],
  ['gpt-4-1106-preview', 'gpt-4-turbo-preview'],
  ['gpt-4-0125-preview', 'gpt-4-turbo-preview'],
  ['gpt-4-turbo-2024-04-09', 'gpt-4-turbo'],
  ['gpt-4o-2024-05-13', 'gpt-4o'],
  ['gpt-4o-2024-08-06', 'gpt-4o'],
  ['gpt-4o-mini-2024-07-18', 'gpt-4o-mini'],
  ['gpt-3.5-turbo-0125', 'gpt-3.5-turbo'],
  ['gpt-3.5-turbo-1106', 'gpt-3.5-turbo'],
  ['claude-3-opus', 'claude-3-opus-20240229'],
  ['claude-3-sonnet', 'claude-3-sonnet-20240229'],
  ['claude-3-haiku', 'claude-3-haiku-20240307'],
  ['claude-3.5-sonnet', 'claude-3-5-sonnet-20241022'],
  ['claude-3.5-haiku', 'claude-3-5-haiku-20241022'],
]);

// ============================================================================
// Pricing Lookup
// ============================================================================

/**
 * Get pricing for a model
 *
 * @param model - Model identifier
 * @returns Pricing info or undefined if not found
 */
export function getModelPricing(model: ModelId): ModelPricing | undefined {
  // Check direct match
  const direct = MODEL_PRICING.get(model);
  if (direct) return direct;

  // Check aliases
  const alias = MODEL_ALIASES.get(model);
  if (alias) {
    return MODEL_PRICING.get(alias);
  }

  // Try fuzzy matching for partial model names
  const modelLower = model.toLowerCase();
  for (const [key, pricing] of MODEL_PRICING) {
    if (modelLower.includes(key) || key.includes(modelLower)) {
      return pricing;
    }
  }

  return undefined;
}

/**
 * Get all available model pricing
 */
export function getAllModelPricing(): ModelPricing[] {
  return Array.from(MODEL_PRICING.values());
}

/**
 * Calculate cost from tokens and pricing
 *
 * Pricing is stored in CENTS per 1M tokens.
 * Returns cost in DOLLARS.
 */
function calculateCost(
  inputTokens: number,
  outputTokens: number,
  pricing: ModelPricing
): { inputCost: number; outputCost: number; totalCost: number } {
  // Convert from cents per million to dollars per token
  // Formula: (tokens * cents_per_million) / 1_000_000 / 100
  // Example: 1000 tokens at 3000 cents/M = (1000 * 3000) / 1_000_000 / 100 = $0.03
  const inputCost = (inputTokens * pricing.inputPricePerMillion) / 1_000_000 / 100;
  const outputCost = (outputTokens * pricing.outputPricePerMillion) / 1_000_000 / 100;

  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
  };
}

// ============================================================================
// Cost Estimation
// ============================================================================

/**
 * Estimate the cost of an LLM API call before execution
 *
 * @param request - Request parameters
 * @returns Cost estimate
 *
 * @example
 * ```typescript
 * import { estimate } from '@tokencap/sdk';
 *
 * const result = await estimate({
 *   model: 'gpt-4',
 *   messages: [
 *     { role: 'system', content: 'You are a helpful assistant.' },
 *     { role: 'user', content: 'Hello!' }
 *   ],
 *   max_tokens: 1000
 * });
 *
 * console.log(result);
 * // {
 * //   inputTokens: 15,
 * //   outputTokens: 1000,
 * //   estimatedCost: 0.0465,
 * //   inputCost: 0.00045,
 * //   outputCost: 0.06,
 * //   model: 'gpt-4',
 * //   confidence: 'high'
 * // }
 * ```
 */
export function estimate(request: EstimateRequest): CostEstimate {
  const { model, messages, max_tokens, system } = request;

  // Build message array including system prompt if provided separately
  const allMessages: Message[] = system
    ? [{ role: 'system', content: system }, ...messages]
    : messages;

  // Count input tokens
  const provider = detectProvider(model);
  const tokenCount = countMessagesTokens(allMessages, { model, provider });
  const inputTokens = tokenCount.total;

  // Estimate output tokens
  let outputTokens: number;
  let confidence: 'high' | 'medium' | 'low';

  if (max_tokens !== undefined) {
    // If max_tokens specified, use it as upper bound
    // Actual will likely be less, but this gives worst-case cost
    outputTokens = max_tokens;
    confidence = 'high';
  } else {
    // Estimate based on input
    const outputEstimate = estimateOutputTokens(inputTokens, { model });
    outputTokens = outputEstimate.estimated;
    confidence = outputEstimate.confidence;
  }

  // Get pricing
  const pricing = getModelPricing(model);

  if (!pricing) {
    // Unknown model - provide estimate with warning
    // Use GPT-4 pricing as conservative default
    const defaultPricing = MODEL_PRICING.get('gpt-4')!;
    const costs = calculateCost(inputTokens, outputTokens, defaultPricing);

    return {
      inputTokens,
      outputTokens,
      estimatedCost: costs.totalCost,
      inputCost: costs.inputCost,
      outputCost: costs.outputCost,
      model,
      confidence: 'low', // Unknown model reduces confidence
    };
  }

  const costs = calculateCost(inputTokens, outputTokens, pricing);

  return {
    inputTokens,
    outputTokens,
    estimatedCost: costs.totalCost,
    inputCost: costs.inputCost,
    outputCost: costs.outputCost,
    model,
    confidence,
  };
}

/**
 * Calculate actual cost from usage data
 *
 * @param model - Model used
 * @param inputTokens - Actual input tokens
 * @param outputTokens - Actual output tokens
 * @returns Cost in USD
 */
export function calculateActualCost(
  model: ModelId,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = getModelPricing(model);

  if (!pricing) {
    // Use conservative default
    const defaultPricing = MODEL_PRICING.get('gpt-4')!;
    return calculateCost(inputTokens, outputTokens, defaultPricing).totalCost;
  }

  return calculateCost(inputTokens, outputTokens, pricing).totalCost;
}

/**
 * Get the cheapest model that fits requirements
 *
 * @param inputTokens - Required input context size
 * @param provider - Optional provider filter
 * @returns Cheapest suitable model
 */
export function getCheapestModel(
  inputTokens: number,
  provider?: Provider
): ModelPricing | undefined {
  const models = getAllModelPricing()
    .filter((m) => {
      // Filter by provider if specified
      if (provider && m.provider !== provider) return false;
      // Filter by context window
      if (m.contextWindow < inputTokens) return false;
      return true;
    })
    .sort((a, b) => {
      // Sort by total cost (input + output) assuming 1:1 ratio
      const aCost = a.inputPricePerMillion + a.outputPricePerMillion;
      const bCost = b.inputPricePerMillion + b.outputPricePerMillion;
      return aCost - bCost;
    });

  return models[0];
}
