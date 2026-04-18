import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, cn } from '@mashora/design-system'
import { Plus, ChevronLeft } from 'lucide-react'

export interface PageHeaderProps {
  title: ReactNode
  subtitle?: string
  /** Show a "New" button — pass the route or onClick handler */
  onNew?: string | (() => void)
  newLabel?: string
  /** Show a back button */
  backTo?: string | (() => void)
  backLabel?: string
  icon?: ReactNode
  /** Extra action buttons on the right */
  actions?: ReactNode
  /** Extra content below the title (e.g., filter chips) */
  children?: ReactNode
  className?: string
}

export default function PageHeader({
  title, subtitle, onNew, newLabel = 'New', backTo, actions, children, className,
}: PageHeaderProps) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (typeof backTo === 'string') navigate(backTo)
    else if (typeof backTo === 'function') backTo()
    else navigate(-1)
  }

  const handleNew = () => {
    if (typeof onNew === 'string') navigate(onNew)
    else if (typeof onNew === 'function') onNew()
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {backTo && (
            <button onClick={handleBack} aria-label="Go back" className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <div className="min-w-0">
            {subtitle && (
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                {subtitle}
              </p>
            )}
            <h1 className="text-xl font-semibold tracking-tight truncate">{title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {actions}
          {onNew && (
            <Button size="sm" className="rounded-xl gap-1.5" onClick={handleNew}>
              <Plus className="h-3.5 w-3.5" /> {newLabel}
            </Button>
          )}
        </div>
      </div>
      {children}
    </div>
  )
}
