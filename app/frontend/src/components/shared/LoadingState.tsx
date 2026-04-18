import { cn } from '@mashora/design-system'
import { Loader2 } from 'lucide-react'

export interface LoadingStateProps {
  label?: string
  className?: string
  /** Render as a compact inline spinner (e.g. inside a table cell) */
  inline?: boolean
}

export default function LoadingState({ label = 'Loading...', className, inline }: LoadingStateProps) {
  if (inline) {
    return (
      <span
        role="status"
        aria-busy="true"
        aria-live="polite"
        className={cn('inline-flex items-center gap-2 text-sm text-muted-foreground', className)}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {label}
      </span>
    )
  }

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn('flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground', className)}
    >
      <Loader2 className="h-6 w-6 animate-spin" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  )
}
