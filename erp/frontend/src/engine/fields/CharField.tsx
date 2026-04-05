import type { FieldProps } from './FieldRegistry'
import { Input, cn } from '@mashora/design-system'

export default function CharField({ name, value, onChange, readonly, widget, className }: FieldProps) {
  if (readonly) {
    if (widget === 'url' && value) return <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">{value}</a>
    if (widget === 'email' && value) return <a href={`mailto:${value}`} className="text-sm text-primary underline">{value}</a>
    if (widget === 'phone' && value) return <a href={`tel:${value}`} className="text-sm text-primary">{value}</a>
    return <span className={cn('text-sm block py-1', className)}>{value || <span className="text-muted-foreground/40">&mdash;</span>}</span>
  }

  const inputType = widget === 'email' ? 'email' : widget === 'url' ? 'url' : widget === 'phone' ? 'tel' : 'text'

  return (
    <Input
      id={name}
      type={inputType}
      value={value || ''}
      onChange={e => onChange?.(e.target.value)}
      className={cn('rounded-xl h-9', className)}
    />
  )
}
