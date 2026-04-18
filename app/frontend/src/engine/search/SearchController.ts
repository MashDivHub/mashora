import type { Domain } from '../utils/domain'
import { combineDomains } from '../utils/domain'

export interface SearchFilter {
  id: string
  label: string
  domain: Domain
  isActive: boolean
  group?: string  // filters in same group combine with OR
}

export interface SearchGroupBy {
  id: string
  label: string
  fieldName: string
  isActive: boolean
}

export interface SearchFavorite {
  id: string
  name: string
  filters: string[]   // active filter IDs
  groupBys: string[]  // active groupby IDs
  searchText: string
}

export interface SearchState {
  searchText: string
  activeFilters: SearchFilter[]
  activeGroupBys: SearchGroupBy[]
  favorites: SearchFavorite[]
}

export function createSearchState(): SearchState {
  return {
    searchText: '',
    activeFilters: [],
    activeGroupBys: [],
    favorites: [],
  }
}

export function buildSearchDomain(state: SearchState, recName: string = 'name'): Domain {
  const domains: Domain[] = []

  // Free text search
  if (state.searchText.trim()) {
    domains.push([[recName, 'ilike', state.searchText.trim()]])
  }

  // Group active filters by group (same group = OR, different groups = AND)
  const groups: Record<string, Domain[]> = {}
  for (const filter of state.activeFilters) {
    const groupKey = filter.group || filter.id
    if (!groups[groupKey]) groups[groupKey] = []
    groups[groupKey].push(filter.domain)
  }

  for (const groupDomains of Object.values(groups)) {
    if (groupDomains.length === 1) {
      domains.push(groupDomains[0])
    } else {
      // OR within group: prepend | operators
      const orDomain: Domain = []
      for (let i = 0; i < groupDomains.length - 1; i++) orDomain.push('|')
      for (const d of groupDomains) orDomain.push(...d)
      domains.push(orDomain)
    }
  }

  return combineDomains(domains)
}

export function getActiveGroupByFields(state: SearchState): string[] {
  return state.activeGroupBys.map(g => g.fieldName)
}

// Favorites persistence
const FAVORITES_KEY = 'mashora_search_favorites_'

export function loadFavorites(model: string): SearchFavorite[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY + model)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveFavorites(model: string, favorites: SearchFavorite[]): void {
  try {
    localStorage.setItem(FAVORITES_KEY + model, JSON.stringify(favorites))
  } catch {
    /* ignore: localStorage may be full or disabled (private mode) — favorites remain in memory */
  }
}
