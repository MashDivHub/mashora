import type { FieldProps } from './FieldRegistry'
import { cn } from '@mashora/design-system'
import { Download, Upload } from 'lucide-react'

export default function BinaryField({ name, value, onChange, readonly, widget, className }: FieldProps) {
  if (widget === 'image' && value) {
    const src = typeof value === 'string' && value.startsWith('data:') ? value : `data:image/png;base64,${value}`
    return <img src={src} alt={name} className={cn('max-h-32 rounded-xl object-contain', className)} />
  }

  if (readonly) {
    if (!value) return <span className="text-sm text-muted-foreground/40">&mdash;</span>
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-primary cursor-pointer hover:underline">
        <Download className="h-3.5 w-3.5" />
        Download
      </span>
    )
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <label className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 px-3 py-1.5 text-sm cursor-pointer hover:bg-muted/40 transition-colors">
        <input
          type="file"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (!file) return
            const reader = new FileReader()
            reader.onload = () => {
              const base64 = (reader.result as string).split(',')[1]
              onChange?.(base64)
            }
            reader.readAsDataURL(file)
          }}
        />
        <Upload className="h-3.5 w-3.5" /> Upload
      </label>
      {value && <span className="text-xs text-muted-foreground">File attached</span>}
    </div>
  )
}
