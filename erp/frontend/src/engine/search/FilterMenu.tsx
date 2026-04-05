import { useEffect, useRef } from 'react'
import { Checkbox, cn } from '@mashora/design-system'
import type { SearchFilter } from './SearchController'

interface FilterMenuProps {
  filters: SearchFilter[]
  activeFilters: SearchFilter[]
  onToggle: (filter: SearchFilter) => void
  onClose: () => void
}

export default function FilterMenu({ filters, activeFilters, onToggle, onClose }: FilterMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  if (filters.length === 0) {
    return (
      <div ref={ref} className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border bg-popover p-3 shadow-lg">
        <p className="text-xs text-muted-foreground">No predefined filters</p>
      </div>
    )
  }

  const activeIds = new Set(activeFilters.map(f => f.id))

  return (
    <div ref={ref} className="absolute right-0 top-full z-50 mt-1 w-64 rounded-xl border bg-popover shadow-lg overflow-hidden">
      <div className="border-b border-border/70 bg-muted/20 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Filters</p>
      </div>
      <div className="max-h-64 overflow-y-auto p-1">
        {filters.map(filter => (
          <button
            key={filter.id}
            onClick={() => onToggle(filter)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
          >
            <Checkbox checked={activeIds.has(filter.id)} className="pointer-events-none" />
            <span className={cn(activeIds.has(filter.id) && 'font-medium')}>{filter.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
