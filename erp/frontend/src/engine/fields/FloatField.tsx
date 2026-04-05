import type { FieldProps } from './FieldRegistry'
import { Input, cn } from '@mashora/design-system'
import { formatFloat } from '../utils/format'

export default function FloatField({ name, value, fieldMeta, onChange, readonly, widget, className }: FieldProps) {
  const precision = fieldMeta.digits ? fieldMeta.digits[1] : 2

  if (readonly) {
    if (widget === 'percentage') return <span className="text-sm font-mono tabular-nums py-1 block">{formatFloat(value, precision)}%</span>
    return <span className={cn('text-sm font-mono tabular-nums py-1 block', className)}>{formatFloat(value, precision) || <span className="text-muted-foreground/40">&mdash;</span>}</span>
  }

  return (
    <Input
      id={name}
      type="number"
      step={Math.pow(10, -precision)}
      value={value ?? ''}
      onChange={e => onChange?.(e.target.value ? parseFloat(e.target.value) : 0)}
      className={cn('rounded-xl h-9 font-mono', className)}
    />
  )
}
