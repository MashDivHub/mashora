import { useState, useCallback, useRef, useEffect } from 'react'
import { Input, cn } from '@mashora/design-system'
import { Search, X } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

export interface M2OInputProps {
  value: any // [id, name] or false/null
  model: string
  onChange: (value: any) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export default function M2OInput({ value, model, onChange, placeholder = 'Search...', className, disabled }: M2OInputProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ id: number; display_name: string }[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const displayName = Array.isArray(value) ? value[1] : ''

  const doSearch = useCallback((q: string) => {
    clearTimeout(debounceRef.current)
    if (!q) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await erpClient.raw.post(`/model/${model}/name_search`, { name: q, limit: 8 })
        setResults(data.results || [])
      } catch { setResults([]) }
    }, 250)
  }, [model])

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const handleSelect = (r: { id: number; display_name: string }) => {
    onChange([r.id, r.display_name])
    setOpen(false)
    setQuery('')
  }

  const handleClear = () => {
    onChange(false)
    setQuery('')
    setResults([])
  }

  if (disabled) {
    return <span className="text-sm py-1 block">{displayName || <span className="text-muted-foreground/40">&mdash;</span>}</span>
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
        <Input
          value={open ? query : displayName}
          onChange={e => { setQuery(e.target.value); doSearch(e.target.value) }}
          onFocus={() => { setQuery(displayName); setOpen(true); if (displayName) doSearch(displayName) }}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder={placeholder}
          className={cn('rounded-xl h-9 pl-9 pr-8', className)}
          autoComplete="off"
        />
        {displayName && (
          <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors"
            onMouseDown={e => { e.preventDefault(); handleClear() }}>
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border/60 bg-popover shadow-lg max-h-48 overflow-y-auto">
          {results.map(r => (
            <button key={r.id} className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors first:rounded-t-xl last:rounded-b-xl"
              onMouseDown={() => handleSelect(r)}>
              {r.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
