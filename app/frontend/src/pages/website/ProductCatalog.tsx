import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Button, Badge, Input, Skeleton, cn,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@mashora/design-system'
import {
  Plus, Search, Globe, Globe2, SlidersHorizontal, Filter, Layers, Star,
  X, ChevronDown, ChevronRight, Save, Trash2, Check, Settings, Download, Upload,
} from 'lucide-react'
import { PageHeader, toast } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'
import ImportDialog from '@/engine/ImportDialog'
import ExportDialog from '@/engine/ExportDialog'

// ─── Types ────────────────────────────────────────────────────────────────────

/** jsonb translatable string: can be raw string or `{ en_US: '...', ... }` */
type JsonbStr = string | Record<string, string> | false

interface Product {
  id: number
  name: JsonbStr
  list_price: number
  default_code: string | false
  categ_id: [number, string] | false
  company_id: [number, string] | false
  type: string
  sale_ok: boolean
  purchase_ok: boolean
  is_storable: boolean
  active: boolean
  qty_available?: number
}

interface SavedSearch {
  id: number
  name: string
  is_default: boolean
  domain: DomainTerm[]
  context: { groupBy?: string; filters?: string[] }
}

type DomainTerm = [string, string, unknown] | string

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL = 'product.template'

const FIELDS = [
  'id', 'name', 'list_price', 'default_code',
  'categ_id', 'company_id', 'type',
  'sale_ok', 'purchase_ok', 'is_storable', 'active',
  'qty_available',
]

interface FilterDef {
  key: string
  label: string
  group: 'type' | 'status' | 'flags' | 'archive'
  domain: DomainTerm[]
}

const FILTER_DEFS: FilterDef[] = [
  // Product type
  { key: 'services', label: 'Services', group: 'type', domain: [['type', '=', 'service']] },
  { key: 'goods', label: 'Goods', group: 'type', domain: [['type', '=', 'product']] },
  { key: 'consumables', label: 'Consumables', group: 'type', domain: [['type', '=', 'consu']] },
  // Status
  { key: 'published', label: 'Published', group: 'status', domain: [['website_published', '=', true]] },
  { key: 'inventory_managed', label: 'Inventory Managed', group: 'status', domain: [['is_storable', '=', true]] },
  // Flags
  { key: 'sales', label: 'Sales', group: 'flags', domain: [['sale_ok', '=', true]] },
  { key: 'purchase', label: 'Purchase', group: 'flags', domain: [['purchase_ok', '=', true]] },
  { key: 'favorites', label: 'Favorites', group: 'flags', domain: [['is_favorite', '=', true]] },
  // Archive
  { key: 'archived', label: 'Archived', group: 'archive', domain: [['active', '=', false]] },
]

const GROUP_BY_OPTIONS = [
  { key: '', label: '(none)' },
  { key: 'type', label: 'Product Type' },
  { key: 'categ_id', label: 'Product Category' },
  { key: 'company_id', label: 'Company' },
]

