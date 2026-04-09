import { Badge } from '@mashora/design-system'
import { X, Filter, LayoutGrid } from 'lucide-react'
import type { SearchFilter, SearchGroupBy } from './SearchController'

interface SearchFacetsProps {
  filters: SearchFilter[]
  groupBys: SearchGroupBy[]
  onRemoveFilter: (id: string) => void
  onRemoveGroupBy: (id: string) => void
}

export default function SearchFacets({ filters, groupBys, onRemoveFilter, onRemoveGroupBy }: SearchFacetsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {filters.map(f => (
        <Badge key={f.id} variant="secondary" className="gap-1 rounded-full pl-2 pr-1 py-0.5">
          <Filter className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs">{f.label}</span>
          <button
            onClick={() => onRemoveFilter(f.id)}
            className="ml-0.5 rounded-full p-0.5 hover:bg-background/50 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {groupBys.map(g => (
        <Badge key={g.id} variant="outline" className="gap-1 rounded-full pl-2 pr-1 py-0.5">
          <LayoutGrid className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs">{g.label}</span>
          <button
            onClick={() => onRemoveGroupBy(g.id)}
            className="ml-0.5 rounded-full p-0.5 hover:bg-background/50 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  )
}
