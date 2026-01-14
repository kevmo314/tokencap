import type { Project, UsageRecord, ApiKey, SpendSummary, BudgetUtilization, AlertConfig } from '../types'

const API_BASE = '/v1'

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

// Usage API
export async function getSpendSummary(): Promise<SpendSummary> {
  return fetchApi<SpendSummary>('/usage/summary')
}

export async function getUsageRecords(params?: {
  projectId?: string
  model?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}): Promise<{ records: UsageRecord[]; total: number }> {
  const searchParams = new URLSearchParams()
  if (params?.projectId) searchParams.set('projectId', params.projectId)
  if (params?.model) searchParams.set('model', params.model)
  if (params?.startDate) searchParams.set('startDate', params.startDate)
  if (params?.endDate) searchParams.set('endDate', params.endDate)
  if (params?.limit) searchParams.set('limit', params.limit.toString())
  if (params?.offset) searchParams.set('offset', params.offset.toString())

  const query = searchParams.toString()
  return fetchApi<{ records: UsageRecord[]; total: number }>(`/usage${query ? `?${query}` : ''}`)
}

export async function getBudgetUtilization(days: number = 30): Promise<BudgetUtilization[]> {
  return fetchApi<BudgetUtilization[]>(`/usage/budget-utilization?days=${days}`)
}

// Projects API
export async function getProjects(): Promise<Project[]> {
  return fetchApi<Project[]>('/projects')
}

export async function createProject(data: { name: string; budget: number }): Promise<Project> {
  return fetchApi<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateProject(id: string, data: { name?: string; budget?: number }): Promise<Project> {
  return fetchApi<Project>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteProject(id: string): Promise<void> {
  await fetchApi(`/projects/${id}`, { method: 'DELETE' })
}

// API Keys
export async function getApiKeys(): Promise<ApiKey[]> {
  return fetchApi<ApiKey[]>('/api-keys')
}

export async function createApiKey(name: string): Promise<{ key: string; apiKey: ApiKey }> {
  return fetchApi<{ key: string; apiKey: ApiKey }>('/api-keys', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export async function revokeApiKey(id: string): Promise<void> {
  await fetchApi(`/api-keys/${id}/revoke`, { method: 'POST' })
}

// Alerts (placeholder)
export async function getAlerts(): Promise<AlertConfig[]> {
  return fetchApi<AlertConfig[]>('/alerts')
}

export async function updateAlert(id: string, data: Partial<AlertConfig>): Promise<AlertConfig> {
  return fetchApi<AlertConfig>(`/alerts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

// Export utilities
export function exportToCsv(records: UsageRecord[]): void {
  const headers = ['Timestamp', 'Project', 'Model', 'Provider', 'Input Tokens', 'Output Tokens', 'Total Tokens', 'Cost', 'Latency (ms)', 'Status']
  const rows = records.map(r => [
    r.timestamp,
    r.projectName,
    r.model,
    r.provider,
    r.inputTokens,
    r.outputTokens,
    r.totalTokens,
    r.cost.toFixed(6),
    r.latency,
    r.status,
  ])

  const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tokencap-usage-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
