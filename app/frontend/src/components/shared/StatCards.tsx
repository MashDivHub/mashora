import type { ReactNode } from 'react'
import { cn } from '@mashora/design-system'

export interface StatCardData {
  label: string
  value: string | number
  /** Sub-value or change indicator */
  sub?: string
  /** Color accent */
  color?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  /** Icon component */
  icon?: ReactNode
  /** Click handler */
  onClick?: () => void
}

export interface StatCardsProps {
  stats: StatCardData[]
  className?: string
  /** Number of columns (default: auto based on count) */
  columns?: 2 | 3 | 4 | 5
}

const COLOR_MAP = {
  default: 'border-border/50',
  success: 'border-emerald-500/30',
  warning: 'border-amber-500/30',
  danger: 'border-red-500/30',
  info: 'border-blue-500/30',
}

const ICON_BG_MAP = {
  default: 'bg-muted/50 text-muted-foreground',
  success: 'bg-emerald-500/10 text-emerald-500',
  warning: 'bg-amber-500/10 text-amber-500',
  danger: 'bg-red-500/10 text-red-500',
  info: 'bg-blue-500/10 text-blue-500',
}

export default function StatCards({ stats, className, columns }: StatCardsProps) {
  const cols = columns || Math.min(stats.length, 4)

  return (
    <div className={cn(
      'grid gap-3',
      cols === 2 && 'grid-cols-2',
      cols === 3 && 'grid-cols-2 md:grid-cols-3',
      cols === 4 && 'grid-cols-2 md:grid-cols-4',
      cols === 5 && 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
      className,
    )}>
      {stats.map((stat, i) => {
        const color = stat.color || 'default'
        const Wrapper = stat.onClick ? 'button' : 'div'
        return (
          <Wrapper
            key={i}
            onClick={stat.onClick}
            className={cn(
              'rounded-2xl border bg-card p-4 text-left transition-all',
              COLOR_MAP[color],
              stat.onClick && 'cursor-pointer hover:bg-muted/20 hover:-translate-y-0.5 hover:shadow-md',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground truncate">
                  {stat.label}
                </p>
                <p className="text-2xl font-bold tracking-tight mt-1 tabular-nums">
                  {stat.value}
                </p>
                {stat.sub && (
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
                )}
              </div>
              {stat.icon && (
                <div className={cn('rounded-xl p-2.5 shrink-0', ICON_BG_MAP[color])}>
                  {stat.icon}
                </div>
              )}
            </div>
          </Wrapper>
        )
      })}
    </div>
  )
}
