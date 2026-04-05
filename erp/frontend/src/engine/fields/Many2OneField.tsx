import { useState, useEffect, useRef } from 'react'
import type { FieldProps } from './FieldRegistry'
import { Input, cn } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { formatMany2one } from '../utils/format'
import { Search, X } from 'lucide-react'

export default function Many2OneField({ name, value, fieldMeta, onChange, readonly, className }: FieldProps) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<{ id: number; display_name: string }[]>([])
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const formatted = formatMany2one(value)

  if (readonly) {
    return (
      <span className={cn('text-sm block py-1', className)}>
        {formatted?.name || <span className="text-muted-foreground/40">&mdash;</span>}
      </span>
    )
  }

  useEffect(() => {
    if (!search || !fieldMeta.relation) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await erpClient.raw.post(`/model/${fieldMeta.relation}/name_search`, {
          name: search, limit: 8,
        })
        setResults(data.results || [])
        setOpen(true)
      } catch { setResults([]) }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [search, fieldMeta.relation])

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
        <Input
          id={name}
          value={open ? search : (formatted?.name || '')}
          onChange={e => { setSearch(e.target.value); if (!e.target.value) onChange?.(false) }}
          onFocus={() => { setSearch(formatted?.name || ''); setOpen(true) }}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Search..."
          className={cn('rounded-xl h-9 pl-9 pr-8', className)}
          autoComplete="off"
        />
        {formatted && (
          <button
            type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
            onMouseDown={(e) => { e.preventDefault(); onChange?.(false); setSearch('') }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border/60 bg-popover shadow-lg max-h-48 overflow-y-auto">
          {results.map(r => (
            <button
              key={r.id}
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors first:rounded-t-xl last:rounded-b-xl"
              onMouseDown={() => { onChange?.([r.id, r.display_name]); setOpen(false) }}
            >
              {r.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
