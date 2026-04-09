import { useState, useCallback, useRef, useEffect } from 'react'
import { Input, cn } from '@mashora/design-system'
import { Search, X, ChevronDown } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

export interface M2OInputProps {
  value: any // [id, name] or false/null
  model: string
  onChange: (value: any) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  domain?: any[]
}

export default function M2OInput({ value, model, onChange, placeholder = 'Select...', className, disabled, domain }: M2OInputProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ id: number; display_name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const initialLoadedRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const displayName = Array.isArray(value) ? value[1] : ''

  // Fetch options — always fetches, empty string = get all
  const fetchOptions = useCallback(async (searchText: string) => {
    setLoading(true)
    try {
      const { data } = await erpClient.raw.post(`/model/${model}/name_search`, {
        name: searchText,
        domain: domain || [],
        limit: 20,
      })
      setResults(data.results || data || [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [model, domain])

  // Debounced search for typing
  const doSearch = useCallback((q: string) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchOptions(q), 200)
  }, [fetchOptions])

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const handleOpen = () => {
    if (disabled) return
    setOpen(true)
    setQuery('')
    // Load initial options on first open
    if (!initialLoadedRef.current || results.length === 0) {
      fetchOptions('')
      initialLoadedRef.current = true
    }
  }

  const handleSelect = (r: { id: number; display_name: string }) => {
    onChange([r.id, r.display_name])
    setOpen(false)
    setQuery('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(false)
    setQuery('')
    setResults([])
    initialLoadedRef.current = false
  }

  if (disabled) {
    return <span className="text-sm py-1 block">{displayName || <span className="text-muted-foreground/40">&mdash;</span>}</span>
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger / Input */}
      {open ? (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
          <Input
            value={query}
            onChange={e => { setQuery(e.target.value); doSearch(e.target.value) }}
            placeholder="Type to filter..."
            className={cn('rounded-xl h-9 pl-9 pr-8', className)}
            autoComplete="off"
            autoFocus
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          className={cn(
            'flex items-center w-full rounded-xl h-9 px-3 text-sm text-left border border-input bg-background transition-colors hover:bg-accent/50',
            !displayName && 'text-muted-foreground',
            className
          )}
        >
          <Search className="h-3.5 w-3.5 mr-2 text-muted-foreground/40 shrink-0" />
          <span className="flex-1 truncate">{displayName || placeholder}</span>
          {displayName ? (
            <span onClick={handleClear} className="ml-1 text-muted-foreground/40 hover:text-foreground transition-colors">
              <X className="h-3.5 w-3.5" />
            </span>
          ) : (
            <ChevronDown className="h-3.5 w-3.5 ml-1 text-muted-foreground/40 shrink-0" />
          )}
        </button>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border/60 bg-popover shadow-xl max-h-56 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">Loading...</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              {query ? 'No results found' : 'No options available'}
            </div>
          ) : (
            results.map(r => (
              <button
                key={r.id}
                type="button"
                className={cn(
                  'w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors first:rounded-t-xl last:rounded-b-xl',
                  Array.isArray(value) && value[0] === r.id && 'bg-accent/50 font-medium'
                )}
                onMouseDown={() => handleSelect(r)}
              >
                {r.display_name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
