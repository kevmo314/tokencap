import { useState, useMemo } from 'react'
import Table from '../components/Table'
import Button from '../components/Button'
import Select from '../components/Select'
import Input from '../components/Input'
import { useUsageRecords, useProjects } from '../hooks/useApi'
import { api } from '../hooks/useApi'
import type { UsageRecord } from '../types'

export default function Usage() {
  const [filters, setFilters] = useState({
    projectId: '',
    model: '',
    startDate: '',
    endDate: '',
  })

  const { data: projects } = useProjects()
  const { data: usageData, loading } = useUsageRecords(filters)

  const records = usageData?.records || []

  // Get unique models from records
  const models = useMemo(() => {
    const unique = new Set(records.map((r) => r.model))
    return Array.from(unique)
  }, [records])

  const projectOptions = [
    { value: '', label: 'All Projects' },
    ...(projects?.map((p) => ({ value: p.id, label: p.name })) || []),
  ]

  const modelOptions = [
    { value: '', label: 'All Models' },
    ...models.map((m) => ({ value: m, label: m })),
  ]

  const handleExport = () => {
    if (records.length === 0) return
    api.exportToCsv(records)
  }

  const columns = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      render: (item: UsageRecord) => {
        const date = new Date(item.timestamp)
        return (
          <div>
            <div className="text-white">{date.toLocaleDateString()}</div>
            <div className="text-xs text-zinc-500">
              {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        )
      },
    },
    {
      key: 'projectName',
      header: 'Project',
      render: (item: UsageRecord) => (
        <span className="text-white">{item.projectName}</span>
      ),
    },
    {
      key: 'model',
      header: 'Model',
      render: (item: UsageRecord) => (
        <div>
          <div className="text-white">{item.model}</div>
          <div className="text-xs text-zinc-500">{item.provider}</div>
        </div>
      ),
    },
    {
      key: 'inputTokens',
      header: 'Input',
      render: (item: UsageRecord) => item.inputTokens.toLocaleString(),
    },
    {
      key: 'outputTokens',
      header: 'Output',
      render: (item: UsageRecord) => item.outputTokens.toLocaleString(),
    },
    {
      key: 'totalTokens',
      header: 'Total',
      render: (item: UsageRecord) => (
        <span className="font-medium text-white">{item.totalTokens.toLocaleString()}</span>
      ),
    },
    {
      key: 'cost',
      header: 'Cost',
      render: (item: UsageRecord) => (
        <span className="font-mono text-accent">${item.cost.toFixed(6)}</span>
      ),
    },
    {
      key: 'latency',
      header: 'Latency',
      render: (item: UsageRecord) => `${item.latency}ms`,
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: UsageRecord) => (
        <span
          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
            item.status === 'success'
              ? 'bg-green-500/10 text-green-500'
              : item.status === 'error'
              ? 'bg-red-500/10 text-red-500'
              : 'bg-yellow-500/10 text-yellow-500'
          }`}
        >
          {item.status === 'budget_exceeded' ? 'budget' : item.status}
        </span>
      ),
    },
  ]

  // Calculate totals
  const totals = useMemo(() => {
    return records.reduce(
      (acc, r) => ({
        tokens: acc.tokens + r.totalTokens,
        cost: acc.cost + r.cost,
        requests: acc.requests + 1,
      }),
      { tokens: 0, cost: 0, requests: 0 }
    )
  }, [records])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Usage History</h1>
          <p className="text-zinc-400 mt-1">View and export your request history</p>
        </div>
        <Button onClick={handleExport} variant="secondary" disabled={records.length === 0}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-bg-secondary border border-border rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Select
            label="Project"
            options={projectOptions}
            value={filters.projectId}
            onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}
          />
          <Select
            label="Model"
            options={modelOptions}
            value={filters.model}
            onChange={(e) => setFilters({ ...filters, model: e.target.value })}
          />
          <Input
            label="Start Date"
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          />
          <Input
            label="End Date"
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
          />
        </div>

        {/* Quick Filters */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() =>
              setFilters({
                projectId: '',
                model: '',
                startDate: '',
                endDate: '',
              })
            }
            className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Clear filters
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <p className="text-sm text-zinc-400">Total Requests</p>
          <p className="text-2xl font-bold text-white">{totals.requests.toLocaleString()}</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <p className="text-sm text-zinc-400">Total Tokens</p>
          <p className="text-2xl font-bold text-white">{totals.tokens.toLocaleString()}</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <p className="text-sm text-zinc-400">Total Cost</p>
          <p className="text-2xl font-bold text-accent">${totals.cost.toFixed(4)}</p>
        </div>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        data={records}
        keyExtractor={(item) => item.id}
        loading={loading}
        emptyMessage="No requests match your filters"
      />

      {/* Pagination placeholder */}
      {records.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-400">
            Showing {records.length} of {usageData?.total || records.length} results
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled>
              Previous
            </Button>
            <Button variant="secondary" size="sm" disabled>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
