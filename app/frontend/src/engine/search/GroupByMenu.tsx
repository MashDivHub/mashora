import { useEffect, useRef } from 'react'
import { Checkbox, cn } from '@mashora/design-system'
import type { SearchGroupBy } from './SearchController'

interface GroupByMenuProps {
  groupBys: SearchGroupBy[]
  activeGroupBys: SearchGroupBy[]
  onToggle: (groupBy: SearchGroupBy) => void
  onClose: () => void
}

export default function GroupByMenu({ groupBys, activeGroupBys, onToggle, onClose }: GroupByMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const activeIds = new Set(activeGroupBys.map(g => g.id))

  return (
    <div ref={ref} className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border bg-popover shadow-lg overflow-hidden">
      <div className="border-b border-border/70 bg-muted/20 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Group By</p>
      </div>
      <div className="max-h-64 overflow-y-auto p-1">
        {groupBys.map(gb => (
          <button
            key={gb.id}
            onClick={() => onToggle(gb)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
          >
            <Checkbox checked={activeIds.has(gb.id)} className="pointer-events-none" />
            <span className={cn(activeIds.has(gb.id) && 'font-medium')}>{gb.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
