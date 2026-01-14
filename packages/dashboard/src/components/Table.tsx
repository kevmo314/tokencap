import { ReactNode } from 'react'

interface Column<T> {
  key: string
  header: string
  render?: (item: T) => ReactNode
  className?: string
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (item: T) => string
  emptyMessage?: string
  loading?: boolean
}

export default function Table<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'No data available',
  loading = false,
}: TableProps<T>) {
  if (loading) {
    return (
      <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden">
        <div className="p-8 text-center">
          <div className="inline-block animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full" />
          <p className="mt-2 text-zinc-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden">
        <div className="p-8 text-center text-zinc-400">
          {emptyMessage}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {columns.map(column => (
                <th
                  key={column.key}
                  className={`px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider ${column.className || ''}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map(item => (
              <tr
                key={keyExtractor(item)}
                className="hover:bg-white/5 transition-colors"
              >
                {columns.map(column => (
                  <td
                    key={column.key}
                    className={`px-6 py-4 text-sm text-zinc-300 whitespace-nowrap ${column.className || ''}`}
                  >
                    {column.render
                      ? column.render(item)
                      : String((item as Record<string, unknown>)[column.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
