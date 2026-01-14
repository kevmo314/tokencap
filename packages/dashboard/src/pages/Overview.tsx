import { Card, StatCard } from '../components/Card'
import BudgetChart from '../components/BudgetChart'
import Table from '../components/Table'
import { useSpendSummary, useBudgetUtilization, useUsageRecords } from '../hooks/useApi'
import type { UsageRecord } from '../types'

export default function Overview() {
  const { data: summary, loading: summaryLoading } = useSpendSummary()
  const { data: budgetData, loading: budgetLoading } = useBudgetUtilization(30)
  const { data: usageData, loading: usageLoading } = useUsageRecords()

  const recentRecords = usageData?.records.slice(0, 10) || []

  const columns = [
    {
      key: 'timestamp',
      header: 'Time',
      render: (item: UsageRecord) => {
        const date = new Date(item.timestamp)
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
    },
    { key: 'model', header: 'Model' },
    { key: 'projectName', header: 'Project' },
    {
      key: 'totalTokens',
      header: 'Tokens',
      render: (item: UsageRecord) => item.totalTokens.toLocaleString(),
    },
    {
      key: 'cost',
      header: 'Cost',
      render: (item: UsageRecord) => `$${item.cost.toFixed(4)}`,
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
          {item.status}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        <p className="text-zinc-400 mt-1">Monitor your LLM spending and usage</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Today's Spend"
          value={summaryLoading ? '...' : `$${summary?.today.toFixed(2) || '0.00'}`}
          icon={
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
        />
        <StatCard
          title="This Week"
          value={summaryLoading ? '...' : `$${summary?.thisWeek.toFixed(2) || '0.00'}`}
          icon={
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          }
        />
        <StatCard
          title="This Month"
          value={summaryLoading ? '...' : `$${summary?.thisMonth.toFixed(2) || '0.00'}`}
          icon={
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3v18h18" />
              <path d="M18 17V9" />
              <path d="M13 17V5" />
              <path d="M8 17v-3" />
            </svg>
          }
        />
        <StatCard
          title="Request Count"
          value={summaryLoading ? '...' : summary?.requestCount.toLocaleString() || '0'}
          subtitle={summaryLoading ? '' : `Avg: $${summary?.avgCostPerRequest.toFixed(4) || '0'}/req`}
          icon={
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          }
        />
      </div>

      {/* Budget Chart */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white">Budget Utilization</h2>
            <p className="text-sm text-zinc-400">Daily spend over the last 30 days</p>
          </div>
        </div>
        <BudgetChart data={budgetData || []} loading={budgetLoading} />
      </Card>

      {/* Recent Requests */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Requests</h2>
          <a href="/usage" className="text-sm text-accent hover:text-accent-hover">
            View all
          </a>
        </div>
        <Table
          columns={columns}
          data={recentRecords}
          keyExtractor={(item) => item.id}
          loading={usageLoading}
          emptyMessage="No requests yet"
        />
      </div>
    </div>
  )
}
