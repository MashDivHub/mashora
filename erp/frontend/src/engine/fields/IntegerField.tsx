import type { FieldProps } from './FieldRegistry'
import { Input, Progress, cn } from '@mashora/design-system'
import { formatInteger } from '../utils/format'

export default function IntegerField({ name, value, onChange, readonly, widget, className }: FieldProps) {
  if (widget === 'progressbar') {
    return <Progress value={Number(value) || 0} className="h-2" />
  }

  if (readonly) {
    if (widget === 'percentage') return <span className="text-sm font-mono tabular-nums py-1 block">{value ?? 0}%</span>
    return <span className={cn('text-sm font-mono tabular-nums py-1 block', className)}>{formatInteger(value) || <span className="text-muted-foreground/40">&mdash;</span>}</span>
  }

  return (
    <Input
      id={name}
      type="number"
      value={value ?? ''}
      onChange={e => onChange?.(e.target.value ? parseInt(e.target.value) : 0)}
      className={cn('rounded-xl h-9 font-mono', className)}
    />
  )
}
