import * as React from 'react'
import { cn } from '../../lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon?: React.ReactNode
  trend?: { value: number; label: string }
  className?: string
}

function StatCard({ title, value, description, icon, trend, className }: StatCardProps) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-6 transition-all hover:shadow-md', className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-2xl font-bold">{value}</p>
        {trend && (
          <span className={cn('text-xs font-medium', trend.value >= 0 ? 'text-success' : 'text-destructive')}>
            {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
          </span>
        )}
      </div>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
    </div>
  )
}

export { StatCard }
