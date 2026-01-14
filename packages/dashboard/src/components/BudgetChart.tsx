import type { BudgetUtilization } from '../types'

interface BudgetChartProps {
  data: BudgetUtilization[]
  loading?: boolean
}

export default function BudgetChart({ data, loading }: BudgetChartProps) {
  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="inline-block animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-zinc-400">
        No data available
      </div>
    )
  }

  const maxSpent = Math.max(...data.map(d => d.spent))
  const budget = data[0]?.budget || 800
  const chartMax = Math.max(maxSpent * 1.2, budget)

  return (
    <div className="h-64">
      {/* Y-axis labels */}
      <div className="flex h-full">
        <div className="flex flex-col justify-between text-xs text-zinc-500 pr-3 py-1">
          <span>${chartMax.toFixed(0)}</span>
          <span>${(chartMax * 0.75).toFixed(0)}</span>
          <span>${(chartMax * 0.5).toFixed(0)}</span>
          <span>${(chartMax * 0.25).toFixed(0)}</span>
          <span>$0</span>
        </div>

        {/* Chart area */}
        <div className="flex-1 relative border-l border-b border-border">
          {/* Budget line */}
          <div
            className="absolute left-0 right-0 border-t border-dashed border-yellow-500/50"
            style={{ bottom: `${(budget / chartMax) * 100}%` }}
          >
            <span className="absolute right-0 -top-5 text-xs text-yellow-500">
              Budget: ${budget}
            </span>
          </div>

          {/* Bars */}
          <div className="absolute inset-0 flex items-end justify-between gap-1 px-1">
            {data.map((item, index) => {
              const height = (item.spent / chartMax) * 100
              const isOverBudget = item.spent > budget
              const dayLabel = new Date(item.date).getDate()

              return (
                <div
                  key={item.date}
                  className="flex-1 flex flex-col items-center group relative"
                >
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-bg-tertiary border border-border rounded px-2 py-1 text-xs whitespace-nowrap z-10">
                    <p className="text-white">${item.spent.toFixed(2)}</p>
                    <p className="text-zinc-400">{item.date}</p>
                  </div>

                  {/* Bar */}
                  <div
                    className={`w-full rounded-t transition-all ${
                      isOverBudget ? 'bg-red-500' : 'bg-accent'
                    } hover:opacity-80`}
                    style={{ height: `${height}%`, minHeight: item.spent > 0 ? '2px' : 0 }}
                  />

                  {/* X-axis label (show every 5th) */}
                  {index % 5 === 0 && (
                    <span className="absolute -bottom-5 text-xs text-zinc-500">
                      {dayLabel}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
