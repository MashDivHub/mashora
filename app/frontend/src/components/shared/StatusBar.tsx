import { cn } from '@mashora/design-system'
import { Check } from 'lucide-react'

export interface StatusStep {
  key: string
  label: string
  color?: 'success' | 'warning' | 'danger'
}

export interface StatusBarProps {
  steps: StatusStep[]
  current: string
  onChange?: (key: string) => void
  className?: string
}

export default function StatusBar({ steps, current, onChange, className }: StatusBarProps) {
  const currentIdx = steps.findIndex(s => s.key === current)

  return (
    <div className={cn('flex items-center gap-px', className)}>
      {steps.map((step, idx) => {
        const isCurrent = step.key === current
        const isPast = currentIdx >= 0 && idx < currentIdx
        const clickable = !!onChange && !isCurrent

        const content = (
          <span className="flex items-center gap-1">
            {isPast && <Check className="h-3 w-3" />}
            {step.label}
          </span>
        )

        const baseClass = cn(
          'relative px-4 py-1.5 text-xs font-medium select-none',
          'first:rounded-l-full last:rounded-r-full',
          isCurrent && !step.color && 'bg-primary text-primary-foreground',
          isCurrent && step.color === 'success' && 'bg-emerald-600 text-white',
          isCurrent && step.color === 'warning' && 'bg-amber-500 text-white',
          isCurrent && step.color === 'danger' && 'bg-red-600 text-white',
          isPast && 'bg-primary/15 text-primary',
          !isCurrent && !isPast && 'bg-muted/30 text-muted-foreground/40',
        )

        if (clickable) {
          return (
            <button key={step.key} type="button" onClick={() => onChange?.(step.key)}
              className={cn(baseClass, 'cursor-pointer hover:bg-muted/50 transition-colors')}>
              {content}
            </button>
          )
        }

        return <div key={step.key} className={baseClass}>{content}</div>
      })}
    </div>
  )
}

export function stepsFromSelection(selection: [string, string][]): StatusStep[] {
  return selection.map(([key, label]) => ({ key, label }))
}
