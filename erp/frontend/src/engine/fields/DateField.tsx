import type { FieldProps } from './FieldRegistry'
import { Input, cn } from '@mashora/design-system'
import { formatDate } from '../utils/format'

export default function DateField({ name, value, onChange, readonly, className }: FieldProps) {
  if (readonly) {
    return <span className={cn('text-sm py-1 block', className)}>{formatDate(value) || <span className="text-muted-foreground/40">&mdash;</span>}</span>
  }

  return (
    <Input
      id={name}
      type="date"
      value={value || ''}
      onChange={e => onChange?.(e.target.value || false)}
      className={cn('rounded-xl h-9', className)}
    />
  )
}
