/**
 * Proxy Logic Module
 * Handles proxying requests to OpenAI and Anthropic APIs
 * MIT License
 */

import type { Context } from 'hono';
import type {
  Provider,
  OpenAIChatRequest,
  OpenAIChatResponse,
  AnthropicMessagesRequest,
  AnthropicMessagesResponse,
  CostEstimate,
  ActualCost,
  ProxyConfig,
} from './types.js';
import { estimateOpenAICost, estimateAnthropicCost } from './tokenizer.js';
import { calculateCostByProvider } from './pricing.js';
import { checkBudget, formatBudgetError, getRemainingBudget } from './budget.js';
import { recordUsage } from './db.js';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Extract project ID from request headers or query params
 */
export function getProjectId(c: Context, config: ProxyConfig): string {
  // Check header first
  const headerProjectId = c.req.header('X-Tokencap-Project-Id');
  if (headerProjectId) return headerProjectId;

  // Check query param
  const queryProjectId = c.req.query('project_id');
  if (queryProjectId) return queryProjectId;

  // Use default
  return config.defaultProjectId;
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Add Tokencap headers to response
 */
function addTokencapHeaders(
  headers: Record<string, string>,
  estimate: CostEstimate,
  actual?: ActualCost,
  budgetRemaining?: number | null
): void {
  // Pre-execution estimates
  headers['X-Tokencap-Input-Tokens'] = estimate.inputTokens.toString();
  headers['X-Tokencap-Estimated-Output-Tokens'] = estimate.estimatedOutputTokens.toString();
  headers['X-Tokencap-Estimated-Cost-USD'] = estimate.totalEstimatedCostUsd.toFixed(6);
  headers['X-Tokencap-Confidence'] = estimate.confidence;

  // Actual values (if available)
  if (actual) {
    headers['X-Tokencap-Output-Tokens'] = actual.outputTokens.toString();
    headers['X-Tokencap-Cost-USD'] = actual.totalCostUsd.toFixed(6);
  }

  // Budget info
  if (budgetRemaining !== null && budgetRemaining !== undefined) {
    headers['X-Tokencap-Budget-Remaining'] = budgetRemaining.toFixed(6);
  }
}

/**
 * Proxy OpenAI chat completions request
 */
export async function proxyOpenAI(
  c: Context,
  config: ProxyConfig
): Promise<Response> {
  const requestId = generateRequestId();
  const projectId = getProjectId(c, config);

  // Parse request body
  let body: OpenAIChatRequest;
  try {
    body = await c.req.json<OpenAIChatRequest>();
  } catch {
    return c.json(
      {
        error: {
          type: 'invalid_request',
          message: 'Invalid JSON in request body',
        },
      },
      400
    );
  }

  // Estimate cost
  const estimate = estimateOpenAICost(body);

  // Check budget
  const budgetCheck = checkBudget(projectId, estimate);
  if (!budgetCheck.allowed) {
    const headers: Record<string, string> = {};
    addTokencapHeaders(headers, estimate, undefined, budgetCheck.remainingAfterRequestUsd);

    return c.json(
      { error: formatBudgetError(budgetCheck) },
      { status: 402, headers }
    );
  }

  // Get API key
  const apiKey = c.req.header('Authorization')?.replace('Bearer ', '') || config.openaiApiKey;
  if (!apiKey) {
    return c.json(
      {
        error: {
          type: 'invalid_request',
          message: 'Missing OpenAI API key. Set OPENAI_API_KEY or pass Authorization header.',
        },
      },
      401
    );
  }

  // Check if streaming is requested
  if (body.stream) {
    return proxyOpenAIStream(c, body, apiKey, estimate, projectId, requestId, config);
  }

  // Forward request to OpenAI
  let response: Response;
  try {
    response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    return c.json(
      {
        error: {
          type: 'upstream_error',
          message: `Failed to connect to OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      },
      502
    );
  }

  // Parse response
  const responseBody = await response.json() as OpenAIChatResponse | { error: unknown };

  // Check for upstream error
  if (!response.ok || 'error' in responseBody) {
    const headers: Record<string, string> = {};
    addTokencapHeaders(headers, estimate);
    return new Response(JSON.stringify(responseBody), {
      status: response.status,
      headers: { 'Content-Type': 'application/json', ...headers },
    });
  }

  // Calculate actual cost
  const actualResponse = responseBody as OpenAIChatResponse;
  const actualInputTokens = actualResponse.usage?.prompt_tokens ?? estimate.inputTokens;
  const actualOutputTokens = actualResponse.usage?.completion_tokens ?? 0;
  const actualCost = calculateCostByProvider('openai', body.model, actualInputTokens, actualOutputTokens);

  const actual: ActualCost = {
    provider: 'openai',
    model: body.model,
    inputTokens: actualInputTokens,
    outputTokens: actualOutputTokens,
    ...actualCost,
  };

  // Record usage
  recordUsage(
    projectId,
    'openai',
    body.model,
    actualInputTokens,
    actualOutputTokens,
    actual.totalCostUsd,
    requestId
  );

  // Build response headers
  const headers: Record<string, string> = {};
  addTokencapHeaders(headers, estimate, actual, getRemainingBudget(projectId));
  headers['X-Tokencap-Request-Id'] = requestId;

  return c.json(responseBody, { headers });
}

/**
 * Proxy OpenAI streaming request
 */
async function proxyOpenAIStream(
  c: Context,
  body: OpenAIChatRequest,
  apiKey: string,
  estimate: CostEstimate,
  projectId: string,
  requestId: string,
  _config: ProxyConfig
): Promise<Response> {
  // Forward request to OpenAI
  let response: Response;
  try {
    response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    return c.json(
      {
        error: {
          type: 'upstream_error',
          message: `Failed to connect to OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      },
      502
    );
  }

  if (!response.ok || !response.body) {
    const errorBody = await response.text();
    return new Response(errorBody, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // For streaming, we track output tokens by counting them as they stream
  let outputTokens = 0;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const reader = response.body.getReader();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });

          // Parse SSE events to count tokens
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ') && !line.includes('[DONE]')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.choices?.[0]?.delta?.content) {
                  // Rough estimate: 1 token per 4 characters for streaming
                  outputTokens += Math.ceil(data.choices[0].delta.content.length / 4);
                }
              } catch {
                // Ignore parse errors in streaming
              }
            }
          }

          controller.enqueue(value);
        }

        // Record usage after stream completes
        const actualCost = calculateCostByProvider('openai', body.model, estimate.inputTokens, outputTokens);
        recordUsage(
          projectId,
          'openai',
          body.model,
          estimate.inputTokens,
          outputTokens,
          actualCost.totalCostUsd,
          requestId
        );

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  // Build response headers
  const headers: Record<string, string> = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Tokencap-Request-Id': requestId,
    'X-Tokencap-Input-Tokens': estimate.inputTokens.toString(),
    'X-Tokencap-Estimated-Output-Tokens': estimate.estimatedOutputTokens.toString(),
    'X-Tokencap-Estimated-Cost-USD': estimate.totalEstimatedCostUsd.toFixed(6),
  };

  return new Response(stream, { headers });
}

