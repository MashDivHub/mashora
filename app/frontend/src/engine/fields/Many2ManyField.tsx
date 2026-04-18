import type { FieldProps } from './FieldRegistry'
import { Badge, cn } from '@mashora/design-system'

export default function Many2ManyField({ value, readonly, className }: FieldProps) {
  // value can be array of IDs or array of [id, name] tuples
  const items = Array.isArray(value) ? value : []

  if (items.length === 0) {
    return readonly ? <span className="text-sm text-muted-foreground">None</span> : null
  }

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {items.map((item: unknown, i: number) => {
        const label = Array.isArray(item)
          ? String(item[1] ?? '')
          : typeof item === 'object' && item !== null
            ? String((item as { display_name?: unknown; name?: unknown }).display_name ?? (item as { name?: unknown }).name ?? '')
            : String(item)
        return (
          <Badge key={i} variant="secondary" className="rounded-full">
            {label}
          </Badge>
        )
      })}
    </div>
  )
}
