import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, cn } from '@mashora/design-system'
import { Users, Building2, User, LayoutGrid, List } from 'lucide-react'
import { DataTable, PageHeader, SearchBar, type Column, type FilterOption } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

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
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const pageSize = 40

  const handleFilterToggle = useCallback((key: string) => {
    setActiveFilters(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
    setPage(0)
  }, [])

  // Build domain from search + filters
  const domain: any[] = []
  if (search) {
    domain.push('|', '|', ['name', 'ilike', search], ['email', 'ilike', search], ['phone', 'ilike', search])
  }
  for (const key of activeFilters) {
    const filter = FILTERS.find(f => f.key === key)
    if (filter) domain.push(...filter.domain)
  }

  const order = sortField ? `${sortField} ${sortDir}` : 'name asc'

  const { data, isLoading } = useQuery({
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
            {val.slice(0, 3).map((tag: any, i: number) => (
              <Badge key={i} variant="secondary" className="text-[10px] rounded-full px-2 py-0">
                {Array.isArray(tag) ? tag[1] : typeof tag === 'object' ? tag.display_name : tag}
              </Badge>
            ))}
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
        onNew="/contacts/new"
        actions={
          <div className="flex items-center gap-1 rounded-lg bg-muted/40 p-0.5">
            <button className="rounded-md p-1.5 bg-background shadow-sm">
              <List className="h-4 w-4" />
            </button>
            <button className="rounded-md p-1.5 text-muted-foreground hover:text-foreground">
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        }
      />

      <SearchBar
        placeholder="Search contacts..."
        onSearch={v => { setSearch(v); setPage(0) }}
        filters={FILTERS}
        activeFilters={activeFilters}
        onFilterToggle={handleFilterToggle}
      />

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
        rowLink={(row) => `/contacts/${row.id}`}
        emptyMessage="No contacts found"
        emptyIcon={<Users className="h-10 w-10" />}
      />
    </div>
  )
}
