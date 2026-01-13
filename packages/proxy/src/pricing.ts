/**
 * Tokencap LLM Pricing Database
 * Comprehensive pricing data for all major LLM providers
 *
 * Prices in USD per 1M tokens
 * Last Updated: January 2026
 *
 * Sources:
 * - OpenAI: https://openai.com/api/pricing/ and https://platform.openai.com/docs/pricing
 * - Anthropic: https://claude.com/pricing and https://platform.claude.com/docs/en/about-claude/pricing
 * - Google: https://ai.google.dev/pricing
 * - Mistral: https://mistral.ai/pricing
 * - Meta (Llama): Pricing varies by provider (DeepInfra, Together AI, etc.)
 *
 * MIT License
 */

import type { Provider } from './types.js';

// ============================================================================
// Types
// ============================================================================

export interface ModelPricing {
  /** The LLM provider */
  provider: Provider;
  /** Model identifier (as used in API calls) */
  model: string;
  /** Display name for the model */
  displayName?: string;
  /** Input/prompt cost in USD per 1M tokens */
  inputPricePerMillion: number;
  /** Output/completion cost in USD per 1M tokens */
  outputPricePerMillion: number;
  /** Maximum context window in tokens */
  contextWindow: number;
  /** Default max output tokens if not specified */
  defaultMaxOutput?: number;
  /** ISO date string of when pricing was last verified */
  lastUpdated: string;
  /** Whether this model is deprecated */
  deprecated?: boolean;
  /** Notes about the model or pricing */
  notes?: string;
}

// ============================================================================
// Pricing Database
// ============================================================================

/**
 * Comprehensive LLM pricing data
 * Updated January 2026
 */
