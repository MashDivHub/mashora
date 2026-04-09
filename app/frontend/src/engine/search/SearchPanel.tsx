import { useState, useCallback } from 'react'
import { Button, cn } from '@mashora/design-system'
import { Search, Filter, LayoutGrid, Star, X } from 'lucide-react'
import SearchFacets from './SearchFacets'
import FilterMenu from './FilterMenu'
import GroupByMenu from './GroupByMenu'
import FavoritesMenu from './FavoritesMenu'
import type { SearchState, SearchFilter, SearchGroupBy, SearchFavorite } from './SearchController'
import { createSearchState, loadFavorites, saveFavorites } from './SearchController'

interface SearchPanelProps {
  model: string
  searchViewDef?: any  // parsed search view arch + fields
  onSearchChange: (state: SearchState) => void
  className?: string
}

export default function SearchPanel({ model, searchViewDef, onSearchChange, className }: SearchPanelProps) {
  const [state, setState] = useState<SearchState>(() => ({
    ...createSearchState(),
    favorites: loadFavorites(model),
  }))
  const [filterOpen, setFilterOpen] = useState(false)
  const [groupByOpen, setGroupByOpen] = useState(false)
  const [favOpen, setFavOpen] = useState(false)

  // Parse search view to extract predefined filters and group-by options
  const predefinedFilters: SearchFilter[] = []
  const predefinedGroupBys: SearchGroupBy[] = []

  if (searchViewDef?.arch?.children) {
    let filterIndex = 0
    let groupByIndex = 0
    let currentGroup = ''

    for (const child of searchViewDef.arch.children) {
      if (child.tag === 'filter' && child.name && child.domain) {
        try {
          const domain = typeof child.domain === 'string'
            ? JSON.parse(child.domain.replace(/'/g, '"').replace(/True/g, 'true').replace(/False/g, 'false'))
            : child.domain
          predefinedFilters.push({
            id: child.name || `filter_${filterIndex++}`,
            label: child.string || child.name,
            domain,
            isActive: false,
            group: currentGroup || undefined,
          })
        } catch {}
      }
      if (child.tag === 'filter' && child.context && child.context.includes('group_by')) {
        const match = child.context.match(/group_by['"]\s*:\s*['"](\w+)/)
        if (match) {
          predefinedGroupBys.push({
            id: child.name || `groupby_${groupByIndex++}`,
            label: child.string || match[1],
            fieldName: match[1],
            isActive: false,
          })
        }
      }
      if (child.tag === 'separator') {
        currentGroup = `group_${filterIndex}`
      }
      if (child.tag === 'group') {
        for (const gc of child.children || []) {
          if (gc.tag === 'filter' && gc.context?.includes('group_by')) {
            const match = gc.context.match(/group_by['"]\s*:\s*['"](\w+)/)
            if (match) {
              predefinedGroupBys.push({
                id: gc.name || `groupby_${groupByIndex++}`,
                label: gc.string || match[1],
                fieldName: match[1],
                isActive: false,
              })
            }
          }
        }
      }
    }
  }

  const updateState = useCallback((newState: SearchState) => {
    setState(newState)
    onSearchChange(newState)
  }, [onSearchChange])

  const handleSearchText = useCallback((text: string) => {
    updateState({ ...state, searchText: text })
  }, [state, updateState])

  const toggleFilter = useCallback((filter: SearchFilter) => {
    const exists = state.activeFilters.find(f => f.id === filter.id)
    const newFilters = exists
      ? state.activeFilters.filter(f => f.id !== filter.id)
      : [...state.activeFilters, { ...filter, isActive: true }]
    updateState({ ...state, activeFilters: newFilters })
  }, [state, updateState])

  const toggleGroupBy = useCallback((groupBy: SearchGroupBy) => {
    const exists = state.activeGroupBys.find(g => g.id === groupBy.id)
    const newGroupBys = exists
      ? state.activeGroupBys.filter(g => g.id !== groupBy.id)
      : [...state.activeGroupBys, { ...groupBy, isActive: true }]
    updateState({ ...state, activeGroupBys: newGroupBys })
  }, [state, updateState])

  const removeFilter = useCallback((filterId: string) => {
    updateState({ ...state, activeFilters: state.activeFilters.filter(f => f.id !== filterId) })
  }, [state, updateState])

  const removeGroupBy = useCallback((groupById: string) => {
    updateState({ ...state, activeGroupBys: state.activeGroupBys.filter(g => g.id !== groupById) })
  }, [state, updateState])

  const clearAll = useCallback(() => {
    updateState(createSearchState())
  }, [updateState])

  const saveFavorite = useCallback((name: string) => {
    const fav: SearchFavorite = {
      id: `fav_${Date.now()}`,
      name,
      filters: state.activeFilters.map(f => f.id),
      groupBys: state.activeGroupBys.map(g => g.id),
      searchText: state.searchText,
    }
    const newFavs = [...state.favorites, fav]
    saveFavorites(model, newFavs)
    updateState({ ...state, favorites: newFavs })
  }, [state, model, updateState])

  const loadFavorite = useCallback((fav: SearchFavorite) => {
    const filters = predefinedFilters.filter(f => fav.filters.includes(f.id)).map(f => ({ ...f, isActive: true }))
    const groupBys = predefinedGroupBys.filter(g => fav.groupBys.includes(g.id)).map(g => ({ ...g, isActive: true }))
    updateState({ ...state, searchText: fav.searchText, activeFilters: filters, activeGroupBys: groupBys })
  }, [state, predefinedFilters, predefinedGroupBys, updateState])

  const deleteFavorite = useCallback((favId: string) => {
    const newFavs = state.favorites.filter(f => f.id !== favId)
    saveFavorites(model, newFavs)
    updateState({ ...state, favorites: newFavs })
  }, [state, model, updateState])

  const hasActiveSearch = state.searchText || state.activeFilters.length > 0 || state.activeGroupBys.length > 0

  return (
    <div className={cn('space-y-2', className)}>
      {/* Search bar row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            value={state.searchText}
            onChange={e => handleSearchText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') handleSearchText('') }}
            className="h-9 w-full rounded-xl border border-border/70 bg-transparent pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Filter dropdown */}
        <div className="relative">
          <Button
            variant={state.activeFilters.length > 0 ? 'default' : 'outline'}
            size="sm"
            className="rounded-xl gap-1.5"
            onClick={() => { setFilterOpen(!filterOpen); setGroupByOpen(false); setFavOpen(false) }}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {state.activeFilters.length > 0 && (
              <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary-foreground text-[10px] font-bold text-primary">
                {state.activeFilters.length}
              </span>
            )}
          </Button>
          {filterOpen && (
            <FilterMenu
              filters={predefinedFilters}
              activeFilters={state.activeFilters}
              onToggle={toggleFilter}
              onClose={() => setFilterOpen(false)}
            />
          )}
        </div>

        {/* Group By dropdown */}
        {predefinedGroupBys.length > 0 && (
          <div className="relative">
            <Button
              variant={state.activeGroupBys.length > 0 ? 'default' : 'outline'}
              size="sm"
              className="rounded-xl gap-1.5"
              onClick={() => { setGroupByOpen(!groupByOpen); setFilterOpen(false); setFavOpen(false) }}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Group By
            </Button>
            {groupByOpen && (
              <GroupByMenu
                groupBys={predefinedGroupBys}
                activeGroupBys={state.activeGroupBys}
                onToggle={toggleGroupBy}
                onClose={() => setGroupByOpen(false)}
              />
            )}
          </div>
        )}

        {/* Favorites dropdown */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-1.5"
            onClick={() => { setFavOpen(!favOpen); setFilterOpen(false); setGroupByOpen(false) }}
          >
            <Star className="h-3.5 w-3.5" />
            Favorites
          </Button>
          {favOpen && (
            <FavoritesMenu
              favorites={state.favorites}
              onLoad={loadFavorite}
              onDelete={deleteFavorite}
              onSave={saveFavorite}
              onClose={() => setFavOpen(false)}
            />
          )}
        </div>

        {hasActiveSearch && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="rounded-xl text-muted-foreground">
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Active facets */}
      {(state.activeFilters.length > 0 || state.activeGroupBys.length > 0) && (
        <SearchFacets
          filters={state.activeFilters}
          groupBys={state.activeGroupBys}
          onRemoveFilter={removeFilter}
          onRemoveGroupBy={removeGroupBy}
        />
      )}
    </div>
  )
}
