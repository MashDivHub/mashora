import { useState, useCallback, useRef, useEffect } from 'react'
import { Input, cn } from '@mashora/design-system'
import { Search, X, ChevronDown, Plus, Loader2 } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'
import QuickCreateDialog, { QUICK_CREATE_PRESETS, type QuickCreateConfig } from './QuickCreateDialog'

export type M2OValue = [number, string] | false | null | undefined
export type M2OInput_AnyValue = M2OValue | number | { id?: number; name?: string; display_name?: string }
export type DomainTerm = string | [string, string, unknown]

export interface M2OInputProps {
  value: unknown // [id, name] tuple, false/null/undefined, number id, or {id, name} record
  model: string
  onChange: (value: [number, string] | false) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  domain?: DomainTerm[]
  /**
   * Enable inline "+ Create" in the dropdown.
   *  - `true`: uses the preset for the model (name-only fallback if no preset).
   *  - `QuickCreateConfig`: custom fields for this input.
   *  - `false` / omitted: no create button.
   */
  quickCreate?: boolean | QuickCreateConfig
}

export default function M2OInput({ value, model, onChange, placeholder = 'Select...', className, disabled, domain, quickCreate }: M2OInputProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ id: number; display_name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const initialLoadedRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const displayName = Array.isArray(value) ? value[1] : ''

  // Resolve quickCreate config.
  // - undefined (default): use preset for model if one exists, else no button
  // - true: force preset or fallback to name-only
  // - false: explicitly disabled
  // - config object: use as-is
  const quickCreateConfig: QuickCreateConfig | null = (() => {
    if (quickCreate === false) return null
    if (quickCreate && typeof quickCreate === 'object') return quickCreate
    if (quickCreate === true) {
      return QUICK_CREATE_PRESETS[model] || { fields: [{ name: 'name', label: 'Name', type: 'text', required: true }] }
    }
    // Default: auto-enable if there's a preset
    return QUICK_CREATE_PRESETS[model] || null
  })()

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

  const handleClear = (e: React.MouseEvent | React.KeyboardEvent) => {
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
        <div className="relative">
          <button
            type="button"
            onClick={handleOpen}
            className={cn(
              'flex items-center w-full rounded-xl h-9 pl-3 pr-9 text-sm text-left border border-input bg-background transition-colors hover:bg-accent/50',
              !displayName && 'text-muted-foreground',
              className
            )}
          >
            <Search className="h-3.5 w-3.5 mr-2 text-muted-foreground/40 shrink-0" />
            <span className="flex-1 truncate">{displayName || placeholder}</span>
            {!displayName && (
              <ChevronDown className="h-3.5 w-3.5 ml-1 text-muted-foreground/40 shrink-0" />
            )}
          </button>
          {displayName && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear selection"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground/40 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Dropdown */}
      {open && (() => {
        const trimmed = query.trim()
        const hasExact = results.some(r => r.display_name.toLowerCase() === trimmed.toLowerCase())
        const showCreate = !!quickCreateConfig && !loading && !hasExact
        return (
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-border/60 bg-popover shadow-xl max-h-56 overflow-y-auto">
            {loading ? (
              <div role="status" aria-busy="true" aria-live="polite" className="px-3 py-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
              </div>
            ) : (
              <>
                {results.length === 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                    {query ? 'No results found' : 'No options available'}
                  </div>
                ) : (
                  results.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors first:rounded-t-xl',
                        Array.isArray(value) && value[0] === r.id && 'bg-accent/50 font-medium'
                      )}
                      onMouseDown={() => handleSelect(r)}
                    >
                      {r.display_name}
                    </button>
                  ))
                )}
                {showCreate && (
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); setCreateOpen(true); setOpen(false) }}
                    className="w-full px-3 py-2 text-left text-sm border-t border-border/40 bg-accent/30 hover:bg-accent transition-colors last:rounded-b-xl font-medium text-primary flex items-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {trimmed ? <>Create "<span className="truncate">{trimmed}</span>"...</> : 'Create new...'}
                  </button>
                )}
              </>
            )}
          </div>
        )
      })()}

      {/* Quick-create dialog */}
      {quickCreateConfig && (
        <QuickCreateDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          model={model}
          initialQuery={query.trim()}
          config={quickCreateConfig}
          onCreated={(rec) => {
            onChange([rec.id, rec.display_name])
            setQuery('')
            setResults([])
            initialLoadedRef.current = false
          }}
        />
      )}
    </div>
  )
}
