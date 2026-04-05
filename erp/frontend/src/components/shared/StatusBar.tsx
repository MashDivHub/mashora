import { cn } from '@mashora/design-system'
import { Check } from 'lucide-react'

export interface StatusStep {
  key: string
  label: string
  /** Optional color override: 'success' | 'warning' | 'danger' */
  color?: 'success' | 'warning' | 'danger'
}

export interface StatusBarProps {
  steps: StatusStep[]
  current: string
  /** Called when a step is clicked (for writeable status bars) */
  onChange?: (key: string) => void
  className?: string
}

export default function StatusBar({ steps, current, onChange, className }: StatusBarProps) {
  const currentIdx = steps.findIndex(s => s.key === current)

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {steps.map((step, idx) => {
        const isCurrent = step.key === current
        const isPast = currentIdx >= 0 && idx < currentIdx
        const clickable = onChange && !isCurrent

        return (
          <button
            key={step.key}
            type="button"
            disabled={!clickable}
            onClick={() => clickable && onChange?.(step.key)}
            className={cn(
              'relative px-4 py-1.5 text-xs font-medium transition-all select-none',
              'first:rounded-l-full last:rounded-r-full',
              isCurrent && 'bg-primary text-primary-foreground shadow-sm',
              isCurrent && step.color === 'success' && 'bg-emerald-600 text-white',
              isCurrent && step.color === 'warning' && 'bg-amber-500 text-white',
              isCurrent && step.color === 'danger' && 'bg-red-600 text-white',
              isPast && 'bg-primary/15 text-primary',
              !isCurrent && !isPast && 'bg-muted/40 text-muted-foreground/50',
              clickable && 'cursor-pointer hover:bg-muted/60',
              !clickable && !isCurrent && 'cursor-default',
            )}
          >
            <span className="flex items-center gap-1">
              {isPast && <Check className="h-3 w-3" />}
              {step.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ── Helpers to create steps from Odoo selection field ── */
export function stepsFromSelection(selection: [string, string][]): StatusStep[] {
  return selection.map(([key, label]) => ({ key, label }))
}
