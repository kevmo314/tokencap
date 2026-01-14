/**
 * Tokencap Proxy Types
 * MIT License
 */

// ============================================================================
// Provider Types
// ============================================================================

export type Provider = 'openai' | 'anthropic' | 'google' | 'mistral' | 'meta';

// ============================================================================
// OpenAI Types
// ============================================================================

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
  content: string | null;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface OpenAIChatRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  user?: string;
  functions?: Array<{
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  }>;
  function_call?: 'none' | 'auto' | { name: string };
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description?: string;
      parameters?: Record<string, unknown>;
    };
  }>;
  tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } };
}

export interface OpenAIChatResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: OpenAIMessage;
    finish_reason: 'stop' | 'length' | 'function_call' | 'tool_calls' | 'content_filter';
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ============================================================================
// Anthropic Types
// ============================================================================

export interface AnthropicContentBlock {
  type: 'text' | 'image' | 'tool_use' | 'tool_result';
  text?: string;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string | AnthropicContentBlock[];
}

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

export interface AnthropicMessagesRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  system?: string;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  stream?: boolean;
  metadata?: {
    user_id?: string;
  };
  tools?: Array<{
    name: string;
    description?: string;
    input_schema: Record<string, unknown>;
  }>;
  tool_choice?: { type: 'auto' | 'any' | 'tool'; name?: string };
}

export interface AnthropicMessagesResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// ============================================================================
// Tokencap Types
// ============================================================================

export interface CostEstimate {
  provider: Provider;
  model: string;
  inputTokens: number;
  estimatedOutputTokens: number;
  inputCostUsd: number;
  estimatedOutputCostUsd: number;
  totalEstimatedCostUsd: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface ActualCost {
  provider: Provider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
}

export interface Budget {
  id: string;
  projectId: string;
  limitUsd: number;
  spentUsd: number;
  periodStart: Date;
  periodEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageRecord {
  id: number;
  projectId: string;
  provider: Provider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  requestId: string;
  createdAt: Date;
}

export interface UsageSummary {
  projectId: string;
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  budgetLimitUsd: number | null;
  budgetRemainingUsd: number | null;
}

export interface BudgetCheckResult {
  allowed: boolean;
  currentSpendUsd: number;
  limitUsd: number | null;
  estimatedCostUsd: number;
  remainingAfterRequestUsd: number | null;
  reason?: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface SetBudgetRequest {
  projectId: string;
  limitUsd: number;
  periodDays?: number; // null = no expiry
}

export interface SetBudgetResponse {
  success: boolean;
  budget: Budget;
}

export interface GetUsageRequest {
  projectId: string;
}

export interface GetUsageResponse {
  usage: UsageSummary;
}

export interface ProxyErrorResponse {
  error: {
    type: 'budget_exceeded' | 'invalid_request' | 'upstream_error' | 'internal_error';
    message: string;
    details?: {
      currentSpendUsd?: number;
      limitUsd?: number;
      estimatedCostUsd?: number;
    };
  };
}

// ============================================================================
// Configuration
// ============================================================================

export interface ProxyConfig {
  port: number;
  host: string;
  dbPath: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  defaultMaxTokens: number;
  defaultProjectId: string;
  resendApiKey?: string;
}

// ============================================================================
// Authentication Types
// ============================================================================

export type Plan = 'free' | 'pro' | 'team';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  plan: Plan;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKey {
  id: string;
  userId: string;
  key: string; // tc_xxxxxxxxxxxx format
  name: string;
  lastUsedAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanLimits {
  maxRequestsPerMonth: number;
  maxProjects: number;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxRequestsPerMonth: 50_000,
    maxProjects: 1,
  },
  pro: {
    maxRequestsPerMonth: 500_000,
    maxProjects: -1, // unlimited
  },
  team: {
    maxRequestsPerMonth: 2_000_000,
    maxProjects: -1, // unlimited
  },
};

// Auth request/response types
export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CreateApiKeyRequest {
  name?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    plan: Plan;
  };
  token?: string;
  message?: string;
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  key?: string; // Only returned on creation
  keyPrefix: string; // tc_xxxx... for listing
  lastUsedAt: string | null;
  createdAt: string;
}

// Auth context for authenticated requests
export interface AuthContext {
  user: User;
  apiKey?: ApiKey;
  session?: Session;
}

// ============================================================================
// Alert Types
// ============================================================================

export type AlertType = 'budget_warning' | 'budget_exceeded' | 'daily_spend_spike';

// Backward compatibility alias
export type UserPlan = Plan;

export interface Alert {
  id: string;
  userId: string;
  projectId: string;
  type: AlertType;
  threshold: number; // percentage for budget_warning, multiplier for daily_spend_spike
  enabled: boolean;
  webhookUrl: string | null;
  email: string | null;
  lastTriggeredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertHistory {
  id: number;
  alertId: string;
  triggeredAt: Date;
  details: string; // JSON string with alert details
}

export interface CreateAlertRequest {
  projectId: string;
  type: AlertType;
  threshold?: number;
  webhookUrl?: string;
  email?: string;
}

export interface UpdateAlertRequest {
  type?: AlertType;
  threshold?: number;
  enabled?: boolean;
  webhookUrl?: string | null;
  email?: string | null;
}

export interface AlertDetails {
  alertType: AlertType;
  projectId: string;
  currentSpendUsd: number;
  budgetLimitUsd?: number;
  budgetUtilizationPercent?: number;
  dailyAverageSpendUsd?: number;
  todaySpendUsd?: number;
  triggeredAt: string;
  message: string;
}
