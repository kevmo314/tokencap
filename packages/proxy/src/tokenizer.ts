/**
 * Token Counting Module
 * Uses tiktoken for OpenAI models, approximation for Anthropic
 * MIT License
 */

import { get_encoding, type Tiktoken } from 'tiktoken';
import type {
  Provider,
  OpenAIChatRequest,
  OpenAIMessage,
  AnthropicMessagesRequest,
  AnthropicMessage,
  AnthropicContentBlock,
  CostEstimate,
} from './types.js';
import { getModelPricingWithFallback, calculateCostByProvider } from './pricing.js';

// Cache encodings to avoid repeated initialization
let cl100kEncoder: Tiktoken | null = null;
let o200kEncoder: Tiktoken | null = null;

/**
 * Get the appropriate tiktoken encoder for a model
 */
function getEncoder(model: string): Tiktoken {
  const modelLower = model.toLowerCase();

  // o200k_base is used by gpt-4o and o1 models
  if (modelLower.includes('gpt-4o') || modelLower.includes('o1')) {
    if (!o200kEncoder) {
      o200kEncoder = get_encoding('o200k_base');
    }
    return o200kEncoder;
  }

  // cl100k_base for GPT-4, GPT-3.5-turbo, and most other models
  if (!cl100kEncoder) {
    cl100kEncoder = get_encoding('cl100k_base');
  }
  return cl100kEncoder;
}

/**
 * Count tokens in a string using tiktoken
 */
export function countTokens(text: string, model: string = 'gpt-4o'): number {
  if (!text) return 0;
  const encoder = getEncoder(model);
  return encoder.encode(text).length;
}

/**
 * Count tokens for OpenAI chat messages
 * Based on: https://github.com/openai/openai-cookbook/blob/main/examples/How_to_count_tokens_with_tiktoken.ipynb
 */
export function countOpenAIMessageTokens(
  messages: OpenAIMessage[],
  model: string
): number {
  const encoder = getEncoder(model);
  const modelLower = model.toLowerCase();

  // Token overhead per message varies by model
  let tokensPerMessage = 3; // Default for gpt-3.5-turbo-0613 and gpt-4-0613
  let tokensPerName = 1;

  if (modelLower.includes('gpt-3.5-turbo-0301')) {
    tokensPerMessage = 4;
    tokensPerName = -1; // No name in this version
  }

  let totalTokens = 0;

  for (const message of messages) {
    totalTokens += tokensPerMessage;

    // Count role
    totalTokens += encoder.encode(message.role).length;

    // Count content
    if (message.content) {
      totalTokens += encoder.encode(message.content).length;
    }

    // Count name if present
    if (message.name) {
      totalTokens += encoder.encode(message.name).length;
      totalTokens += tokensPerName;
    }

    // Count function_call if present
    if (message.function_call) {
      totalTokens += encoder.encode(message.function_call.name).length;
      totalTokens += encoder.encode(message.function_call.arguments).length;
      totalTokens += 3; // Overhead for function_call structure
    }

    // Count tool_calls if present
    if (message.tool_calls) {
      for (const toolCall of message.tool_calls) {
        totalTokens += encoder.encode(toolCall.function.name).length;
        totalTokens += encoder.encode(toolCall.function.arguments).length;
        totalTokens += 5; // Overhead for tool_call structure
      }
    }
  }

  // Every reply is primed with <|start|>assistant<|message|>
  totalTokens += 3;

  return totalTokens;
}

/**
 * Count tokens for OpenAI function/tool definitions
 */
function countOpenAIFunctionsTokens(
  functions: OpenAIChatRequest['functions'],
  tools: OpenAIChatRequest['tools'],
  model: string
): number {
  const encoder = getEncoder(model);
  let tokens = 0;

  if (functions) {
    for (const fn of functions) {
      tokens += encoder.encode(fn.name).length;
      if (fn.description) {
        tokens += encoder.encode(fn.description).length;
      }
      if (fn.parameters) {
        tokens += encoder.encode(JSON.stringify(fn.parameters)).length;
      }
      tokens += 5; // Overhead per function
    }
    tokens += 9; // Base overhead for functions array
  }

  if (tools) {
    for (const tool of tools) {
      tokens += encoder.encode(tool.function.name).length;
      if (tool.function.description) {
        tokens += encoder.encode(tool.function.description).length;
      }
      if (tool.function.parameters) {
        tokens += encoder.encode(JSON.stringify(tool.function.parameters)).length;
      }
      tokens += 7; // Overhead per tool
    }
    tokens += 9; // Base overhead for tools array
  }

  return tokens;
}

/**
 * Count tokens for a complete OpenAI chat request
 */
export function countOpenAIRequestTokens(request: OpenAIChatRequest): number {
  let tokens = countOpenAIMessageTokens(request.messages, request.model);
  tokens += countOpenAIFunctionsTokens(request.functions, request.tools, request.model);
  return tokens;
}

/**
 * Extract text from Anthropic content blocks
 */
