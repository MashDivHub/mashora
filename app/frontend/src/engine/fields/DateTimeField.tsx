import type { FieldProps } from './FieldRegistry'
import { Input, cn } from '@mashora/design-system'
import { formatDateTime } from '../utils/format'

export default function DateTimeField({ name, value, onChange, readonly, className }: FieldProps) {
  if (readonly) {
    return <span className={cn('text-sm py-1 block', className)}>{formatDateTime(value) || <span className="text-muted-foreground/40">&mdash;</span>}</span>
  }

  return (
    <Input
      id={name}
      type="datetime-local"
      value={value ? value.replace(' ', 'T').slice(0, 16) : ''}
      onChange={e => onChange?.(e.target.value ? e.target.value.replace('T', ' ') + ':00' : false)}
      className={cn('rounded-xl h-9', className)}
    />
  )
}
