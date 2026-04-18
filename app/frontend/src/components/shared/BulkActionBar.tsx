import { Button, Badge, cn } from '@mashora/design-system'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

export interface BulkAction {
  key: string
  label: string
  icon?: ReactNode
  variant?: 'default' | 'outline' | 'ghost' | 'destructive'
  /** Confirmation message; use {count} placeholder to show selection size */
  confirm?: string
  onClick: (selectedIds: number[]) => void | Promise<void>
}

export interface BulkActionBarProps {
  selected: number[]
  onClear: () => void
  actions: BulkAction[]
  className?: string
}

export default function BulkActionBar({ selected, onClear, actions, className }: BulkActionBarProps) {
  if (selected.length === 0) return null

  async function handleClick(action: BulkAction) {
    if (action.confirm && !confirm(action.confirm.replace('{count}', String(selected.length)))) return
    try {
      await action.onClick(selected)
    } catch {
      // error handling done by caller via toast
    }
  }

  return (
    <div className={cn(
      'sticky top-16 z-30 flex items-center gap-2 rounded-2xl border border-primary/30 bg-background/95 backdrop-blur shadow-lg p-3 mb-3',
      className,
    )}>
      <Badge className="bg-primary text-primary-foreground rounded-full text-xs">{selected.length} selected</Badge>
      <div className="flex-1 flex flex-wrap gap-1.5">
        {actions.map(a => (
          <Button
            key={a.key}
            variant={a.variant || 'outline'}
            size="sm"
            className="rounded-lg h-8 gap-1.5"
            onClick={() => handleClick(a)}
          >
            {a.icon}
            {a.label}
          </Button>
        ))}
      </div>
      <Button variant="ghost" size="sm" className="rounded-lg h-8 w-8 p-0" onClick={onClear}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
