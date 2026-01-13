/**
 * Tokencap SDK Types
 *
 * Core type definitions for the Tokencap cost optimization SDK.
 */

// ============================================================================
// Provider Types
// ============================================================================

/**
 * Supported LLM providers
 */
export type Provider = 'openai' | 'anthropic';

/**
 * Model identifier - provider-specific model names
 */
export type ModelId = string;

// ============================================================================
// Message Types (Provider-agnostic)
// ============================================================================

/**
 * Role in a conversation
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Content can be text or structured content parts
 */
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

/**
 * Message content - either string or array of content parts
 */
export type MessageContent = string | ContentPart[];

/**
 * A single message in a conversation
 */
export interface Message {
  role: MessageRole;
  content: MessageContent;
  name?: string;
}

// ============================================================================
// Cost Estimation Types
// ============================================================================

/**
 * Request parameters for cost estimation
 */
export interface EstimateRequest {
  /** Model identifier (e.g., 'gpt-4', 'claude-3-opus-20240229') */
  model: ModelId;
  /** Conversation messages */
  messages: Message[];
  /** Maximum tokens to generate (optional, used for output estimation) */
  max_tokens?: number;
  /** System prompt (alternative to system message) */
  system?: string;
}

/**
 * Cost estimate result
 */
export interface CostEstimate {
  /** Number of input tokens */
  inputTokens: number;
  /** Estimated output tokens (based on max_tokens or heuristics) */
  outputTokens: number;
  /** Estimated total cost in USD */
  estimatedCost: number;
  /** Input cost component */
  inputCost: number;
  /** Output cost component */
  outputCost: number;
  /** Model used for estimate */
  model: ModelId;
  /** Confidence level of the estimate */
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Actual cost from a completed request
 */
export interface ActualCost {
  /** Input tokens used */
  inputTokens: number;
  /** Output tokens generated */
  outputTokens: number;
  /** Total cost in USD */
  totalCost: number;
  /** Model used */
  model: ModelId;
  /** Request ID for tracking */
  requestId?: string;
}

// ============================================================================
// Budget Types
// ============================================================================

/**
 * Budget configuration
 */
export interface BudgetConfig {
  /** Maximum budget in USD */
  limit: number;
  /** Warning threshold as percentage (0-1), default 0.8 */
  warningThreshold?: number;
  /** Action when budget exceeded */
  onExceeded?: 'block' | 'warn';
}

/**
 * Budget status
 */
export interface BudgetStatus {
  /** Total spent in USD */
  spent: number;
  /** Remaining budget in USD */
  remaining: number;
  /** Budget limit in USD */
  limit: number;
  /** Whether budget is exceeded */
  exceeded: boolean;
  /** Whether in warning zone */
  warning: boolean;
}

// ============================================================================
// Wrapper Configuration
// ============================================================================

/**
 * Callback when a request completes with cost info
 */
export type OnCostCallback = (cost: ActualCost) => void | Promise<void>;

/**
 * Callback when budget warning threshold is reached
 */
export type OnBudgetWarningCallback = (status: BudgetStatus) => void | Promise<void>;

/**
 * Callback when budget is exceeded
 */
export type OnBudgetExceededCallback = (status: BudgetStatus) => void | Promise<void>;

/**
 * Callback before a request is made with cost estimate
 */
export type OnEstimateCallback = (estimate: CostEstimate) => void | Promise<void>;

/**
 * Configuration for the tokencap wrapper
 */
export interface TokencapConfig {
  /** Maximum budget in USD (optional) */
  budget?: number;

  /** Warning threshold as percentage (0-1), default 0.8 */
  warningThreshold?: number;

  /** Callback for each request's cost */
  onCost?: OnCostCallback;

  /** Callback when budget warning threshold reached */
  onBudgetWarning?: OnBudgetWarningCallback;

  /** Callback when budget exceeded */
  onBudgetExceeded?: OnBudgetExceededCallback;

  /** Callback before request with estimate (for approval workflows) */
  onEstimate?: OnEstimateCallback;

  /** Whether to block requests when budget exceeded, default true */
  blockOnExceeded?: boolean;

  /** Tokencap proxy URL (optional, for self-hosted) */
  proxyUrl?: string;

  /** API key for Tokencap service (optional) */
  apiKey?: string;

  /** Project ID for cost attribution */
  projectId?: string;

  /** User ID for cost attribution */
  userId?: string;
}

// ============================================================================
// Model Pricing Types
// ============================================================================

/**
 * Pricing information for a model
 */
export interface ModelPricing {
  /** Model identifier */
  model: ModelId;
  /** Provider */
  provider: Provider;
  /** Input price per 1M tokens in USD */
  inputPricePerMillion: number;
  /** Output price per 1M tokens in USD */
  outputPricePerMillion: number;
  /** Context window size */
  contextWindow: number;
  /** Maximum output tokens */
  maxOutput?: number;
}

// ============================================================================
// SDK Client Types
// ============================================================================

/**
 * Generic SDK client interface
 * Represents the common interface of OpenAI and Anthropic SDKs
 */
export interface GenericSDKClient {
  [key: string]: unknown;
}

/**
 * Wrapped SDK client with Tokencap functionality
 */
export interface WrappedClient<T extends GenericSDKClient> {
  /** Original SDK client with intercepted methods */
  client: T;
  /** Get current budget status */
  getBudgetStatus: () => BudgetStatus;
  /** Reset budget tracking */
  resetBudget: () => void;
  /** Get total cost so far */
  getTotalCost: () => number;
}

// ============================================================================
// Token Counting Types
// ============================================================================

/**
 * Token count result
 */
export interface TokenCount {
  /** Total tokens */
  total: number;
  /** Breakdown by message (optional) */
  breakdown?: Array<{
    role: MessageRole;
    tokens: number;
  }>;
}

/**
 * Tokenizer options
 */
export interface TokenizerOptions {
  /** Model to use for tokenization */
  model?: ModelId;
  /** Provider hint if model is ambiguous */
  provider?: Provider;
}
