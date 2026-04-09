import type { FieldProps } from './FieldRegistry'
import { Input, cn } from '@mashora/design-system'
import { formatMonetary } from '../utils/format'

export default function MonetaryField({ name, value, fieldMeta, record, onChange, readonly, className }: FieldProps) {
  const currencyField = fieldMeta.currency_field || 'currency_id'
  const currency = record[currencyField]
  const symbol = Array.isArray(currency) ? currency[1]?.split(' ')[0] || '$' : '$'

  if (readonly) {
    return <span className={cn('text-sm font-mono tabular-nums py-1 block', className)}>{formatMonetary(value, symbol) || <span className="text-muted-foreground/40">&mdash;</span>}</span>
  }

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{symbol}</span>
      <Input
        id={name}
        type="number"
        step="0.01"
        value={value ?? ''}
        onChange={e => onChange?.(e.target.value ? parseFloat(e.target.value) : 0)}
        className={cn('rounded-xl h-9 font-mono pl-8', className)}
      />
    </div>
  )
}
