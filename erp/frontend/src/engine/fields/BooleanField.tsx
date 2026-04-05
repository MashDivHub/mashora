import type { FieldProps } from './FieldRegistry'
import { Checkbox, Switch, cn } from '@mashora/design-system'

export default function BooleanField({ name, value, onChange, readonly, widget, className }: FieldProps) {
  const checked = Boolean(value)

  if (readonly) {
    return <span className={cn('text-sm', className)}>{checked ? 'Yes' : 'No'}</span>
  }

  if (widget === 'toggle') {
    return <Switch id={name} checked={checked} onCheckedChange={v => onChange?.(v)} />
  }

  return (
    <Checkbox
      id={name}
      checked={checked}
      onCheckedChange={v => onChange?.(v === true)}
      className={className}
    />
  )
}
