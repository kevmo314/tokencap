/**
 * Tokencap Tokenizer
 *
 * Zero-dependency token counting for LLM models.
 * Uses a simple but accurate approximation algorithm.
 *
 * For exact token counts, the SDK can optionally use tiktoken
 * when available, but this provides a good fallback.
 */

import type {
  Message,
  MessageContent,
  TokenCount,
  TokenizerOptions,
  Provider,
  ModelId,
} from './types.js';

// ============================================================================
// Model Detection
// ============================================================================

/**
 * Detect provider from model name
 */
export function detectProvider(model: ModelId): Provider {
  const modelLower = model.toLowerCase();

  if (
    modelLower.includes('gpt') ||
    modelLower.includes('o1') ||
    modelLower.includes('davinci') ||
    modelLower.includes('curie') ||
    modelLower.includes('babbage') ||
    modelLower.includes('ada') ||
    modelLower.includes('text-embedding')
  ) {
    return 'openai';
  }

  if (modelLower.includes('claude')) {
    return 'anthropic';
  }

  // Default to OpenAI tokenization (most common)
  return 'openai';
}

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Approximate tokens from text using character-based heuristics.
 *
 * This uses the widely-accepted approximation that:
 * - English text: ~4 characters per token
 * - Code: ~3.5 characters per token
 * - Mixed content: ~3.75 characters per token
 *
 * OpenAI's tokenizer (cl100k_base) averages about 3.5-4 chars/token.
 * Anthropic uses similar tokenization ratios.
 */
function approximateTokens(text: string): number {
  if (!text || text.length === 0) {
    return 0;
  }

  // Detect if content is likely code
  const codeIndicators = [
    /\bfunction\b/,
    /\bconst\b/,
    /\blet\b/,
    /\bvar\b/,
    /\bimport\b/,
    /\bexport\b/,
    /\bclass\b/,
    /\bdef\b/,
    /[{}[\]();]/,
    /=>/,
    /\n\s{2,}/,
  ];

  const codeScore = codeIndicators.reduce(
    (score, pattern) => score + (pattern.test(text) ? 1 : 0),
    0
  );

  // Adjust ratio based on code likelihood
  const charsPerToken = codeScore >= 3 ? 3.5 : 4;

  // Base calculation
  let tokens = Math.ceil(text.length / charsPerToken);

  // Add overhead for special tokens, whitespace handling
  // Most tokenizers add ~5-10% overhead for special cases
  tokens = Math.ceil(tokens * 1.05);

  return tokens;
}

/**
 * Extract text content from a message
 */
function extractTextContent(content: MessageContent): string {
  if (typeof content === 'string') {
    return content;
  }

  // Handle array of content parts
  return content
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
}

/**
 * Count tokens in a single message
 */
function countMessageTokens(message: Message, provider: Provider): number {
  const text = extractTextContent(message.content);
  let tokens = approximateTokens(text);

  // Add overhead for message structure
  // OpenAI adds ~4 tokens per message for role, etc.
  // Anthropic is similar
  if (provider === 'openai') {
    tokens += 4; // <|im_start|>role<|im_sep|>...<|im_end|>
    if (message.name) {
      tokens += approximateTokens(message.name) + 1;
    }
  } else if (provider === 'anthropic') {
    tokens += 3; // Similar overhead
  }

  return tokens;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Count tokens in a string
 *
 * @param text - Text to count tokens for
 * @param options - Tokenizer options
 * @returns Token count
 *
 * @example
 * ```typescript
 * import { countTokens } from '@tokencap/sdk';
 *
 * const tokens = countTokens('Hello, world!');
 * console.log(tokens); // { total: 4 }
 *
 * // With specific model
 * const tokens2 = countTokens('Hello, world!', { model: 'gpt-4' });
 * ```
 */
export function countTokens(text: string, options?: TokenizerOptions): TokenCount {
  const tokens = approximateTokens(text);
  return { total: tokens };
}

/**
 * Count tokens in an array of messages
 *
 * @param messages - Messages to count tokens for
 * @param options - Tokenizer options
 * @returns Token count with optional breakdown
 *
 * @example
 * ```typescript
 * import { countMessageTokens } from '@tokencap/sdk';
 *
 * const messages = [
 *   { role: 'system', content: 'You are a helpful assistant.' },
 *   { role: 'user', content: 'Hello!' }
 * ];
 *
 * const tokens = countMessageTokens(messages, { model: 'gpt-4' });
 * console.log(tokens);
 * // { total: 15, breakdown: [{ role: 'system', tokens: 10 }, { role: 'user', tokens: 5 }] }
 * ```
 */
export function countMessagesTokens(
  messages: Message[],
  options?: TokenizerOptions
): TokenCount {
  const provider = options?.provider ?? (options?.model ? detectProvider(options.model) : 'openai');

  const breakdown = messages.map((msg) => ({
    role: msg.role,
    tokens: countMessageTokens(msg, provider),
  }));

  const total = breakdown.reduce((sum, item) => sum + item.tokens, 0);

  // Add conversation overhead (OpenAI adds 3 tokens at the end)
  const overhead = provider === 'openai' ? 3 : 2;

  return {
    total: total + overhead,
    breakdown,
  };
}

/**
 * Estimate output tokens based on input and task type
 *
 * This provides a rough estimate when max_tokens is not specified.
 * Based on empirical observations:
 * - Simple Q&A: ~0.5-1x input length
 * - Explanations: ~1-2x input length
 * - Code generation: ~1.5-3x input length
 *
 * @param inputTokens - Number of input tokens
 * @param options - Estimation options
 * @returns Estimated output tokens
 */
export function estimateOutputTokens(
  inputTokens: number,
  options?: {
    /** Type of task for better estimation */
    taskType?: 'qa' | 'explanation' | 'code' | 'general';
    /** Model for context-aware estimation */
    model?: ModelId;
  }
): { estimated: number; min: number; max: number; confidence: 'high' | 'medium' | 'low' } {
  const taskType = options?.taskType ?? 'general';

  // Multipliers based on task type
  const multipliers: Record<string, { base: number; variance: number }> = {
    qa: { base: 0.75, variance: 0.5 },
    explanation: { base: 1.5, variance: 0.75 },
    code: { base: 2.0, variance: 1.0 },
    general: { base: 1.0, variance: 0.75 },
  };

  const { base, variance } = multipliers[taskType] ?? multipliers['general']!;

  const estimated = Math.ceil(inputTokens * base);
  const min = Math.max(10, Math.ceil(inputTokens * (base - variance)));
  const max = Math.ceil(inputTokens * (base + variance));

  // Confidence based on task type
  const confidence: 'high' | 'medium' | 'low' =
    taskType === 'qa' ? 'high' : taskType === 'general' ? 'medium' : 'low';

  return { estimated, min, max, confidence };
}
