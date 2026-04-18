import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, cn } from '@mashora/design-system'
import { Users, Building2, Archive, Mail } from 'lucide-react'
import {
  DataTable, PageHeader, SearchBar, BulkActionBar, ViewToggle,
  toast,
  type Column, type FilterOption, type BulkAction, type ViewMode,
} from '@/components/shared'
import { useBulkSelect } from '@/hooks/useBulkSelect'
import { erpClient } from '@/lib/erp-api'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { extractErrorMessage } from '@/lib/errors'

type DomainLeaf = unknown

interface ContactRecord {
  id: number
  name?: string
  display_name?: string
  email?: string | false
  phone?: string | false
  city?: string | false
  country_id?: [number, string] | false
  company_name?: string | false
  is_company?: boolean
  parent_id?: [number, string] | false
  category_id?: Array<[number, string] | { id: number; display_name?: string } | number>
  image_128?: string | false
  customer_rank?: number
  supplier_rank?: number
  active?: boolean
}

const LIST_FIELDS = [
  'id', 'name', 'display_name', 'email', 'phone', 'city', 'country_id',
  'company_name', 'is_company', 'parent_id', 'category_id', 'image_128',
  'customer_rank', 'supplier_rank', 'active',
]

const FILTERS: FilterOption[] = [
  { key: 'customers', label: 'Customers', domain: [['customer_rank', '>', 0]] },
  { key: 'vendors', label: 'Vendors', domain: [['supplier_rank', '>', 0]] },
  { key: 'companies', label: 'Companies', domain: [['is_company', '=', true]] },
  { key: 'individuals', label: 'Individuals', domain: [['is_company', '=', false]] },
]