/**
 * Proxy Anthropic messages request
 */
export async function proxyAnthropic(
  c: Context,
  config: ProxyConfig
): Promise<Response> {
  const requestId = generateRequestId();
  const projectId = getProjectId(c, config);

  // Parse request body
  let body: AnthropicMessagesRequest;
  try {
    body = await c.req.json<AnthropicMessagesRequest>();
  } catch {
    return c.json(
      {
        error: {
          type: 'invalid_request',
          message: 'Invalid JSON in request body',
        },
      },
      400
    );
  }

  // Estimate cost
  const estimate = estimateAnthropicCost(body);

  // Check budget
  const budgetCheck = checkBudget(projectId, estimate);
  if (!budgetCheck.allowed) {
    const headers: Record<string, string> = {};
    addTokencapHeaders(headers, estimate, undefined, budgetCheck.remainingAfterRequestUsd);

    return c.json(
      { error: formatBudgetError(budgetCheck) },
      { status: 402, headers }
    );
  }

  // Get API key
  const apiKey = c.req.header('X-API-Key') || config.anthropicApiKey;
  if (!apiKey) {
    return c.json(
      {
        error: {
          type: 'invalid_request',
          message: 'Missing Anthropic API key. Set ANTHROPIC_API_KEY or pass X-API-Key header.',
        },
      },
      401
    );
  }

  // Check if streaming is requested
  if (body.stream) {
    return proxyAnthropicStream(c, body, apiKey, estimate, projectId, requestId, config);
  }

  // Forward request to Anthropic
  let response: Response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    return c.json(
      {
        error: {
          type: 'upstream_error',
          message: `Failed to connect to Anthropic: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      },
      502
    );
  }

  // Parse response
  const responseBody = await response.json() as AnthropicMessagesResponse | { error: unknown };

  // Check for upstream error
  if (!response.ok || 'error' in responseBody) {
    const headers: Record<string, string> = {};
    addTokencapHeaders(headers, estimate);
    return new Response(JSON.stringify(responseBody), {
      status: response.status,
      headers: { 'Content-Type': 'application/json', ...headers },
    });
  }

  // Calculate actual cost
  const actualResponse = responseBody as AnthropicMessagesResponse;
  const actualInputTokens = actualResponse.usage?.input_tokens ?? estimate.inputTokens;
  const actualOutputTokens = actualResponse.usage?.output_tokens ?? 0;
  const actualCost = calculateCostByProvider('anthropic', body.model, actualInputTokens, actualOutputTokens);

  const actual: ActualCost = {
    provider: 'anthropic',
    model: body.model,
    inputTokens: actualInputTokens,
    outputTokens: actualOutputTokens,
    ...actualCost,
  };

  // Record usage
  recordUsage(
    projectId,
    'anthropic',
    body.model,
    actualInputTokens,
    actualOutputTokens,
    actual.totalCostUsd,
    requestId
  );

  // Build response headers
  const headers: Record<string, string> = {};
  addTokencapHeaders(headers, estimate, actual, getRemainingBudget(projectId));
  headers['X-Tokencap-Request-Id'] = requestId;

  return c.json(responseBody, { headers });
}

/**
 * Proxy Anthropic streaming request
 */
async function proxyAnthropicStream(
  c: Context,
  body: AnthropicMessagesRequest,
  apiKey: string,
  estimate: CostEstimate,
  projectId: string,
  requestId: string,
  _config: ProxyConfig
): Promise<Response> {
  // Forward request to Anthropic
  let response: Response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    return c.json(
      {
        error: {
          type: 'upstream_error',
          message: `Failed to connect to Anthropic: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      },
      502
    );
  }

  if (!response.ok || !response.body) {
    const errorBody = await response.text();
    return new Response(errorBody, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Track output tokens from streaming response
  let outputTokens = 0;
  let inputTokens = estimate.inputTokens;
  const decoder = new TextDecoder();

  const reader = response.body.getReader();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });

          // Parse SSE events to extract token counts
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                // Anthropic sends usage in message_delta event
                if (data.type === 'message_delta' && data.usage) {
                  outputTokens = data.usage.output_tokens;
                }
                // Also check message_start for input tokens
                if (data.type === 'message_start' && data.message?.usage) {
                  inputTokens = data.message.usage.input_tokens;
                }
              } catch {
                // Ignore parse errors in streaming
              }
            }
          }

          controller.enqueue(value);
        }

        // Record usage after stream completes
        const actualCost = calculateCostByProvider('anthropic', body.model, inputTokens, outputTokens);
        recordUsage(
          projectId,
          'anthropic',
          body.model,
          inputTokens,
          outputTokens,
          actualCost.totalCostUsd,
          requestId
        );

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  // Build response headers
  const headers: Record<string, string> = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Tokencap-Request-Id': requestId,
    'X-Tokencap-Input-Tokens': estimate.inputTokens.toString(),
    'X-Tokencap-Estimated-Output-Tokens': estimate.estimatedOutputTokens.toString(),
    'X-Tokencap-Estimated-Cost-USD': estimate.totalEstimatedCostUsd.toFixed(6),
  };

  return new Response(stream, { headers });
}
