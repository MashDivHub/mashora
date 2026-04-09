import { useState, useCallback, useRef, useEffect } from 'react'
import { Input, Button, Badge, cn } from '@mashora/design-system'
import { Search, X, SlidersHorizontal } from 'lucide-react'

export interface FilterOption {
  key: string
  label: string
  domain?: any[]
  active?: boolean
}

export interface SearchBarProps {
  placeholder?: string
  onSearch: (query: string) => void
  /** Predefined quick filters */
  filters?: FilterOption[]
  activeFilters?: string[]
  onFilterToggle?: (key: string) => void
  /** Debounce delay in ms */
  debounce?: number
  className?: string
  children?: React.ReactNode
}

export default function SearchBar({
  placeholder = 'Search...',
  onSearch,
  filters,
  activeFilters = [],
  onFilterToggle,
  debounce = 300,
  className,
}: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const handleChange = useCallback((value: string) => {
    setQuery(value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onSearch(value), debounce)
  }, [onSearch, debounce])

  const handleClear = useCallback(() => {
    setQuery('')
    onSearch('')
  }, [onSearch])

  useEffect(() => {
    return () => clearTimeout(debounceRef.current)
  }, [])

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <Input
            value={query}
            onChange={e => handleChange(e.target.value)}
            placeholder={placeholder}
            className="pl-9 pr-8 h-9 rounded-xl"
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {filters && filters.length > 0 && (
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            size="sm"
            className="rounded-xl gap-1.5 shrink-0"
            onClick={() => setShowFilters(v => !v)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {activeFilters.length > 0 && (
              <Badge variant="default" className="h-4 min-w-4 rounded-full text-[10px] px-1">{activeFilters.length}</Badge>
            )}
          </Button>
        )}
      </div>

      {/* Filter chips */}
      {showFilters && filters && filters.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filters.map(f => {
            const active = activeFilters.includes(f.key)
            return (
              <button
                key={f.key}
                onClick={() => onFilterToggle?.(f.key)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                )}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