const OP_LABELS: Record<string, string> = {
  '=': 'equals', '!=': 'not equals',
  'ilike': 'contains', 'not ilike': 'does not contain',
  '>': '>', '<': '<', '>=': '>=', '<=': '<=',
  'in': 'in', 'not in': 'not in',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function str(v: unknown): string {
  if (v && typeof v === 'object') {
    const rec = v as Record<string, unknown>
    if (typeof rec.en_US === 'string') return rec.en_US
    const first = Object.values(rec)[0]
    return typeof first === 'string' ? first : ''
  }
  return v == null ? '' : String(v)
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

function productTypeLabel(type: string): string {
  if (type === 'consu') return 'Consumable'
  if (type === 'service') return 'Service'
  return 'Storable'
}

function buildDomain(activeFilters: string[], search: string, includeArchivedExplicitly: boolean): DomainTerm[] {
  const domain: DomainTerm[] = []
  // Only show active=true unless "archived" filter is explicitly on
  if (!includeArchivedExplicitly) domain.push(['active', '=', true])

  // Group active filters by their group; within a group use OR, across groups use AND.
  const byGroup: Record<string, DomainTerm[]> = {}
  for (const key of activeFilters) {
    const f = FILTER_DEFS.find(d => d.key === key)
    if (!f) continue
    if (!byGroup[f.group]) byGroup[f.group] = []
    byGroup[f.group].push(...f.domain)
  }

  for (const [, terms] of Object.entries(byGroup)) {
    if (terms.length === 0) continue
    if (terms.length === 1) {
      domain.push(terms[0])
    } else {
      // Prefix (terms.length - 1) "|" operators then the terms
      for (let i = 0; i < terms.length - 1; i++) domain.push('|')
      for (const t of terms) domain.push(t)
    }
  }

  if (search.trim()) {
    domain.push('|', ['name', 'ilike', search], ['default_code', 'ilike', search])
  }
  return domain
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductCatalog() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [customFilters, setCustomFilters] = useState<DomainTerm[]>([])
  const [groupBy, setGroupBy] = useState('')
  const [search, setSearch] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)
  const [savedSearchOpen, setSavedSearchOpen] = useState(false)
  const [customFilterOpen, setCustomFilterOpen] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  const includesArchived = activeFilters.includes('archived')
  const baseDomain = useMemo(() => buildDomain(activeFilters, search, includesArchived), [activeFilters, search, includesArchived])
  const fullDomain = useMemo(() => [...baseDomain, ...customFilters], [baseDomain, customFilters])

  // Saved searches
  const { data: savedSearches = [] } = useQuery<SavedSearch[]>({
    queryKey: ['saved-searches', MODEL],
    queryFn: async () => (await erpClient.raw.get(`/saved-searches?model=${MODEL}`)).data,
  })

  // Apply default saved search on first load
  useEffect(() => {
    const def = savedSearches.find(s => s.is_default)
    if (def && activeFilters.length === 0 && customFilters.length === 0 && !groupBy) {
      applySavedSearch(def)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedSearches.length])

  function applySavedSearch(s: SavedSearch) {
    const ctxFilters = s.context?.filters || []
    setActiveFilters(ctxFilters)
    setGroupBy(s.context?.groupBy || '')
    // Non-preset terms go into customFilters
    const presetDomains = new Set(
      ctxFilters.flatMap(k => FILTER_DEFS.find(d => d.key === k)?.domain || []).map(d => JSON.stringify(d))
    )
    const extra = (s.domain || []).filter(d => !presetDomains.has(JSON.stringify(d)) && d !== '|' && d !== '&' && d !== '!')
    setCustomFilters(extra)
  }

  // Query
  const { data, isLoading } = useQuery({
    queryKey: ['products-list', fullDomain, groupBy],
    queryFn: async () => {
      const { data } = await erpClient.raw.post(`/model/${MODEL}`, {
        domain: fullDomain,
        fields: FIELDS,
        order: groupBy ? `${groupBy} asc, name asc` : 'name asc',
        limit: 200,
      })
      return data
    },
  })

  const records: Product[] = (data?.records || []) as Product[]
  const total = data?.total ?? records.length

  // Group records if groupBy is set
  const groups = useMemo(() => {
    if (!groupBy) return null
    const map = new Map<string, Product[]>()
    for (const r of records) {
      const raw = (r as unknown as Record<string, unknown>)[groupBy]
      let key = '(none)'
      if (Array.isArray(raw)) key = raw[1] || '(none)'
      else if (typeof raw === 'string') key = raw ? productTypeLabel(raw) : '(none)'
      else if (raw != null) key = String(raw)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [records, groupBy])

  function toggleFilter(key: string) {
    setActiveFilters(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  function clearAllFilters() {
    setActiveFilters([])
    setCustomFilters([])
    setGroupBy('')
  }

  async function deleteSavedSearch(id: number) {
    if (!confirm('Delete this saved search?')) return
    try {
      await erpClient.raw.delete(`/saved-searches/${id}`)
      queryClient.invalidateQueries({ queryKey: ['saved-searches', MODEL] })
    } catch (e: unknown) {
      toast.error('Delete failed', extractErrorMessage(e))
    }
  }

  async function setDefault(id: number) {
    try {
      await erpClient.raw.post(`/saved-searches/${id}/set-default`)
      queryClient.invalidateQueries({ queryKey: ['saved-searches', MODEL] })
    } catch (e: unknown) {
      toast.error('Failed', extractErrorMessage(e))
    }
  }

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onClear: () => void }[] = []
    for (const k of activeFilters) {
      const f = FILTER_DEFS.find(d => d.key === k)
      if (f) chips.push({ key: k, label: f.label, onClear: () => toggleFilter(k) })
    }
    if (search.trim()) chips.push({ key: '__search', label: `Search: ${search.trim()}`, onClear: () => setSearch('') })
    customFilters.forEach((cf, i) => {
      if (Array.isArray(cf)) {
        chips.push({
          key: `cf-${i}`,
          label: `${cf[0]} ${OP_LABELS[cf[1]] || cf[1]} ${cf[2]}`,
          onClear: () => setCustomFilters(prev => prev.filter((_, j) => j !== i)),
        })
      }
    })
    return chips
  }, [activeFilters, search, customFilters])

  return (
    <div className="space-y-4">
      <PageHeader title="Products" subtitle="catalog" onNew={() => navigate('/admin/products/new')}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="rounded-xl h-9 w-9 p-0" title="More actions">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setTimeout(() => setImportOpen(true), 0) }}>
                <Upload className="h-4 w-4 mr-2" /> Import records
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setTimeout(() => setExportOpen(true), 0) }}>
                <Download className="h-4 w-4 mr-2" /> Export records
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {/* Top search + chips + panel trigger */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 rounded-xl" />
        </div>
        <Button type="button" variant="outline" size="sm" className="rounded-xl gap-1.5"
          onClick={() => setPanelOpen(v => !v)}>
          <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
          {(activeFilters.length + customFilters.length + (groupBy ? 1 : 0)) > 0 && (
            <Badge variant="default" className="ml-1 h-4 text-[10px] px-1.5">
              {activeFilters.length + customFilters.length + (groupBy ? 1 : 0)}
            </Badge>
          )}
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          {isLoading ? 'Loading products...' : `${total} product(s)`}
        </span>
      </div>

      {/* Active chips */}
      {activeChips.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {activeChips.map(c => (
            <span key={c.key} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs">
              {c.label}
              <button type="button" onClick={c.onClear} aria-label={`Clear filter ${c.label}`} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {groupBy && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 px-2.5 py-1 text-xs">
              Group: {GROUP_BY_OPTIONS.find(g => g.key === groupBy)?.label}
              <button type="button" onClick={() => setGroupBy('')} aria-label="Clear group by" className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {activeChips.length > 0 && (
            <button type="button" onClick={clearAllFilters}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 ml-2">
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Side panel */}
      {panelOpen && (
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Filters column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Filter className="h-3.5 w-3.5" /> Filters
            </div>
            {(['type', 'status', 'flags', 'archive'] as const).map(group => {
              const filters = FILTER_DEFS.filter(f => f.group === group)
              return (
                <div key={group} className="space-y-1">
                  {filters.map(f => {
                    const on = activeFilters.includes(f.key)
                    return (
                      <button key={f.key} type="button" onClick={() => toggleFilter(f.key)}
                        className={cn(
                          'w-full flex items-center justify-between px-2 py-1 rounded-md text-sm transition-colors',
                          on ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent text-muted-foreground'
                        )}>
                        <span>{f.label}</span>
                        {on && <Check className="h-3.5 w-3.5" />}
                      </button>
                    )
                  })}
                  {group !== 'archive' && <div className="border-t border-border/40 my-1.5" />}
                </div>
              )
            })}
            <button type="button" onClick={() => setCustomFilterOpen(true)}
              className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-sm text-primary hover:bg-accent">
              <Plus className="h-3.5 w-3.5" /> Add Custom Filter
            </button>
          </div>

          {/* Group By column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Layers className="h-3.5 w-3.5" /> Group By
            </div>
            {GROUP_BY_OPTIONS.map(g => {
              const on = groupBy === g.key
              return (
                <button key={g.key} type="button" onClick={() => setGroupBy(g.key)}
                  className={cn(
                    'w-full flex items-center justify-between px-2 py-1 rounded-md text-sm transition-colors',
                    on ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 font-medium' : 'hover:bg-accent text-muted-foreground'
                  )}>
                  <span>{g.label}</span>
                  {on && <Check className="h-3.5 w-3.5" />}
                </button>
              )
            })}
          </div>

          {/* Favorites column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Star className="h-3.5 w-3.5" /> Favorites
            </div>
            {savedSearches.length === 0 && (
              <p className="text-xs text-muted-foreground italic">No saved searches yet</p>
            )}
            {savedSearches.map(s => (
              <div key={s.id} className="group flex items-center gap-1">
                <button type="button" onClick={() => applySavedSearch(s)}
                  className="flex-1 flex items-center gap-1.5 px-2 py-1 rounded-md text-sm hover:bg-accent text-left">
                  {s.is_default && <Star className="h-3 w-3 text-amber-400 fill-current" />}
                  {s.name}
                </button>
                <button type="button" onClick={() => setDefault(s.id)} title="Make default"
                  className="p-1 rounded hover:bg-accent text-muted-foreground/50 hover:text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Star className={cn('h-3 w-3', s.is_default && 'fill-current text-amber-400')} />
                </button>
                <button type="button" onClick={() => deleteSavedSearch(s.id)} title="Delete"
                  className="p-1 rounded hover:bg-accent text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setSavedSearchOpen(true)}
              disabled={activeFilters.length === 0 && customFilters.length === 0 && !groupBy}
              className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-sm text-primary hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed">
              <Save className="h-3.5 w-3.5" /> Save current search
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-12 flex flex-col items-center justify-center gap-4 text-center">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <SlidersHorizontal className="size-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">No products found</p>
            <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters or create a new product.</p>
          </div>
          <Button onClick={() => navigate('/admin/products/new')} className="gap-2">
            <Plus className="h-4 w-4" /> New Product
          </Button>
        </div>
      ) : groups ? (
        <div className="space-y-2">
          {groups.map(([label, items]) => {
            const collapsed = expandedGroups[label] === false // default expanded
            return (
              <div key={label} className="rounded-xl border border-border/60 bg-card overflow-hidden">
                <button type="button"
                  onClick={() => setExpandedGroups(prev => ({ ...prev, [label]: prev[label] === false ? true : false }))}
                  className="w-full flex items-center gap-2 px-4 py-2.5 bg-muted/30 hover:bg-muted/50 text-left">
                  {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  <span className="text-sm font-semibold">{label}</span>
                  <Badge variant="outline" className="ml-auto text-xs">{items.length}</Badge>
                </button>
                {!collapsed && <ProductTable records={items} navigate={navigate} />}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <ProductTable records={records} navigate={navigate} />
        </div>
      )}

      {/* Save-search dialog */}
      <SaveSearchDialog open={savedSearchOpen} onClose={() => setSavedSearchOpen(false)}
        domain={fullDomain} context={{ filters: activeFilters, groupBy }}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['saved-searches', MODEL] })} />

      {/* Custom filter builder dialog */}
      <CustomFilterDialog open={customFilterOpen} onClose={() => setCustomFilterOpen(false)}
        onAdd={term => { setCustomFilters(prev => [...prev, term]); setCustomFilterOpen(false) }} />

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} model={MODEL}
        onComplete={() => queryClient.invalidateQueries({ queryKey: ['products-list'] })} />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} model={MODEL}
        domain={fullDomain} />
    </div>
  )
}

// ─── Product list table ──────────────────────────────────────────────────────

function ProductTable({ records, navigate }: { records: Product[]; navigate: (p: string) => void }) {
  return (
    <table className="w-full">
      <thead className="bg-muted/20">
        <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <th className="text-left px-4 py-2">Product</th>
          <th className="text-right px-4 py-2 w-[14%]">Price</th>
          <th className="text-left px-4 py-2 w-[14%]">Type</th>
          <th className="text-right px-4 py-2 w-[12%]">On Hand</th>
          <th className="text-left px-4 py-2 w-[20%]">Category</th>
          <th className="text-center px-4 py-2 w-[6%]"></th>
        </tr>
      </thead>
      <tbody>
        {records.map(row => (
          <tr key={row.id}
            className="border-t border-border/30 hover:bg-muted/40 cursor-pointer transition-colors"
            onClick={() => navigate(`/admin/products/${row.id}`)}>
            <td className="px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{str(row.name)}</span>
                {row.default_code && (
                  <span className="text-xs text-muted-foreground font-mono">[{row.default_code}]</span>
                )}
                {!row.active && <Badge variant="destructive" className="text-[10px]">Archived</Badge>}
              </div>
            </td>
            <td className="px-4 py-2 text-right font-mono text-sm">{formatCurrency(row.list_price || 0)}</td>
            <td className="px-4 py-2">
              <Badge variant="outline" className="text-xs">{productTypeLabel(row.type)}</Badge>
            </td>
            <td className="px-4 py-2 text-right font-mono text-sm">
              <span className={cn((row.qty_available ?? 0) <= 0 && 'text-destructive')}>
                {(row.qty_available ?? 0) > 0 ? (row.qty_available ?? 0) : 'Out'}
              </span>
            </td>
            <td className="px-4 py-2 text-sm text-muted-foreground">
              {Array.isArray(row.categ_id) ? row.categ_id[1] : '—'}
            </td>
            <td className="px-4 py-2 text-center">
              {row.sale_ok && <Globe className="h-3.5 w-3.5 inline text-emerald-400" />}
              {!row.sale_ok && <Globe2 className="h-3.5 w-3.5 inline text-muted-foreground/40" />}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Save-search dialog ─────────────────────────────────────────────────────

function SaveSearchDialog({ open, onClose, domain, context, onSaved }: {
  open: boolean
  onClose: () => void
  domain: DomainTerm[]
  context: Record<string, unknown>
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) { setName(''); setIsDefault(false) } }, [open])

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await erpClient.raw.post('/saved-searches', {
        model: MODEL, name: name.trim(), domain, context, is_default: isDefault,
      })
      toast.success('Saved search created')
      onSaved()
      onClose()
    } catch (e: unknown) {
      toast.error('Save failed', extractErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Save className="h-5 w-5 text-primary" /> Save current search</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Name</label>
            <Input value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save() }}
              placeholder="e.g. Published Goods" className="h-9 mt-1" autoFocus />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} />
            Make default search for this page
          </label>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} className="rounded-xl" disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || !name.trim()} className="rounded-xl">
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Custom filter builder dialog ────────────────────────────────────────────

const CUSTOM_FIELDS: { field: string; label: string; type: 'text' | 'number' | 'bool' | 'select'; options?: { value: string; label: string }[] }[] = [
  { field: 'name', label: 'Product Name', type: 'text' },
  { field: 'default_code', label: 'Internal Reference', type: 'text' },
  { field: 'list_price', label: 'Sales Price', type: 'number' },
  { field: 'qty_available', label: 'On-Hand Quantity', type: 'number' },
  { field: 'type', label: 'Product Type', type: 'select', options: [
    { value: 'consu', label: 'Consumable' }, { value: 'service', label: 'Service' }, { value: 'product', label: 'Storable' },
  ]},
  { field: 'sale_ok', label: 'Can be Sold', type: 'bool' },
  { field: 'purchase_ok', label: 'Can be Purchased', type: 'bool' },
  { field: 'is_storable', label: 'Is Storable', type: 'bool' },
  { field: 'active', label: 'Active', type: 'bool' },
  { field: 'website_published', label: 'Published', type: 'bool' },
]

const OPERATOR_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  text: [{ value: 'ilike', label: 'contains' }, { value: 'not ilike', label: 'does not contain' }, { value: '=', label: 'equals' }, { value: '!=', label: 'not equals' }],
  number: [{ value: '=', label: '=' }, { value: '!=', label: '≠' }, { value: '>', label: '>' }, { value: '<', label: '<' }, { value: '>=', label: '≥' }, { value: '<=', label: '≤' }],
  bool: [{ value: '=', label: 'is' }],
  select: [{ value: '=', label: 'equals' }, { value: '!=', label: 'not equals' }],
}

function CustomFilterDialog({ open, onClose, onAdd }: {
  open: boolean
  onClose: () => void
  onAdd: (term: [string, string, unknown]) => void
}) {
  const [fieldKey, setFieldKey] = useState(CUSTOM_FIELDS[0].field)
  const [operator, setOperator] = useState('ilike')
  const [value, setValue] = useState<string | boolean>('')

  const fieldDef = CUSTOM_FIELDS.find(f => f.field === fieldKey)!
  const operators = OPERATOR_BY_TYPE[fieldDef.type]

  useEffect(() => {
    if (open) {
      setFieldKey(CUSTOM_FIELDS[0].field)
      setOperator('ilike')
      setValue('')
    }
  }, [open])

  useEffect(() => {
    // Reset operator/value when field changes to an incompatible type
    if (!operators.some(o => o.value === operator)) setOperator(operators[0].value)
    if (fieldDef.type === 'bool') setValue(true)
    else if (fieldDef.type === 'select') setValue(fieldDef.options?.[0].value || '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldKey])

  function submit() {
    let v: unknown = value
    if (fieldDef.type === 'number') v = parseFloat(String(value)) || 0
    if (fieldDef.type === 'bool') v = Boolean(value)
    onAdd([fieldKey, operator, v])
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary" /> Add Custom Filter</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Field</label>
            <select value={fieldKey} onChange={e => setFieldKey(e.target.value)}
              className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm">
              {CUSTOM_FIELDS.map(f => <option key={f.field} value={f.field}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Operator</label>
            <select value={operator} onChange={e => setOperator(e.target.value)}
              className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm">
              {operators.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Value</label>
            {fieldDef.type === 'text' && (
              <Input value={String(value)} onChange={e => setValue(e.target.value)} className="h-9 mt-1" autoFocus />
            )}
            {fieldDef.type === 'number' && (
              <Input type="number" value={String(value)} onChange={e => setValue(e.target.value)} className="h-9 mt-1" autoFocus />
            )}
            {fieldDef.type === 'bool' && (
              <select value={String(value)} onChange={e => setValue(e.target.value === 'true')}
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            )}
            {fieldDef.type === 'select' && fieldDef.options && (
              <select value={String(value)} onChange={e => setValue(e.target.value)}
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-3 text-sm">
                {fieldDef.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} className="rounded-xl">Add filter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
