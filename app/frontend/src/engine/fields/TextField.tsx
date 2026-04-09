import type { FieldProps } from './FieldRegistry'
import { Textarea, cn } from '@mashora/design-system'
import { sanitizedHtml } from '@/lib/sanitize'

export default function TextField({ name, value, onChange, readonly, fieldMeta, className }: FieldProps) {
  if (readonly) {
    if (fieldMeta.type === 'html' && value) {
      return <div className={cn('prose prose-sm dark:prose-invert max-w-none', className)} dangerouslySetInnerHTML={sanitizedHtml(value)} />
    }
    return <p className={cn('text-sm whitespace-pre-wrap py-1', className)}>{value || <span className="text-muted-foreground/40">&mdash;</span>}</p>
  }

  return (
    <Textarea
      id={name}
      value={value || ''}
      onChange={e => onChange?.(e.target.value)}
      rows={3}
      className={cn('rounded-xl resize-y min-h-[80px]', className)}
    />
  )
}
