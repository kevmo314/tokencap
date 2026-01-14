export interface Project {
  id: string
  name: string
  budget: number
  spent: number
  requestCount: number
  createdAt: string
  updatedAt: string
}

export interface UsageRecord {
  id: string
  projectId: string
  projectName: string
  model: string
  provider: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cost: number
  latency: number
  timestamp: string
  status: 'success' | 'error' | 'budget_exceeded'
}

export interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  createdAt: string
  lastUsed: string | null
  status: 'active' | 'revoked'
}

export interface SpendSummary {
  today: number
  thisWeek: number
  thisMonth: number
  requestCount: number
  avgCostPerRequest: number
}

export interface BudgetUtilization {
  date: string
  spent: number
  budget: number
}

export interface AlertConfig {
  id: string
  type: 'email' | 'webhook' | 'slack'
  threshold: number
  enabled: boolean
  destination: string
}
