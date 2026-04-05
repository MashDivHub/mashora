import type { ReactNode } from 'react'
import { Button, cn } from '@mashora/design-system'
import { Inbox, Plus } from 'lucide-react'

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export default function EmptyState({ icon, title, description, actionLabel, onAction, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      <div className="mb-4 text-muted-foreground/30">
        {icon || <Inbox className="h-12 w-12" />}
      </div>
      <p className="text-lg font-medium text-muted-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground/60 mt-1 max-w-sm">{description}</p>}
      {actionLabel && onAction && (
        <Button size="sm" className="mt-4 rounded-xl gap-1.5" onClick={onAction}>
          <Plus className="h-3.5 w-3.5" /> {actionLabel}
        </Button>
      )}
    </div>
  )
}
