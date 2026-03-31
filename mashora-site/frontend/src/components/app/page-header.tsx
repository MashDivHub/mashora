import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between', className)}>
      <div className="space-y-3">
        {eyebrow ? (
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">{eyebrow}</div>
        ) : null}
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h1>
          {description ? <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  )
}
