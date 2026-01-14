import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-bg-secondary border border-border rounded-xl p-6 ${className}`}>
      {children}
    </div>
  )
}

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: {
    value: number
    isPositive?: boolean
  }
  icon?: ReactNode
}

export function StatCard({ title, value, subtitle, trend, icon }: StatCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {subtitle && <p className="text-sm text-zinc-500 mt-1">{subtitle}</p>}
          {trend && (
            <p className={`text-sm mt-2 ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {trend.isPositive ? '+' : ''}{trend.value}% from last period
            </p>
          )}
        </div>
        {icon && (
          <div className="p-3 rounded-lg bg-accent/10 text-accent">
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
}
