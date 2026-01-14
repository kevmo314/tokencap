import type { Project, UsageRecord, ApiKey, SpendSummary, BudgetUtilization } from '../types'

// Mock data for development when API is not available

export const mockSpendSummary: SpendSummary = {
  today: 12.47,
  thisWeek: 87.23,
  thisMonth: 342.56,
  requestCount: 15234,
  avgCostPerRequest: 0.0225,
}

export const mockProjects: Project[] = [
  {
    id: '1',
    name: 'Production API',
    budget: 500,
    spent: 234.56,
    requestCount: 8742,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-13T10:00:00Z',
  },
  {
    id: '2',
    name: 'Development',
    budget: 100,
    spent: 45.23,
    requestCount: 2341,
    createdAt: '2026-01-05T00:00:00Z',
    updatedAt: '2026-01-13T09:30:00Z',
  },
  {
    id: '3',
    name: 'Research Agent',
    budget: 200,
    spent: 62.77,
    requestCount: 4151,
    createdAt: '2026-01-08T00:00:00Z',
    updatedAt: '2026-01-13T08:45:00Z',
  },
]

const models = ['gpt-4-turbo', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet', 'gemini-pro']
const statuses: Array<'success' | 'error' | 'budget_exceeded'> = ['success', 'success', 'success', 'success', 'error', 'budget_exceeded']

export const mockUsageRecords: UsageRecord[] = Array.from({ length: 100 }, (_, i) => {
  const project = mockProjects[Math.floor(Math.random() * mockProjects.length)]
  const model = models[Math.floor(Math.random() * models.length)]
  const inputTokens = Math.floor(Math.random() * 2000) + 100
  const outputTokens = Math.floor(Math.random() * 1000) + 50
  const provider = model.startsWith('gpt') ? 'openai' : model.startsWith('claude') ? 'anthropic' : 'google'

  // Rough cost calculation
  let costPer1k = 0.002
  if (model.includes('opus')) costPer1k = 0.015
  else if (model.includes('sonnet')) costPer1k = 0.003
  else if (model.includes('gpt-4')) costPer1k = 0.01

  return {
    id: `rec-${i + 1}`,
    projectId: project.id,
    projectName: project.name,
    model,
    provider,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    cost: ((inputTokens + outputTokens) / 1000) * costPer1k,
    latency: Math.floor(Math.random() * 2000) + 200,
    timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: statuses[Math.floor(Math.random() * statuses.length)],
  }
}).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

export const mockApiKeys: ApiKey[] = [
  {
    id: '1',
    name: 'Production Key',
    keyPrefix: 'tc_live_abc1',
    createdAt: '2026-01-01T00:00:00Z',
    lastUsed: '2026-01-13T10:30:00Z',
    status: 'active',
  },
  {
    id: '2',
    name: 'Development Key',
    keyPrefix: 'tc_test_xyz2',
    createdAt: '2026-01-05T00:00:00Z',
    lastUsed: '2026-01-12T15:20:00Z',
    status: 'active',
  },
  {
    id: '3',
    name: 'Old Key',
    keyPrefix: 'tc_live_old3',
    createdAt: '2025-12-15T00:00:00Z',
    lastUsed: '2026-01-02T08:00:00Z',
    status: 'revoked',
  },
]

export const mockBudgetUtilization: BudgetUtilization[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - (29 - i))
  const budget = 800
  const baseSpent = 15 + Math.random() * 10
  const trend = i * 0.3

  return {
    date: date.toISOString().split('T')[0],
    spent: baseSpent + trend + Math.random() * 5,
    budget,
  }
})