function extractAnthropicText(content: string | AnthropicContentBlock[]): string {
  if (typeof content === 'string') {
    return content;
  }

  return content
    .map(block => {
      if (block.type === 'text' && block.text) {
        return block.text;
      }
      if (block.type === 'tool_use') {
        return `${block.name || ''} ${JSON.stringify(block.input || {})}`;
      }
      if (block.type === 'tool_result') {
        if (typeof block.content === 'string') {
          return block.content;
        }
        if (Array.isArray(block.content)) {
          return extractAnthropicText(block.content);
        }
      }
      return '';
    })
    .join(' ');
}

/**
 * Count tokens for Anthropic messages
 * Anthropic uses a similar tokenizer to OpenAI, so we use cl100k_base as approximation
 * Note: This is an approximation - Anthropic's exact tokenizer is not publicly available
 */
export function countAnthropicMessageTokens(messages: AnthropicMessage[]): number {
  if (!cl100kEncoder) {
    cl100kEncoder = get_encoding('cl100k_base');
  }

  let tokens = 0;

  for (const message of messages) {
    // Role overhead
    tokens += 4;

    // Content
    const text = extractAnthropicText(message.content);
    tokens += cl100kEncoder.encode(text).length;
  }

  return tokens;
}

/**
 * Count tokens for Anthropic tools
 */
function countAnthropicToolsTokens(
  tools: AnthropicMessagesRequest['tools']
): number {
  if (!tools) return 0;
  if (!cl100kEncoder) {
    cl100kEncoder = get_encoding('cl100k_base');
  }

  let tokens = 0;

  for (const tool of tools) {
    tokens += cl100kEncoder.encode(tool.name).length;
    if (tool.description) {
      tokens += cl100kEncoder.encode(tool.description).length;
    }
    tokens += cl100kEncoder.encode(JSON.stringify(tool.input_schema)).length;
    tokens += 10; // Overhead per tool
  }

  return tokens;
}

/**
 * Count tokens for a complete Anthropic messages request
 */
export function countAnthropicRequestTokens(request: AnthropicMessagesRequest): number {
  if (!cl100kEncoder) {
    cl100kEncoder = get_encoding('cl100k_base');
  }

  let tokens = 0;

  // System prompt
  if (request.system) {
    tokens += cl100kEncoder.encode(request.system).length;
    tokens += 4; // System overhead
  }

  // Messages
  tokens += countAnthropicMessageTokens(request.messages);

  // Tools
  tokens += countAnthropicToolsTokens(request.tools);

  return tokens;
}

/**
 * Estimate output tokens for a request
 * Uses max_tokens if specified, otherwise uses model default with confidence adjustment
 */
export function estimateOutputTokens(
  provider: Provider,
  model: string,
  maxTokens?: number
): { tokens: number; confidence: 'high' | 'medium' | 'low' } {
  const pricing = getModelPricingWithFallback(provider, model);

  if (maxTokens !== undefined) {
    // User specified max_tokens - use 75% as estimate with high confidence
    return {
      tokens: Math.ceil(maxTokens * 0.75),
      confidence: 'high',
    };
  }

  // No max_tokens specified - use 50% of model default with medium confidence
  const defaultOutput = pricing.defaultMaxOutput ?? 4096;
  return {
    tokens: Math.ceil(defaultOutput * 0.5),
    confidence: 'medium',
  };
}

/**
 * Get complete cost estimate for an OpenAI request
 */
export function estimateOpenAICost(request: OpenAIChatRequest): CostEstimate {
  const inputTokens = countOpenAIRequestTokens(request);
  const outputEstimate = estimateOutputTokens('openai', request.model, request.max_tokens);
  const cost = calculateCostByProvider('openai', request.model, inputTokens, outputEstimate.tokens);

  return {
    provider: 'openai',
    model: request.model,
    inputTokens,
    estimatedOutputTokens: outputEstimate.tokens,
    inputCostUsd: cost.inputCostUsd,
    estimatedOutputCostUsd: cost.outputCostUsd,
    totalEstimatedCostUsd: cost.totalCostUsd,
    confidence: outputEstimate.confidence,
  };
}

/**
 * Get complete cost estimate for an Anthropic request
 */
export function estimateAnthropicCost(request: AnthropicMessagesRequest): CostEstimate {
  const inputTokens = countAnthropicRequestTokens(request);
  const outputEstimate = estimateOutputTokens('anthropic', request.model, request.max_tokens);
  const cost = calculateCostByProvider('anthropic', request.model, inputTokens, outputEstimate.tokens);

  return {
    provider: 'anthropic',
    model: request.model,
    inputTokens,
    estimatedOutputTokens: outputEstimate.tokens,
    inputCostUsd: cost.inputCostUsd,
    estimatedOutputCostUsd: cost.outputCostUsd,
    totalEstimatedCostUsd: cost.totalCostUsd,
    confidence: outputEstimate.confidence,
  };
}

/**
 * Cleanup encoders (for graceful shutdown)
 */
export function cleanupEncoders(): void {
  if (cl100kEncoder) {
    cl100kEncoder.free();
    cl100kEncoder = null;
  }
  if (o200kEncoder) {
    o200kEncoder.free();
    o200kEncoder = null;
  }
}