const PRICING_DATA: ModelPricing[] = [
  // ==========================================================================
  // OpenAI Models
  // Source: https://openai.com/api/pricing/
  // ==========================================================================

  // --- GPT-4o Series (Flagship multimodal models) ---
  {
    provider: 'openai',
    model: 'gpt-4o',
    displayName: 'GPT-4o',
    inputPricePerMillion: 2.50,
    outputPricePerMillion: 10.00,
    contextWindow: 128000,
    defaultMaxOutput: 16384,
    lastUpdated: '2026-01-13',
    notes: 'Flagship model with vision capabilities',
  },
  {
    provider: 'openai',
    model: 'gpt-4o-2024-11-20',
    displayName: 'GPT-4o (Nov 2024)',
    inputPricePerMillion: 2.50,
    outputPricePerMillion: 10.00,
    contextWindow: 128000,
    defaultMaxOutput: 16384,
    lastUpdated: '2026-01-13',
  },
  {
    provider: 'openai',
    model: 'gpt-4o-2024-08-06',
    displayName: 'GPT-4o (Aug 2024)',
    inputPricePerMillion: 2.50,
    outputPricePerMillion: 10.00,
    contextWindow: 128000,
    defaultMaxOutput: 16384,
    lastUpdated: '2026-01-13',
  },
  {
    provider: 'openai',
    model: 'gpt-4o-2024-05-13',
    displayName: 'GPT-4o (May 2024)',
    inputPricePerMillion: 5.00,
    outputPricePerMillion: 15.00,
    contextWindow: 128000,
    defaultMaxOutput: 4096,
    lastUpdated: '2026-01-13',
    deprecated: true,
  },

  // --- GPT-4o Mini (Cost-efficient model) ---
  {
    provider: 'openai',
    model: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.60,
    contextWindow: 128000,
    defaultMaxOutput: 16384,
    lastUpdated: '2026-01-13',
    notes: 'Best value for most use cases',
  },
  {
    provider: 'openai',
    model: 'gpt-4o-mini-2024-07-18',
    displayName: 'GPT-4o Mini (Jul 2024)',
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.60,
    contextWindow: 128000,
    defaultMaxOutput: 16384,
    lastUpdated: '2026-01-13',
  },

  // --- GPT-4.1 Series (Latest GPT-4 generation) ---
  {
    provider: 'openai',
    model: 'gpt-4.1',
    displayName: 'GPT-4.1',
    inputPricePerMillion: 2.00,
    outputPricePerMillion: 8.00,
    contextWindow: 128000,
    defaultMaxOutput: 16384,
    lastUpdated: '2026-01-13',
    notes: 'Latest GPT-4 generation model',
  },

  // --- GPT-4 Turbo ---
  {
    provider: 'openai',
    model: 'gpt-4-turbo',
    displayName: 'GPT-4 Turbo',
    inputPricePerMillion: 10.00,
    outputPricePerMillion: 30.00,
    contextWindow: 128000,
    defaultMaxOutput: 4096,
    lastUpdated: '2026-01-13',
  },
  {
    provider: 'openai',
    model: 'gpt-4-turbo-2024-04-09',
    displayName: 'GPT-4 Turbo (Apr 2024)',
    inputPricePerMillion: 10.00,
    outputPricePerMillion: 30.00,
    contextWindow: 128000,
    defaultMaxOutput: 4096,
    lastUpdated: '2026-01-13',
  },
  {
    provider: 'openai',
    model: 'gpt-4-turbo-preview',
    displayName: 'GPT-4 Turbo Preview',
    inputPricePerMillion: 10.00,
    outputPricePerMillion: 30.00,
    contextWindow: 128000,
    defaultMaxOutput: 4096,
    lastUpdated: '2026-01-13',
    deprecated: true,
  },

  // --- GPT-4 (Original) ---
  {
    provider: 'openai',
    model: 'gpt-4',
    displayName: 'GPT-4',
    inputPricePerMillion: 30.00,
    outputPricePerMillion: 60.00,
    contextWindow: 8192,
    defaultMaxOutput: 4096,
    lastUpdated: '2026-01-13',
    deprecated: true,
    notes: 'Original GPT-4, use gpt-4-turbo instead',
  },
  {
    provider: 'openai',
    model: 'gpt-4-0613',
    displayName: 'GPT-4 (Jun 2023)',
    inputPricePerMillion: 30.00,
    outputPricePerMillion: 60.00,
    contextWindow: 8192,
    defaultMaxOutput: 4096,
    lastUpdated: '2026-01-13',
    deprecated: true,
  },
  {
    provider: 'openai',
    model: 'gpt-4-32k',
    displayName: 'GPT-4 32K',
    inputPricePerMillion: 60.00,
    outputPricePerMillion: 120.00,
    contextWindow: 32768,
    defaultMaxOutput: 4096,
    lastUpdated: '2026-01-13',
    deprecated: true,
  },

  // --- GPT-3.5 Turbo ---
  {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    displayName: 'GPT-3.5 Turbo',
    inputPricePerMillion: 0.50,
    outputPricePerMillion: 1.50,
    contextWindow: 16385,
    defaultMaxOutput: 4096,
    lastUpdated: '2026-01-13',
    notes: 'Fast and cost-effective for simple tasks',
  },
  {
    provider: 'openai',
    model: 'gpt-3.5-turbo-0125',
    displayName: 'GPT-3.5 Turbo (Jan 2025)',
    inputPricePerMillion: 0.50,
    outputPricePerMillion: 1.50,
    contextWindow: 16385,
    defaultMaxOutput: 4096,
    lastUpdated: '2026-01-13',
  },
  {
    provider: 'openai',
    model: 'gpt-3.5-turbo-1106',
    displayName: 'GPT-3.5 Turbo (Nov 2023)',
    inputPricePerMillion: 1.00,
    outputPricePerMillion: 2.00,
    contextWindow: 16385,
    defaultMaxOutput: 4096,
    lastUpdated: '2026-01-13',
    deprecated: true,
  },
  {
    provider: 'openai',
    model: 'gpt-3.5-turbo-instruct',
    displayName: 'GPT-3.5 Turbo Instruct',
    inputPricePerMillion: 1.50,
    outputPricePerMillion: 2.00,
    contextWindow: 4096,
    defaultMaxOutput: 4096,
    lastUpdated: '2026-01-13',
  },

  // --- o1 Reasoning Models ---
  {
    provider: 'openai',
    model: 'o1',
    displayName: 'o1',
    inputPricePerMillion: 15.00,
    outputPricePerMillion: 60.00,
    contextWindow: 200000,
    defaultMaxOutput: 100000,
    lastUpdated: '2026-01-13',
    notes: 'Advanced reasoning model with chain-of-thought',
  },
  {
    provider: 'openai',
    model: 'o1-2024-12-17',
    displayName: 'o1 (Dec 2024)',
    inputPricePerMillion: 15.00,
    outputPricePerMillion: 60.00,
    contextWindow: 200000,
    defaultMaxOutput: 100000,
    lastUpdated: '2026-01-13',
  },
  {
    provider: 'openai',
    model: 'o1-preview',
    displayName: 'o1 Preview',
    inputPricePerMillion: 15.00,
    outputPricePerMillion: 60.00,
    contextWindow: 128000,
    defaultMaxOutput: 32768,
    lastUpdated: '2026-01-13',
    deprecated: true,
  },
  {
    provider: 'openai',
    model: 'o1-mini',
    displayName: 'o1 Mini',
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 12.00,
    contextWindow: 128000,
    defaultMaxOutput: 65536,
    lastUpdated: '2026-01-13',
    notes: 'Faster, cheaper reasoning model',
  },
  {
    provider: 'openai',
    model: 'o1-mini-2024-09-12',
    displayName: 'o1 Mini (Sep 2024)',
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 12.00,
    contextWindow: 128000,
    defaultMaxOutput: 65536,
    lastUpdated: '2026-01-13',
  },

  // --- o3 Models (Latest reasoning) ---
  {
    provider: 'openai',
    model: 'o3',
    displayName: 'o3',
    inputPricePerMillion: 2.00,
    outputPricePerMillion: 8.00,
    contextWindow: 200000,
    defaultMaxOutput: 100000,
    lastUpdated: '2026-01-13',
    notes: 'Latest generation reasoning model',
  },
  {
    provider: 'openai',
    model: 'o3-mini',
    displayName: 'o3 Mini',
    inputPricePerMillion: 1.10,
    outputPricePerMillion: 4.40,
    contextWindow: 200000,
    defaultMaxOutput: 65536,
    lastUpdated: '2026-01-13',
  },

  // --- o4 Models ---
  {
    provider: 'openai',
    model: 'o4-mini',
    displayName: 'o4 Mini',
    inputPricePerMillion: 1.10,
    outputPricePerMillion: 4.40,
    contextWindow: 200000,
    defaultMaxOutput: 65536,
    lastUpdated: '2026-01-13',
  },

  // ==========================================================================
  // Anthropic Models
  // Source: https://claude.com/pricing and https://platform.claude.com/docs/en/about-claude/pricing
  // ==========================================================================

  // --- Claude 4.5 Series (Latest) ---
  {
    provider: 'anthropic',
    model: 'claude-opus-4-5-20251101',
    displayName: 'Claude Opus 4.5',
    inputPricePerMillion: 5.00,
    outputPricePerMillion: 25.00,
    contextWindow: 200000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
    notes: 'Most intelligent Claude model',
  },
  {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250514',
    displayName: 'Claude Sonnet 4.5',
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
    contextWindow: 200000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
    notes: 'Balanced performance and cost. Long context (>200K) pricing: $6/$22.50',
  },
  {
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251101',
    displayName: 'Claude Haiku 4.5',
    inputPricePerMillion: 1.00,
    outputPricePerMillion: 5.00,
    contextWindow: 200000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
    notes: 'Fastest, most cost-efficient Claude',
  },

  // --- Claude 4 Series ---
  {
    provider: 'anthropic',
    model: 'claude-opus-4-1-20251101',
    displayName: 'Claude Opus 4.1',
    inputPricePerMillion: 15.00,
    outputPricePerMillion: 75.00,
    contextWindow: 200000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
  },
  {
    provider: 'anthropic',
    model: 'claude-opus-4-20250514',
    displayName: 'Claude Opus 4',
    inputPricePerMillion: 15.00,
    outputPricePerMillion: 75.00,
    contextWindow: 200000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
  },
  {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    displayName: 'Claude Sonnet 4',
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
    contextWindow: 200000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
  },

  // --- Claude 3.7 Series ---
  {
    provider: 'anthropic',
    model: 'claude-3-7-sonnet-20250219',
    displayName: 'Claude 3.7 Sonnet',
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
    contextWindow: 200000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
    deprecated: true,
  },

  // --- Claude 3.5 Series ---
  {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet (Oct 2024)',
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
    contextWindow: 200000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
  },
  {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20240620',
    displayName: 'Claude 3.5 Sonnet (Jun 2024)',
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
    contextWindow: 200000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
  },
  {
    provider: 'anthropic',
    model: 'claude-3-5-haiku-20241022',
    displayName: 'Claude 3.5 Haiku',
    inputPricePerMillion: 0.80,
    outputPricePerMillion: 4.00,
    contextWindow: 200000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
  },

  // --- Claude 3 Series ---
  {
    provider: 'anthropic',
    model: 'claude-3-opus-20240229',
    displayName: 'Claude 3 Opus',
    inputPricePerMillion: 15.00,
    outputPricePerMillion: 75.00,
    contextWindow: 200000,
    defaultMaxOutput: 4096,
    lastUpdated: '2026-01-13',
    deprecated: true,
    notes: 'Deprecated - use Claude Opus 4.5 instead',
  },
  {
    provider: 'anthropic',
    model: 'claude-3-sonnet-20240229',
    displayName: 'Claude 3 Sonnet',
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
    contextWindow: 200000,
    defaultMaxOutput: 4096,
    lastUpdated: '2026-01-13',
    deprecated: true,
  },
  {
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    displayName: 'Claude 3 Haiku',
    inputPricePerMillion: 0.25,
    outputPricePerMillion: 1.25,
    contextWindow: 200000,
    defaultMaxOutput: 4096,
    lastUpdated: '2026-01-13',
    notes: 'Most cost-effective Claude 3 model',
  },

  // --- Common Claude Aliases ---
  {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet',
    displayName: 'Claude 3.5 Sonnet',
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
    contextWindow: 200000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
  },
  {
    provider: 'anthropic',
    model: 'claude-3-5-haiku',
    displayName: 'Claude 3.5 Haiku',
    inputPricePerMillion: 0.80,
    outputPricePerMillion: 4.00,
    contextWindow: 200000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
  },
  {
    provider: 'anthropic',
    model: 'claude-3-opus',
    displayName: 'Claude 3 Opus',
    inputPricePerMillion: 15.00,
    outputPricePerMillion: 75.00,
    contextWindow: 200000,
    defaultMaxOutput: 4096,
    lastUpdated: '2026-01-13',
    deprecated: true,
  },
  {
    provider: 'anthropic',
    model: 'claude-3-sonnet',
    displayName: 'Claude 3 Sonnet',
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
    contextWindow: 200000,
    defaultMaxOutput: 4096,
    lastUpdated: '2026-01-13',
    deprecated: true,
  },
  {
    provider: 'anthropic',
    model: 'claude-3-haiku',
    displayName: 'Claude 3 Haiku',
    inputPricePerMillion: 0.25,
    outputPricePerMillion: 1.25,
    contextWindow: 200000,
    defaultMaxOutput: 4096,
    lastUpdated: '2026-01-13',
  },

  // ==========================================================================
  // Google Models
  // Source: https://ai.google.dev/pricing
  // ==========================================================================

  // --- Gemini 2.5 Series (Latest) ---
  {
    provider: 'google',
    model: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 10.00,
    contextWindow: 1000000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
    notes: 'Premium pricing for >200K tokens: $2.50 input, $15 output',
  },
  {
    provider: 'google',
    model: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    inputPricePerMillion: 0.30,
    outputPricePerMillion: 2.50,
    contextWindow: 1000000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
  },

  // --- Gemini 2.0 Series ---
  {
    provider: 'google',
    model: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    inputPricePerMillion: 0.10,
    outputPricePerMillion: 0.40,
    contextWindow: 1000000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
    notes: 'Most cost-effective Gemini. Audio input: $0.70/MTok',
  },
  {
    provider: 'google',
    model: 'gemini-2.0-flash-lite',
    displayName: 'Gemini 2.0 Flash Lite',
    inputPricePerMillion: 0.08,
    outputPricePerMillion: 0.30,
    contextWindow: 1000000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
    notes: 'Cheapest Gemini option',
  },
  {
    provider: 'google',
    model: 'gemini-2.0-flash-exp',
    displayName: 'Gemini 2.0 Flash Experimental',
    inputPricePerMillion: 0.10,
    outputPricePerMillion: 0.40,
    contextWindow: 1000000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
  },

  // --- Gemini 1.5 Series ---
  {
    provider: 'google',
    model: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 5.00,
    contextWindow: 2000000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
    notes: '2M context window, premium for >128K tokens',
  },
  {
    provider: 'google',
    model: 'gemini-1.5-pro-latest',
    displayName: 'Gemini 1.5 Pro Latest',
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 5.00,
    contextWindow: 2000000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
  },
  {
    provider: 'google',
    model: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    inputPricePerMillion: 0.075,
    outputPricePerMillion: 0.30,
    contextWindow: 1000000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
    notes: 'Fast and cheap for most tasks',
  },
  {
    provider: 'google',
    model: 'gemini-1.5-flash-latest',
    displayName: 'Gemini 1.5 Flash Latest',
    inputPricePerMillion: 0.075,
    outputPricePerMillion: 0.30,
    contextWindow: 1000000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
  },
  {
    provider: 'google',
    model: 'gemini-1.5-flash-8b',
    displayName: 'Gemini 1.5 Flash 8B',
    inputPricePerMillion: 0.0375,
    outputPricePerMillion: 0.15,
    contextWindow: 1000000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
  },

  // --- Gemini 1.0 Series (Legacy) ---
  {
    provider: 'google',
    model: 'gemini-1.0-pro',
    displayName: 'Gemini 1.0 Pro',
    inputPricePerMillion: 0.50,
    outputPricePerMillion: 1.50,
    contextWindow: 32768,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
    deprecated: true,
  },
  {
    provider: 'google',
    model: 'gemini-pro',
    displayName: 'Gemini Pro',
    inputPricePerMillion: 0.50,
    outputPricePerMillion: 1.50,
    contextWindow: 32768,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
    deprecated: true,
  },

  // ==========================================================================
  // Mistral Models
  // Source: https://mistral.ai/pricing
  // ==========================================================================

  // --- Premier Models ---
  {
    provider: 'mistral',
    model: 'mistral-large-latest',
    displayName: 'Mistral Large 3',
    inputPricePerMillion: 0.50,
    outputPricePerMillion: 1.50,
    contextWindow: 128000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
    notes: 'Open-weight flagship model',
  },
  {
    provider: 'mistral',
    model: 'mistral-large',
    displayName: 'Mistral Large',
    inputPricePerMillion: 0.50,
    outputPricePerMillion: 1.50,
    contextWindow: 128000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
  },
  {
    provider: 'mistral',
    model: 'mistral-large-2411',
    displayName: 'Mistral Large (Nov 2024)',
    inputPricePerMillion: 0.50,
    outputPricePerMillion: 1.50,
    contextWindow: 128000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
  },
  {
    provider: 'mistral',
    model: 'mistral-medium-latest',
    displayName: 'Mistral Medium 3',
    inputPricePerMillion: 0.40,
    outputPricePerMillion: 2.00,
    contextWindow: 128000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
    notes: 'State-of-the-art at 8X lower cost',
  },
  {
    provider: 'mistral',
    model: 'mistral-medium',
    displayName: 'Mistral Medium',
    inputPricePerMillion: 0.40,
    outputPricePerMillion: 2.00,
    contextWindow: 128000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
  },
  {
    provider: 'mistral',
    model: 'mistral-small-latest',
    displayName: 'Mistral Small 3.2',
    inputPricePerMillion: 0.10,
    outputPricePerMillion: 0.30,
    contextWindow: 128000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
    notes: 'Multimodal, lightweight, open model',
  },
  {
    provider: 'mistral',
    model: 'mistral-small',
    displayName: 'Mistral Small',
    inputPricePerMillion: 0.10,
    outputPricePerMillion: 0.30,
    contextWindow: 128000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
  },

  // --- Ministral Series (Edge models) ---
  {
    provider: 'mistral',
    model: 'ministral-3b-latest',
    displayName: 'Ministral 3B',
    inputPricePerMillion: 0.10,
    outputPricePerMillion: 0.10,
    contextWindow: 128000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
  },
  {
    provider: 'mistral',
    model: 'ministral-3b',
    displayName: 'Ministral 3B',
    inputPricePerMillion: 0.10,
    outputPricePerMillion: 0.10,
    contextWindow: 128000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
  },
  {
    provider: 'mistral',
    model: 'ministral-8b-latest',
    displayName: 'Ministral 8B',
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.15,
    contextWindow: 128000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
  },
  {
    provider: 'mistral',
    model: 'ministral-8b',
    displayName: 'Ministral 8B',
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.15,
    contextWindow: 128000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
  },
  {
    provider: 'mistral',
    model: 'ministral-14b-latest',
    displayName: 'Ministral 14B',
    inputPricePerMillion: 0.20,
    outputPricePerMillion: 0.20,
    contextWindow: 128000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
  },
  {
    provider: 'mistral',
    model: 'ministral-14b',
    displayName: 'Ministral 14B',
    inputPricePerMillion: 0.20,
    outputPricePerMillion: 0.20,
    contextWindow: 128000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
  },

  // --- Specialized Models ---
  {
    provider: 'mistral',
    model: 'magistral-medium-latest',
    displayName: 'Magistral Medium',
    inputPricePerMillion: 2.00,
    outputPricePerMillion: 5.00,
    contextWindow: 128000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
    notes: 'Reasoning model',
  },
  {
    provider: 'mistral',
    model: 'codestral-latest',
    displayName: 'Codestral',
    inputPricePerMillion: 0.30,
    outputPricePerMillion: 0.90,
    contextWindow: 32000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
    notes: 'Specialized for code generation',
  },
  {
    provider: 'mistral',
    model: 'codestral',
    displayName: 'Codestral',
    inputPricePerMillion: 0.30,
    outputPricePerMillion: 0.90,
    contextWindow: 32000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
  },
  {
    provider: 'mistral',
    model: 'codestral-mamba-latest',
    displayName: 'Codestral Mamba',
    inputPricePerMillion: 0.25,
    outputPricePerMillion: 0.25,
    contextWindow: 256000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
    notes: 'Linear complexity architecture',
  },

  // --- Legacy Mistral Models ---
  {
    provider: 'mistral',
    model: 'open-mistral-7b',
    displayName: 'Mistral 7B',
    inputPricePerMillion: 0.25,
    outputPricePerMillion: 0.25,
    contextWindow: 32000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
    deprecated: true,
  },
  {
    provider: 'mistral',
    model: 'open-mixtral-8x7b',
    displayName: 'Mixtral 8x7B',
    inputPricePerMillion: 0.70,
    outputPricePerMillion: 0.70,
    contextWindow: 32000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
    deprecated: true,
  },
  {
    provider: 'mistral',
    model: 'open-mixtral-8x22b',
    displayName: 'Mixtral 8x22B',
    inputPricePerMillion: 2.00,
    outputPricePerMillion: 6.00,
    contextWindow: 64000,
    defaultMaxOutput: 8192,
    lastUpdated: '2026-01-13',
  },

  // ==========================================================================
  // Meta Llama Models (via providers like Together AI, DeepInfra, etc.)
  // Note: Llama models are open-source, pricing varies by hosting provider
  // These are representative prices from popular providers
  // ==========================================================================

  // --- Llama 3.1 Series ---
  {
    provider: 'meta',
    model: 'llama-3.1-405b-instruct',
    displayName: 'Llama 3.1 405B Instruct',
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 3.00,
    contextWindow: 131072,
    defaultMaxOutput: 4096,
    lastUpdated: '2026-01-13',
    notes: 'Pricing varies by provider. Representative Together AI pricing.',
  },
  {
    provider: 'meta',
    model: 'llama-3.1-405b',
    displayName: 'Llama 3.1 405B',
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 3.00,
    contextWindow: 131072,
    defaultMaxOutput: 4096,
    lastUpdated: '2026-01-13',
  },
  {
    provider: 'meta',
    model: 'llama-3.1-70b-instruct',
    displayName: 'Llama 3.1 70B Instruct',
    inputPricePerMillion: 0.88,
    outputPricePerMillion: 0.88,
    contextWindow: 131072,
    defaultMaxOutput: 4096,
    lastUpdated: '2026-01-13',
    notes: 'Pricing varies by provider. Representative Together AI pricing.',
  },
  {
    provider: 'meta',
    model: 'llama-3.1-70b',
    displayName: 'Llama 3.1 70B',
    inputPricePerMillion: 0.88,
    outputPricePerMillion: 0.88,
    contextWindow: 131072,
    defaultMaxOutput: 4096,
    lastUpdated: '2026-01-13',
  },
  {
    provider: 'meta',
    model: 'llama-3.1-8b-instruct',
    displayName: 'Llama 3.1 8B Instruct',
    inputPricePerMillion: 0.18,
    outputPricePerMillion: 0.18,
    contextWindow: 131072,
    defaultMaxOutput: 4096,
    lastUpdated: '2026-01-13',
    notes: 'Pricing varies by provider. Representative Together AI pricing.',
  },
  {
    provider: 'meta',
    model: 'llama-3.1-8b',
    displayName: 'Llama 3.1 8B',
    inputPricePerMillion: 0.18,
    outputPricePerMillion: 0.18,
    contextWindow: 131072,
    defaultMaxOutput: 4096,
    lastUpdated: '2026-01-13',
  },

  // --- Llama 3.2 Series (with vision) ---
  {
    provider: 'meta',
    model: 'llama-3.2-90b-vision-instruct',
    displayName: 'Llama 3.2 90B Vision',
    inputPricePerMillion: 1.20,
    outputPricePerMillion: 1.20,
    contextWindow: 131072,
    defaultMaxOutput: 4096,
    lastUpdated: '2026-01-13',
    notes: 'Multimodal with vision capabilities',
  },
  {
    provider: 'meta',
    model: 'llama-3.2-11b-vision-instruct',
    displayName: 'Llama 3.2 11B Vision',
    inputPricePerMillion: 0.18,
    outputPricePerMillion: 0.18,
    contextWindow: 131072,
    defaultMaxOutput: 4096,
    lastUpdated: '2026-01-13',
  },
  {
    provider: 'meta',
    model: 'llama-3.2-3b-instruct',
    displayName: 'Llama 3.2 3B',
    inputPricePerMillion: 0.06,
    outputPricePerMillion: 0.06,
    contextWindow: 131072,
    defaultMaxOutput: 4096,
    lastUpdated: '2026-01-13',
  },
  {
    provider: 'meta',
    model: 'llama-3.2-1b-instruct',
    displayName: 'Llama 3.2 1B',
    inputPricePerMillion: 0.04,
    outputPricePerMillion: 0.04,
    contextWindow: 131072,
    defaultMaxOutput: 4096,
    lastUpdated: '2026-01-13',
  },

  // --- Llama 3.3 Series ---
  {
    provider: 'meta',
    model: 'llama-3.3-70b-instruct',
    displayName: 'Llama 3.3 70B',
    inputPricePerMillion: 0.60,
    outputPricePerMillion: 0.60,
    contextWindow: 131072,
    defaultMaxOutput: 4096,
    lastUpdated: '2026-01-13',
    notes: 'Latest Llama generation',
  },

  // --- DeepInfra-specific Llama pricing (alternative provider) ---
  {
    provider: 'meta',
    model: 'meta-llama/Llama-3.1-70B-Instruct',
    displayName: 'Llama 3.1 70B (DeepInfra)',
    inputPricePerMillion: 0.04,
    outputPricePerMillion: 0.04,
    contextWindow: 131072,
    defaultMaxOutput: 4096,
    lastUpdated: '2026-01-13',
    notes: 'DeepInfra pricing - much cheaper than other providers',
  },
  {
    provider: 'meta',
    model: 'meta-llama/Llama-3.1-8B-Instruct',
    displayName: 'Llama 3.1 8B (DeepInfra)',
    inputPricePerMillion: 0.003,
    outputPricePerMillion: 0.005,
    contextWindow: 131072,
    defaultMaxOutput: 4096,
    lastUpdated: '2026-01-13',
    notes: 'DeepInfra pricing',
  },
];

