/**
 * Tokencap SDK Wrapper
 *
 * Wraps existing SDK instances (OpenAI, Anthropic) to add cost tracking
 * and budget enforcement with minimal code changes.
 */

import type {
  TokencapConfig,
  BudgetStatus,
  ActualCost,
  CostEstimate,
  GenericSDKClient,
  WrappedClient,
  Provider,
  Message,
  MessageRole,
} from './types.js';
import { estimate, calculateActualCost } from './estimate.js';
import { detectProvider } from './tokenizer.js';

// ============================================================================
// Budget Tracker
// ============================================================================

/**
 * Internal budget tracker class
 */
class BudgetTracker {
  private spent: number = 0;
  private readonly limit: number;
  private readonly warningThreshold: number;

  constructor(limit: number, warningThreshold: number = 0.8) {
    this.limit = limit;
    this.warningThreshold = warningThreshold;
  }

  /**
   * Add cost and return updated status
   */
  addCost(cost: number): BudgetStatus {
    this.spent += cost;
    return this.getStatus();
  }

  /**
   * Get current budget status
   */
  getStatus(): BudgetStatus {
    const remaining = Math.max(0, this.limit - this.spent);
    const exceeded = this.spent >= this.limit;
    const warning = this.spent >= this.limit * this.warningThreshold;

    return {
      spent: this.spent,
      remaining,
      limit: this.limit,
      exceeded,
      warning,
    };
  }

  /**
   * Check if a cost would exceed budget
   */
  wouldExceed(cost: number): boolean {
    return this.spent + cost > this.limit;
  }

  /**
   * Reset budget tracking
   */
  reset(): void {
    this.spent = 0;
  }
}

// ============================================================================
// SDK Detection
// ============================================================================

/**
 * Detect if an object is an OpenAI client
 */
function isOpenAIClient(client: unknown): boolean {
  if (!client || typeof client !== 'object') return false;
  const obj = client as Record<string, unknown>;
  return (
    'chat' in obj &&
    typeof obj['chat'] === 'object' &&
    obj['chat'] !== null &&
    'completions' in (obj['chat'] as Record<string, unknown>)
  );
}

/**
 * Detect if an object is an Anthropic client
 */
function isAnthropicClient(client: unknown): boolean {
  if (!client || typeof client !== 'object') return false;
  const obj = client as Record<string, unknown>;
  return 'messages' in obj && typeof (obj['messages'] as Record<string, unknown>)?.['create'] === 'function';
}

/**
 * Detect SDK provider from client
 */
function detectSDKProvider(client: unknown): Provider | null {
  if (isOpenAIClient(client)) return 'openai';
  if (isAnthropicClient(client)) return 'anthropic';
  return null;
}

// ============================================================================
// Request Interception
// ============================================================================

/**
 * Validate and cast role string to MessageRole
 */
function toMessageRole(role: unknown): MessageRole {
  const validRoles: MessageRole[] = ['system', 'user', 'assistant', 'tool'];
  const roleStr = String(role || 'user');
  if (validRoles.includes(roleStr as MessageRole)) {
    return roleStr as MessageRole;
  }
  return 'user';
}

/**
 * Extract messages from OpenAI request
 */
function extractOpenAIMessages(params: Record<string, unknown>): Message[] {
  const messages = params['messages'];
  if (!Array.isArray(messages)) return [];

  return messages.map((msg: Record<string, unknown>): Message => ({
    role: toMessageRole(msg['role']),
    content: (msg['content'] as string) || '',
    name: msg['name'] as string | undefined,
  }));
}

/**
 * Extract messages from Anthropic request
 */
function extractAnthropicMessages(params: Record<string, unknown>): Message[] {
  const messages = params['messages'];
  const system = params['system'];

  const result: Message[] = [];

  if (typeof system === 'string') {
    result.push({ role: 'system' as const, content: system });
  }

  if (Array.isArray(messages)) {
    for (const msg of messages) {
      const m = msg as Record<string, unknown>;
      result.push({
        role: toMessageRole(m['role']),
        content: (m['content'] as string) || '',
      });
    }
  }

  return result;
}

/**
 * Extract usage from OpenAI response
 */