export default function ContactList() {
  useDocumentTitle('Contacts')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [view, setView] = useState<ViewMode>('list')
  const pageSize = 40
  const { selected, clear, setSelected } = useBulkSelect()

  const handleFilterToggle = useCallback((key: string) => {
    setActiveFilters(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
    setPage(0)
  }, [])

  // Build domain from search + filters
  const domain: DomainLeaf[] = []
  if (search) {
    domain.push('|', '|', ['name', 'ilike', search], ['email', 'ilike', search], ['phone', 'ilike', search])
  }
  for (const key of activeFilters) {
    const filter = FILTERS.find(f => f.key === key)
    if (filter?.domain) domain.push(...filter.domain)
  }

  const order = sortField ? `${sortField} ${sortDir}` : 'name asc'

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['contacts', 'list', domain, page, order],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/res.partner', {
        domain: domain.length ? domain : undefined,
        fields: LIST_FIELDS,
        offset: page * pageSize,
        limit: pageSize,
        order,
      })
      return data
    },
  })

  const records = data?.records || []
  const total = data?.total || 0
  const selectedSet = new Set(selected)

  async function bulkAction(ids: number[], action: (id: number) => Promise<unknown>, successMsg: string) {
    try {
      await Promise.all(ids.map(action))
      toast.success(`${successMsg} (${ids.length})`)
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      clear()
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, 'Action failed'))
    }
  }

  const bulkActions: BulkAction[] = [
    {
      key: 'archive',
      label: 'Archive',
      icon: <Archive className="h-3.5 w-3.5" />,
      variant: 'destructive',
      confirm: 'Archive {count} contact(s)?',
      onClick: ids => bulkAction(
        ids,
        id => erpClient.raw.put(`/model/res.partner/${id}`, { vals: { active: false } }),
        'Contacts archived',
      ),
    },
    {
      key: 'email',
      label: 'Send Email',
      icon: <Mail className="h-3.5 w-3.5" />,
      onClick: () => { toast.info('Email composer coming soon') },
    },
  ]

  const columns: Column[] = [
    {
      key: 'name',
      label: 'Name',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          {row.image_128 ? (
            <img
              src={`data:image/png;base64,${row.image_128}`}
              alt=""
              className="h-8 w-8 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className={cn(
              'h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold',
              row.is_company ? 'bg-blue-500/15 text-blue-400' : 'bg-violet-500/15 text-violet-400',
            )}>
              {row.is_company ? <Building2 className="h-4 w-4" /> : (row.name?.[0] || '?').toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{row.name}</p>
            {row.parent_id && (
              <p className="text-xs text-muted-foreground truncate">{Array.isArray(row.parent_id) ? row.parent_id[1] : ''}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      render: (val) => val ? <a href={`mailto:${val}`} className="text-sm text-primary hover:underline" onClick={e => e.stopPropagation()}>{val}</a> : '',
    },
    { key: 'phone', label: 'Phone' },
    { key: 'city', label: 'City' },
    {
      key: 'country_id',
      label: 'Country',
      format: (val) => Array.isArray(val) ? val[1] : '',
    },
    {
      key: 'category_id',
      label: 'Tags',
      sortable: false,
      render: (val) => {
        if (!Array.isArray(val) || val.length === 0) return ''
        return (
          <div className="flex flex-wrap gap-1">
            {val.slice(0, 3).map((tag: unknown, i: number) => {
              const key = Array.isArray(tag)
                ? (tag as [number, string])[0]
                : (typeof tag === 'object' && tag !== null && 'id' in tag ? (tag as { id: number }).id : i)
              const label = Array.isArray(tag)
                ? (tag as [number, string])[1]
                : (typeof tag === 'object' && tag !== null && 'display_name' in tag
                  ? String((tag as { display_name?: unknown }).display_name ?? '')
                  : String(tag))
              return (
                <Badge key={key} variant="secondary" className="text-[10px] rounded-full px-2 py-0">
                  {label}
                </Badge>
              )
            })}
            {val.length > 3 && <Badge variant="secondary" className="text-[10px] rounded-full px-2 py-0">+{val.length - 3}</Badge>}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Contacts"
        subtitle="contacts"
        onNew="/admin/contacts/new"
        actions={<ViewToggle value={view} onChange={setView} available={['list', 'kanban']} />}
      />

      <SearchBar
        placeholder="Search contacts..."
        onSearch={v => { setSearch(v); setPage(0) }}
        filters={FILTERS}
        activeFilters={activeFilters}
        onFilterToggle={handleFilterToggle}
      />

      <BulkActionBar selected={selected} onClear={clear} actions={bulkActions} />

      {view === 'list' ? (
        <DataTable
          columns={columns}
          data={records}
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          sortField={sortField}
          sortDir={sortDir}
          onSort={(f, d) => { setSortField(f); setSortDir(d) }}
          loading={isLoading}
          isError={isError} error={error} onRetry={() => refetch()}
          rowLink={(row) => `/admin/contacts/${row.id}`}
          selectable
          selectedIds={selectedSet}
          onSelectionChange={(ids) => setSelected(Array.from(ids) as number[])}
          emptyMessage="No contacts found"
          emptyIcon={<Users className="h-10 w-10" />}
        />
      ) : (
        <ContactsGrid records={records} loading={isLoading} onOpen={(id) => navigate(`/admin/contacts/${id}`)} />
      )}
    </div>
  )
}

// ─── Kanban / card grid view ────────────────────────────────────────────────

function ContactsGrid({ records, loading, onOpen }: { records: ContactRecord[]; loading: boolean; onOpen: (id: number) => void }) {
  if (loading) {
    return (
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl border border-border/40 bg-card animate-pulse" />
        ))}
      </div>
    )
  }
  if (records.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="rounded-2xl border border-border/70 bg-muted/60 p-4">
          <Users className="size-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">No contacts found</p>
      </div>
    )
  }
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {records.map(c => {
        const name = c.display_name || c.name || `#${c.id}`
        const initial = (name[0] || '?').toUpperCase()
        const country = Array.isArray(c.country_id) ? c.country_id[1] : ''
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onOpen(c.id)}
            className="group text-left rounded-xl border border-border/40 bg-card hover:border-border hover:shadow-md transition-all p-4 flex gap-3 items-start"
          >
            <div className={cn(
              'shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold',
              c.is_company ? 'bg-blue-500/15 text-blue-500' : 'bg-primary/10 text-primary'
            )}>
              {c.is_company ? <Building2 className="h-5 w-5" /> : initial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold truncate">{name}</p>
                {!c.active && <Badge variant="destructive" className="text-[10px]">Archived</Badge>}
              </div>
              {c.email && <p className="text-xs text-muted-foreground truncate mt-0.5">{c.email}</p>}
              {c.phone && <p className="text-xs text-muted-foreground truncate">{c.phone}</p>}
              {(c.city || country) && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {[c.city, country].filter(Boolean).join(', ')}
                </p>
              )}
              <div className="mt-2 flex gap-1 flex-wrap">
                {(c.customer_rank ?? 0) > 0 && <Badge variant="outline" className="text-[10px]">Customer</Badge>}
                {(c.supplier_rank ?? 0) > 0 && <Badge variant="outline" className="text-[10px]">Vendor</Badge>}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