// ============================================================================
// Lookup Maps for Fast Access
// ============================================================================

const pricingByModel = new Map<string, ModelPricing>();
const pricingByProviderModel = new Map<string, ModelPricing>();

for (const pricing of PRICING_DATA) {
  // Store by provider:model key
  pricingByProviderModel.set(`${pricing.provider}:${pricing.model}`, pricing);
  // Also store by model name alone (will be overwritten if same model name exists for multiple providers)
  pricingByModel.set(pricing.model, pricing);
}

// ============================================================================
// Model Aliases
// Maps common shorthand names to canonical model names
// ============================================================================

const MODEL_ALIASES: Record<string, { provider: Provider; model: string }> = {
  // OpenAI aliases
  'gpt4o': { provider: 'openai', model: 'gpt-4o' },
  'gpt4o-mini': { provider: 'openai', model: 'gpt-4o-mini' },
  'gpt4-turbo': { provider: 'openai', model: 'gpt-4-turbo' },
  'gpt4': { provider: 'openai', model: 'gpt-4' },
  'gpt35': { provider: 'openai', model: 'gpt-3.5-turbo' },
  'gpt-35-turbo': { provider: 'openai', model: 'gpt-3.5-turbo' },

  // Anthropic aliases
  'claude-opus': { provider: 'anthropic', model: 'claude-opus-4-5-20251101' },
  'claude-sonnet': { provider: 'anthropic', model: 'claude-sonnet-4-5-20250514' },
  'claude-haiku': { provider: 'anthropic', model: 'claude-haiku-4-5-20251101' },
  'claude-3.5-sonnet': { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
  'claude-3.5-haiku': { provider: 'anthropic', model: 'claude-3-5-haiku-20241022' },

  // Google aliases
  'gemini-pro': { provider: 'google', model: 'gemini-1.5-pro' },
  'gemini-flash': { provider: 'google', model: 'gemini-2.0-flash' },
  'gemini': { provider: 'google', model: 'gemini-2.0-flash' },

  // Mistral aliases
  'mistral': { provider: 'mistral', model: 'mistral-large-latest' },

  // Llama aliases
  'llama-405b': { provider: 'meta', model: 'llama-3.1-405b-instruct' },
  'llama-70b': { provider: 'meta', model: 'llama-3.1-70b-instruct' },
  'llama-8b': { provider: 'meta', model: 'llama-3.1-8b-instruct' },
  'llama3': { provider: 'meta', model: 'llama-3.1-70b-instruct' },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get pricing for a specific model
 * @param model - Model identifier (e.g., 'gpt-4o', 'claude-3-5-sonnet-20241022')
 * @returns ModelPricing object or null if not found
 */
export function getModelPricing(model: string): ModelPricing | null {
  // Check direct match first
  const direct = pricingByModel.get(model);
  if (direct) return direct;

  // Check aliases
  const alias = MODEL_ALIASES[model.toLowerCase()];
  if (alias) {
    return pricingByProviderModel.get(`${alias.provider}:${alias.model}`) ?? null;
  }

  // Try partial matching for versioned models
  const modelLower = model.toLowerCase();

  // OpenAI patterns
  if (modelLower.includes('gpt-4o-mini') || modelLower.startsWith('gpt-4o-mini')) {
    return pricingByModel.get('gpt-4o-mini') ?? null;
  }
  if (modelLower.includes('gpt-4o') || modelLower.startsWith('gpt-4o')) {
    return pricingByModel.get('gpt-4o') ?? null;
  }
  if (modelLower.includes('gpt-4-turbo')) {
    return pricingByModel.get('gpt-4-turbo') ?? null;
  }
  if (modelLower.includes('gpt-4')) {
    return pricingByModel.get('gpt-4') ?? null;
  }
  if (modelLower.includes('gpt-3.5')) {
    return pricingByModel.get('gpt-3.5-turbo') ?? null;
  }
  if (modelLower.startsWith('o1-mini')) {
    return pricingByModel.get('o1-mini') ?? null;
  }
  if (modelLower.startsWith('o1')) {
    return pricingByModel.get('o1') ?? null;
  }
  if (modelLower.startsWith('o3-mini')) {
    return pricingByModel.get('o3-mini') ?? null;
  }
  if (modelLower.startsWith('o3')) {
    return pricingByModel.get('o3') ?? null;
  }

  // Anthropic patterns
  if (modelLower.includes('opus-4-5') || modelLower.includes('opus-4.5')) {
    return pricingByProviderModel.get('anthropic:claude-opus-4-5-20251101') ?? null;
  }
  if (modelLower.includes('sonnet-4-5') || modelLower.includes('sonnet-4.5')) {
    return pricingByProviderModel.get('anthropic:claude-sonnet-4-5-20250514') ?? null;
  }
  if (modelLower.includes('haiku-4-5') || modelLower.includes('haiku-4.5')) {
    return pricingByProviderModel.get('anthropic:claude-haiku-4-5-20251101') ?? null;
  }
  if (modelLower.includes('claude-3-5-sonnet') || modelLower.includes('claude-3.5-sonnet')) {
    return pricingByProviderModel.get('anthropic:claude-3-5-sonnet-20241022') ?? null;
  }
  if (modelLower.includes('claude-3-5-haiku') || modelLower.includes('claude-3.5-haiku')) {
    return pricingByProviderModel.get('anthropic:claude-3-5-haiku-20241022') ?? null;
  }
  if (modelLower.includes('claude-3-opus')) {
    return pricingByProviderModel.get('anthropic:claude-3-opus-20240229') ?? null;
  }
  if (modelLower.includes('claude-3-sonnet')) {
    return pricingByProviderModel.get('anthropic:claude-3-sonnet-20240229') ?? null;
  }
  if (modelLower.includes('claude-3-haiku')) {
    return pricingByProviderModel.get('anthropic:claude-3-haiku-20240307') ?? null;
  }

  // Google patterns
  if (modelLower.includes('gemini-2.5-pro')) {
    return pricingByModel.get('gemini-2.5-pro') ?? null;
  }
  if (modelLower.includes('gemini-2.5-flash')) {
    return pricingByModel.get('gemini-2.5-flash') ?? null;
  }
  if (modelLower.includes('gemini-2.0-flash')) {
    return pricingByModel.get('gemini-2.0-flash') ?? null;
  }
  if (modelLower.includes('gemini-1.5-pro')) {
    return pricingByModel.get('gemini-1.5-pro') ?? null;
  }
  if (modelLower.includes('gemini-1.5-flash')) {
    return pricingByModel.get('gemini-1.5-flash') ?? null;
  }

  // Mistral patterns
  if (modelLower.includes('mistral-large')) {
    return pricingByModel.get('mistral-large-latest') ?? null;
  }
  if (modelLower.includes('mistral-medium')) {
    return pricingByModel.get('mistral-medium-latest') ?? null;
  }
  if (modelLower.includes('mistral-small')) {
    return pricingByModel.get('mistral-small-latest') ?? null;
  }

  // Llama patterns
  if (modelLower.includes('llama-3.1-405b') || modelLower.includes('llama-3-1-405b')) {
    return pricingByModel.get('llama-3.1-405b-instruct') ?? null;
  }
  if (modelLower.includes('llama-3.1-70b') || modelLower.includes('llama-3-1-70b')) {
    return pricingByModel.get('llama-3.1-70b-instruct') ?? null;
  }
  if (modelLower.includes('llama-3.1-8b') || modelLower.includes('llama-3-1-8b')) {
    return pricingByModel.get('llama-3.1-8b-instruct') ?? null;
  }

  return null;
}

/**
 * Get pricing for a model from a specific provider
 * @param provider - Provider name
 * @param model - Model identifier
 * @returns ModelPricing object or null if not found
 */
export function getModelPricingByProvider(provider: Provider, model: string): ModelPricing | null {
  return pricingByProviderModel.get(`${provider}:${model}`) ?? getModelPricing(model);
}

/**
 * Calculate cost for a given number of tokens
 * @param model - Model identifier
 * @param inputTokens - Number of input/prompt tokens
 * @param outputTokens - Number of output/completion tokens
 * @returns Cost breakdown in USD, or null if model not found
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): { inputCost: number; outputCost: number; totalCost: number } | null {
  const pricing = getModelPricing(model);
  if (!pricing) return null;

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePerMillion;
  const totalCost = inputCost + outputCost;

  return {
    inputCost: Math.round(inputCost * 1_000_000) / 1_000_000,
    outputCost: Math.round(outputCost * 1_000_000) / 1_000_000,
    totalCost: Math.round(totalCost * 1_000_000) / 1_000_000,
  };
}

/**
 * Calculate cost with provider specification
 * @param provider - Provider name
 * @param model - Model identifier
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Cost breakdown in USD
 */
export function calculateCostByProvider(
  provider: Provider,
  model: string,
  inputTokens: number,
  outputTokens: number
): { inputCostUsd: number; outputCostUsd: number; totalCostUsd: number } {
  const pricing = getModelPricingByProvider(provider, model);

  // Use default pricing if model not found
  const inputPrice = pricing?.inputPricePerMillion ?? 2.50;
  const outputPrice = pricing?.outputPricePerMillion ?? 10.00;

  const inputCostUsd = (inputTokens / 1_000_000) * inputPrice;
  const outputCostUsd = (outputTokens / 1_000_000) * outputPrice;
  const totalCostUsd = inputCostUsd + outputCostUsd;

  return {
    inputCostUsd: Math.round(inputCostUsd * 1_000_000) / 1_000_000,
    outputCostUsd: Math.round(outputCostUsd * 1_000_000) / 1_000_000,
    totalCostUsd: Math.round(totalCostUsd * 1_000_000) / 1_000_000,
  };
}

/**
 * List all models, optionally filtered by provider
 * @param provider - Optional provider to filter by
 * @returns Array of ModelPricing objects
 */
export function listModels(provider?: Provider): ModelPricing[] {
  if (provider) {
    return PRICING_DATA.filter((p) => p.provider === provider);
  }
  return [...PRICING_DATA];
}

/**
 * Get all pricing data
 * @returns Array of all ModelPricing objects
 */
export function getAllPricing(): ModelPricing[] {
  return [...PRICING_DATA];
}

/**
 * Get pricing for all non-deprecated models
 * @returns Array of ModelPricing objects for active models
 */
export function getActiveModels(): ModelPricing[] {
  return PRICING_DATA.filter((p) => !p.deprecated);
}

/**
 * Get the cheapest model for a given provider
 * @param provider - Provider to search
 * @returns Cheapest ModelPricing or null
 */
export function getCheapestModel(provider?: Provider): ModelPricing | null {
  const models = provider ? listModels(provider) : getActiveModels();
  if (models.length === 0) return null;

  return models.reduce((cheapest, current) => {
    const cheapestAvg =
      (cheapest.inputPricePerMillion + cheapest.outputPricePerMillion) / 2;
    const currentAvg =
      (current.inputPricePerMillion + current.outputPricePerMillion) / 2;
    return currentAvg < cheapestAvg ? current : cheapest;
  });
}

/**
 * Estimate cost for a conversation with estimated output
 * @param model - Model identifier
 * @param inputTokens - Number of input tokens
 * @param estimatedOutputTokens - Estimated output tokens
 * @param confidenceMultiplier - Multiplier for conservative estimates (default 1.25)
 * @returns Estimated cost with confidence range
 */
export function estimateCost(
  model: string,
  inputTokens: number,
  estimatedOutputTokens: number,
  confidenceMultiplier: number = 1.25
): {
  estimated: number;
  minimum: number;
  maximum: number;
  confidence: 'high' | 'medium' | 'low';
} | null {
  const pricing = getModelPricing(model);
  if (!pricing) return null;

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePerMillion;
  const outputCost = (estimatedOutputTokens / 1_000_000) * pricing.outputPricePerMillion;

  const estimated = inputCost + outputCost;
  const minimum = inputCost + outputCost * 0.5; // Output could be half
  const maximum = inputCost + outputCost * confidenceMultiplier;

  // Determine confidence based on output estimation variance
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  if (estimatedOutputTokens < 500) {
    confidence = 'high'; // Short outputs are more predictable
  } else if (estimatedOutputTokens > 4000) {
    confidence = 'low'; // Long outputs have more variance
  }

  return {
    estimated: Math.round(estimated * 1_000_000) / 1_000_000,
    minimum: Math.round(minimum * 1_000_000) / 1_000_000,
    maximum: Math.round(maximum * 1_000_000) / 1_000_000,
    confidence,
  };
}

/**
 * Get context window for a model
 * @param model - Model identifier
 * @returns Context window in tokens, or null if not found
 */
export function getContextWindow(model: string): number | null {
  const pricing = getModelPricing(model);
  return pricing?.contextWindow ?? null;
}

/**
 * Check if a model exists in the database
 * @param model - Model identifier
 * @returns boolean
 */
export function modelExists(model: string): boolean {
  return getModelPricing(model) !== null;
}

/**
 * Get all supported providers
 * @returns Array of provider names
 */
export function getSupportedProviders(): Provider[] {
  return ['openai', 'anthropic', 'google', 'mistral', 'meta'];
}

// ============================================================================
// Backward Compatibility Exports
// These maintain compatibility with the existing codebase
// ============================================================================

/**
 * @deprecated Use getModelPricingByProvider instead
 */
export function getModelPricingWithFallback(
  provider: Provider,
  model: string
): ModelPricing {
  const pricing = getModelPricingByProvider(provider, model);
  if (pricing) return pricing;

  // Return a default fallback
  return {
    provider,
    model,
    inputPricePerMillion: 2.50,
    outputPricePerMillion: 10.00,
    contextWindow: 128000,
    lastUpdated: '2026-01-13',
    notes: 'Unknown model - using default pricing',
  };
}

/**
 * @deprecated Use listModels instead
 */
export function getModelsForProvider(provider: Provider): ModelPricing[] {
  return listModels(provider);
}
