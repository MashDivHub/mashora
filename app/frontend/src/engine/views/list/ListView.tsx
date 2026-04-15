import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Skeleton,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  cn,
} from '@mashora/design-system'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import type { ViewProps } from '../../ViewRegistry'
import SearchPanel from '../../search/SearchPanel'
import type { SearchState } from '../../search/SearchController'
import { buildSearchDomain, createSearchState } from '../../search/SearchController'
import { fetchViewDefinition } from '../../ActionService'
import { combineDomains } from '../../utils/domain'
import type { Domain } from '../../utils/domain'
import { erpClient } from '@/lib/erp-api'
import { formatDate, formatDateTime, formatFloat, formatInteger, formatMonetary, formatMany2one, formatSelection } from '../../utils/format'

/** Extract visible columns from the list/tree arch */
function extractListColumns(arch: any, fields: Record<string, any>): { name: string; label: string; type: string; width?: string }[] {
  const columns: { name: string; label: string; type: string; width?: string }[] = []
  const children = arch?.children || []

  for (const child of children) {
    if (child.tag !== 'field') continue
    const name = child.name || child.attrs?.name
    if (!name) continue
    // Skip invisible fields
    const inv = child.invisible || child.attrs?.invisible
    if (inv === '1' || inv === 'True' || inv === 'true') continue
    // Skip fields without metadata
    const meta = fields[name]
    if (!meta) continue

    columns.push({
      name,
      label: child.string || child.attrs?.string || meta.string || name,
      type: meta.type,
      width: child.attrs?.width,
    })
  }

  // Always ensure we have at least name/display_name
  if (columns.length === 0 && fields['name']) {
    columns.push({ name: 'name', label: fields['name'].string || 'Name', type: 'char' })
  }

  return columns
}

/** Format a cell value based on field type */
function formatCell(value: any, type: string, meta: any): string {
  if (value === null || value === undefined || value === false) return ''
  switch (type) {
    case 'many2one': return formatMany2one(value)?.name || ''
    case 'many2many':
    case 'one2many': return Array.isArray(value) ? `${value.length} record(s)` : ''
    case 'date': return formatDate(value)
    case 'datetime': return formatDateTime(value)
    case 'float': return formatFloat(value, meta?.digits?.[1] ?? 2)
    case 'monetary': {
      const sym = '$' // simplified
      return formatMonetary(value, sym)
    }
    case 'integer': return formatInteger(value)
    case 'selection': return formatSelection(value, meta?.selection || [])
    case 'boolean': return value ? 'Yes' : 'No'
    default: return String(value)
  }
}

export default function ListView({ model, action, domain: actionDomain }: ViewProps) {
  const navigate = useNavigate()
  const [searchState, setSearchState] = useState<SearchState>(createSearchState)
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const pageSize = 40

  // Fetch list view definition
  const { data: viewDef } = useQuery({
    queryKey: ['viewDef', model, 'list'],
    queryFn: async () => {
      try {
        return await fetchViewDefinition(model, 'list')
      } catch {
        // Fallback to tree view type
        return await fetchViewDefinition(model, 'tree')
      }
    },
    staleTime: 5 * 60 * 1000,
  })

  // Fetch search view
  const { data: searchViewDef } = useQuery({
    queryKey: ['searchView', model],
    queryFn: () => fetchViewDefinition(model, 'search'),
    staleTime: 5 * 60 * 1000,
  })

  const handleSearchChange = useCallback((state: SearchState) => {
    setSearchState(state)
    setPage(0)
  }, [])

  // Build domain
  const searchDomain = buildSearchDomain(searchState, 'name')
  const effectiveDomain: Domain = combineDomains([
    ...(actionDomain && actionDomain.length > 0 ? [actionDomain as Domain] : []),
    ...(searchDomain.length > 0 ? [searchDomain] : []),
  ])

  // Extract columns from view arch
  const columns = viewDef ? extractListColumns(viewDef.arch, viewDef.fields || {}) : []
  const fieldNames = columns.map(c => c.name)

  // Build sort order
  const order = sortField ? `${sortField} ${sortDir}` : undefined

  // Fetch records
  const { data, isLoading } = useQuery({
    queryKey: ['list', model, effectiveDomain, page, order, fieldNames],
    queryFn: async () => {
      const { data } = await erpClient.raw.post(`/model/${model}`, {
        domain: effectiveDomain.length ? effectiveDomain : undefined,
        fields: fieldNames.length ? fieldNames : undefined,
        offset: page * pageSize,
        limit: pageSize,
        order,
      })
      return data
    },
    enabled: columns.length > 0,
  })

  const records = data?.records || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / pageSize)
  const modelLabel = action?.name || model.split('.').pop()?.replace(/_/g, ' ') || model

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            {model.replace(/\./g, ' ')}
          </p>
          <h1 className="text-xl font-semibold tracking-tight capitalize">{modelLabel}</h1>
        </div>
        <Button size="sm" className="rounded-xl gap-1.5" onClick={() => navigate(`/admin/model/${model}/new`)}>
          <Plus className="h-3.5 w-3.5" /> New
        </Button>
      </div>

      {/* Search */}
      <SearchPanel
        model={model}
        searchViewDef={searchViewDef}
        onSearchChange={handleSearchChange}
      />

      {/* Table */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        {isLoading || !viewDef ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/40">
                    {columns.map(col => (
                      <TableHead
                        key={col.name}
                        className="h-10 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 cursor-pointer hover:text-foreground transition-colors select-none"
                        onClick={() => handleSort(col.name)}
                      >
                        <div className="flex items-center gap-1">
                          {col.label}
                          {sortField === col.name ? (
                            sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronsUpDown className="h-3 w-3 opacity-30" />
                          )}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                        No records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    records.map((rec: any) => (
                      <TableRow
                        key={rec.id}
                        className="border-border/30 hover:bg-muted/20 cursor-pointer transition-colors"
                        onClick={() => navigate(`/admin/model/${model}/${rec.id}`)}
                      >
                        {columns.map((col, ci) => (
                          <TableCell
                            key={col.name}
                            className={cn(
                              'py-2.5 text-sm',
                              ci === 0 && 'font-medium',
                              ['float', 'integer', 'monetary'].includes(col.type) && 'text-right tabular-nums font-mono',
                            )}
                          >
                            {formatCell(rec[col.name], col.type, viewDef.fields?.[col.name])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-border/40 px-4 py-2.5 text-sm text-muted-foreground">
              <span>
                {total > 0
                  ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, total)} of ${total}`
                  : '0 records'}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 rounded-lg"
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 text-xs">
                  {totalPages > 0 ? `${page + 1} / ${totalPages}` : '—'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 rounded-lg"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