function extractOpenAIUsage(response: unknown): { inputTokens: number; outputTokens: number } | null {
  if (!response || typeof response !== 'object') return null;

  const r = response as Record<string, unknown>;
  const usage = r['usage'] as Record<string, unknown> | undefined;

  if (!usage) return null;

  return {
    inputTokens: (usage['prompt_tokens'] as number) || 0,
    outputTokens: (usage['completion_tokens'] as number) || 0,
  };
}

/**
 * Extract usage from Anthropic response
 */
function extractAnthropicUsage(response: unknown): { inputTokens: number; outputTokens: number } | null {
  if (!response || typeof response !== 'object') return null;

  const r = response as Record<string, unknown>;
  const usage = r['usage'] as Record<string, unknown> | undefined;

  if (!usage) return null;

  return {
    inputTokens: (usage['input_tokens'] as number) || 0,
    outputTokens: (usage['output_tokens'] as number) || 0,
  };
}

// ============================================================================
// Wrapper Factory
// ============================================================================

/**
 * Create wrapped method that intercepts API calls
 */
function createWrappedMethod<T extends (...args: unknown[]) => unknown>(
  originalMethod: T,
  config: TokencapConfig,
  budgetTracker: BudgetTracker | null,
  provider: Provider,
  methodPath: string
): T {
  return (async function wrappedMethod(...args: unknown[]): Promise<unknown> {
    const params = (args[0] as Record<string, unknown>) || {};
    const model = (params['model'] as string) || 'unknown';

    // Extract messages for estimation
    const messages =
      provider === 'openai' ? extractOpenAIMessages(params) : extractAnthropicMessages(params);

    // Pre-flight cost estimate
    const costEstimate: CostEstimate = estimate({
      model,
      messages,
      max_tokens: params['max_tokens'] as number | undefined,
    });

    // Call estimate callback if provided
    if (config.onEstimate) {
      await config.onEstimate(costEstimate);
    }

    // Check budget before request
    if (budgetTracker) {
      const status = budgetTracker.getStatus();

      // Check if estimated cost would exceed budget
      if (budgetTracker.wouldExceed(costEstimate.estimatedCost)) {
        if (config.onBudgetExceeded) {
          await config.onBudgetExceeded(status);
        }

        if (config.blockOnExceeded !== false) {
          throw new TokencapBudgetExceededError(
            `Request blocked: estimated cost $${costEstimate.estimatedCost.toFixed(4)} would exceed remaining budget $${status.remaining.toFixed(4)}`,
            status,
            costEstimate
          );
        }
      }

      // Check warning threshold
      if (status.warning && !status.exceeded && config.onBudgetWarning) {
        await config.onBudgetWarning(status);
      }
    }

    // Execute original method
    const response = await (originalMethod as Function).call(null, ...args);

    // Extract actual usage from response
    const usage =
      provider === 'openai' ? extractOpenAIUsage(response) : extractAnthropicUsage(response);

    if (usage) {
      const actualCost = calculateActualCost(model, usage.inputTokens, usage.outputTokens);

      // Update budget tracker
      if (budgetTracker) {
        const newStatus = budgetTracker.addCost(actualCost);

        // Check if we hit warning after this request
        if (newStatus.warning && !newStatus.exceeded && config.onBudgetWarning) {
          await config.onBudgetWarning(newStatus);
        }
      }

      // Call cost callback
      if (config.onCost) {
        const costInfo: ActualCost = {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalCost: actualCost,
          model,
        };
        await config.onCost(costInfo);
      }
    }

    return response;
  }) as T;
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown when budget is exceeded
 */
export class TokencapBudgetExceededError extends Error {
  public readonly status: BudgetStatus;
  public readonly estimate: CostEstimate;

  constructor(message: string, status: BudgetStatus, estimate: CostEstimate) {
    super(message);
    this.name = 'TokencapBudgetExceededError';
    this.status = status;
    this.estimate = estimate;
  }
}

// ============================================================================
// Main Wrapper Function
// ============================================================================

/**
 * Wrap an SDK client with Tokencap cost tracking and budget enforcement
 *
 * @param client - SDK client instance (OpenAI or Anthropic)
 * @param config - Tokencap configuration
 * @returns Wrapped client with cost tracking
 *
 * @example
 * ```typescript
 * import OpenAI from 'openai';
 * import { tokencap } from '@tokencap/sdk';
 *
 * const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 *
 * const wrapped = tokencap(openai, {
 *   budget: 10.00,
 *   onCost: (cost) => console.log(`Request cost: $${cost.totalCost.toFixed(4)}`),
 *   onBudgetWarning: (status) => console.log(`Budget warning: $${status.remaining.toFixed(2)} remaining`),
 *   onBudgetExceeded: () => console.log('Budget exceeded!')
 * });
 *
 * // Use wrapped client exactly like original
 * const response = await wrapped.chat.completions.create({
 *   model: 'gpt-4',
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * });
 * ```
 */
export function tokencap<T extends GenericSDKClient>(
  client: T,
  config: TokencapConfig = {}
): T & {
  getBudgetStatus: () => BudgetStatus;
  resetBudget: () => void;
  getTotalCost: () => number;
} {
  const provider = detectSDKProvider(client);

  if (!provider) {
    throw new Error(
      'Unsupported SDK client. Tokencap currently supports OpenAI and Anthropic SDKs.'
    );
  }

  // Initialize budget tracker if budget is set
  const budgetTracker = config.budget ? new BudgetTracker(config.budget, config.warningThreshold) : null;

  // Create a proxy to intercept method calls
  const handler: ProxyHandler<T> = {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      // Handle special Tokencap methods
      if (prop === 'getBudgetStatus') {
        return () =>
          budgetTracker?.getStatus() ?? {
            spent: 0,
            remaining: Infinity,
            limit: Infinity,
            exceeded: false,
            warning: false,
          };
      }

      if (prop === 'resetBudget') {
        return () => budgetTracker?.reset();
      }

      if (prop === 'getTotalCost') {
        return () => budgetTracker?.getStatus().spent ?? 0;
      }

      // For OpenAI, intercept chat.completions.create
      if (provider === 'openai' && prop === 'chat') {
        return new Proxy(value as object, {
          get(chatTarget, chatProp, chatReceiver) {
            const chatValue = Reflect.get(chatTarget, chatProp, chatReceiver);

            if (chatProp === 'completions') {
              return new Proxy(chatValue as object, {
                get(compTarget, compProp, compReceiver) {
                  const compValue = Reflect.get(compTarget, compProp, compReceiver);

                  if (compProp === 'create' && typeof compValue === 'function') {
                    return createWrappedMethod(
                      compValue.bind(compTarget) as (...args: unknown[]) => unknown,
                      config,
                      budgetTracker,
                      provider,
                      'chat.completions.create'
                    );
                  }

                  return compValue;
                },
              });
            }

            return chatValue;
          },
        });
      }

      // For Anthropic, intercept messages.create
      if (provider === 'anthropic' && prop === 'messages') {
        return new Proxy(value as object, {
          get(msgTarget, msgProp, msgReceiver) {
            const msgValue = Reflect.get(msgTarget, msgProp, msgReceiver);

            if (msgProp === 'create' && typeof msgValue === 'function') {
              return createWrappedMethod(
                msgValue.bind(msgTarget) as (...args: unknown[]) => unknown,
                config,
                budgetTracker,
                provider,
                'messages.create'
              );
            }

            return msgValue;
          },
        });
      }

      return value;
    },
  };

  return new Proxy(client, handler) as T & {
    getBudgetStatus: () => BudgetStatus;
    resetBudget: () => void;
    getTotalCost: () => number;
  };
}

/**
 * Create a standalone Tokencap instance for cost estimation
 * without wrapping an SDK
 *
 * @example
 * ```typescript
 * import { createTokencap } from '@tokencap/sdk';
 *
 * const tc = createTokencap({ projectId: 'my-project' });
 *
 * const estimate = tc.estimate({
 *   model: 'gpt-4',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   max_tokens: 1000
 * });
 * ```
 */
export function createTokencap(config: Pick<TokencapConfig, 'projectId' | 'userId' | 'apiKey'> = {}) {
  return {
    estimate,
    config,
  };
}
