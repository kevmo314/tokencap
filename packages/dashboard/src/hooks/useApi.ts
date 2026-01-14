import { useState, useEffect, useCallback } from 'react'
import * as api from '../lib/api'
import * as mockData from '../lib/mockData'
import type { Project, UsageRecord, ApiKey, SpendSummary, BudgetUtilization } from '../types'

// Set this to true during development when API is not available
const USE_MOCK_DATA = true

interface UseApiState<T> {
  data: T | null
  loading: boolean
  error: Error | null
  refetch: () => void
}

function useApiCall<T>(
  fetcher: () => Promise<T>,
  mockValue: T,
  deps: unknown[] = []
): UseApiState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (USE_MOCK_DATA) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 300))
        setData(mockValue)
      } else {
        const result = await fetcher()
        setData(result)
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

export function useSpendSummary(): UseApiState<SpendSummary> {
  return useApiCall(
    () => api.getSpendSummary(),
    mockData.mockSpendSummary
  )
}

export function useProjects(): UseApiState<Project[]> {
  return useApiCall(
    () => api.getProjects(),
    mockData.mockProjects
  )
}

export function useUsageRecords(params?: {
  projectId?: string
  model?: string
  startDate?: string
  endDate?: string
}): UseApiState<{ records: UsageRecord[]; total: number }> {
  // Filter mock data based on params
  let filteredRecords = [...mockData.mockUsageRecords]

  if (params?.projectId) {
    filteredRecords = filteredRecords.filter(r => r.projectId === params.projectId)
  }
  if (params?.model) {
    filteredRecords = filteredRecords.filter(r => r.model === params.model)
  }
  if (params?.startDate) {
    filteredRecords = filteredRecords.filter(r => r.timestamp >= params.startDate!)
  }
  if (params?.endDate) {
    filteredRecords = filteredRecords.filter(r => r.timestamp <= params.endDate!)
  }

  return useApiCall(
    () => api.getUsageRecords(params),
    { records: filteredRecords, total: filteredRecords.length },
    [params?.projectId, params?.model, params?.startDate, params?.endDate]
  )
}

export function useBudgetUtilization(days: number = 30): UseApiState<BudgetUtilization[]> {
  return useApiCall(
    () => api.getBudgetUtilization(days),
    mockData.mockBudgetUtilization,
    [days]
  )
}

export function useApiKeys(): UseApiState<ApiKey[]> {
  return useApiCall(
    () => api.getApiKeys(),
    mockData.mockApiKeys
  )
}

// Actions (these don't use mocks, they modify state)
export function useCreateProject() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const createProject = async (data: { name: string; budget: number }) => {
    setLoading(true)
    setError(null)
    try {
      if (USE_MOCK_DATA) {
        await new Promise(resolve => setTimeout(resolve, 500))
        return {
          id: Date.now().toString(),
          ...data,
          spent: 0,
          requestCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as Project
      }
      return await api.createProject(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create project'))
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { createProject, loading, error }
}

export function useCreateApiKey() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const createApiKey = async (name: string) => {
    setLoading(true)
    setError(null)
    try {
      if (USE_MOCK_DATA) {
        await new Promise(resolve => setTimeout(resolve, 500))
        const newKey: ApiKey = {
          id: Date.now().toString(),
          name,
          keyPrefix: `tc_live_${Math.random().toString(36).substring(2, 6)}`,
          createdAt: new Date().toISOString(),
          lastUsed: null,
          status: 'active',
        }
        return {
          key: `tc_live_${Math.random().toString(36).substring(2, 34)}`,
          apiKey: newKey,
        }
      }
      return await api.createApiKey(name)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create API key'))
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { createApiKey, loading, error }
}

export { api }
