import type { FieldProps } from './FieldRegistry'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Badge, cn, statusToBadgeVariant } from '@mashora/design-system'
import { formatSelection } from '../utils/format'
import { Check } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  draft: 'secondary', sent: 'info', sale: 'success', purchase: 'success',
  done: 'success', cancel: 'destructive', posted: 'default', paid: 'success',
  confirmed: 'success', progress: 'warning', waiting: 'warning',
  open: 'info', close: 'secondary', new: 'info',
}

export default function SelectionField({ name, value, fieldMeta, onChange, readonly, widget, className }: FieldProps) {
  const options = fieldMeta.selection || []

  if (widget === 'statusbar') {
    const currentIdx = options.findIndex(([k]: [string, string]) => k === value)
    return (
      <div className="flex items-center gap-0.5">
        {options.map(([key, label]: [string, string], idx: number) => {
          const isCurrent = key === value
          const isPast = currentIdx >= 0 && idx < currentIdx

          return (
            <div
              key={key}
              className={cn(
                'relative px-4 py-1.5 text-xs font-medium transition-all select-none',
                // Arrow-shaped pill styling
                'first:rounded-l-full last:rounded-r-full',
                isCurrent && 'bg-primary text-primary-foreground shadow-sm',
                isPast && 'bg-primary/15 text-primary',
                !isCurrent && !isPast && 'bg-muted/40 text-muted-foreground/50',
              )}
            >
              <span className="flex items-center gap-1">
                {isPast && <Check className="h-3 w-3" />}
                {label}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  if (readonly || widget === 'badge') {
    const label = formatSelection(value, options)
    const variant = statusToBadgeVariant(STATUS_COLORS[value as string])
    return <Badge variant={variant} className={cn('text-xs', className)}>{label || <span className="text-muted-foreground/40">&mdash;</span>}</Badge>
  }

  return (
    <Select value={value || ''} onValueChange={v => onChange?.(v)}>
      <SelectTrigger className={cn('rounded-xl h-9', className)}>
        <SelectValue placeholder="Select..." />
      </SelectTrigger>
      <SelectContent>
        {options.map(([key, label]: [string, string]) => (
          <SelectItem key={key} value={key}>{label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
