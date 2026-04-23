import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapPin } from 'lucide-react'
import { DataTable, PageHeader, SearchBar, type Column, type FilterOption } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

const USAGE_LABEL: Record<string, string> = {
  supplier:   'Vendor Location',
  customer:   'Customer Location',
  internal:   'Internal Location',
  inventory:  'Inventory Loss',
  production: 'Production',
  transit:    'Transit Location',
}

const USAGE_BADGE: Record<string, string> = {
  internal:   'bg-primary/15 text-primary border-primary/30',
  supplier:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
  customer:   'bg-blue-500/15 text-blue-400 border-blue-500/30',
  inventory:  'bg-destructive/15 text-destructive border-destructive/30',
  production: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  transit:    'bg-sky-500/15 text-sky-400 border-sky-500/30',
}

const FILTERS: FilterOption[] = [
  { key: 'internal',  label: 'Internal', domain: [['usage', '=', 'internal']] },
  { key: 'supplier',  label: 'Vendor',   domain: [['usage', '=', 'supplier']] },
  { key: 'customer',  label: 'Customer', domain: [['usage', '=', 'customer']] },
  { key: 'transit',   label: 'Transit',  domain: [['usage', '=', 'transit']] },
]

export default function LocationList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>('complete_name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const pageSize = 50

  const usageFilter: unknown[][] | undefined = activeFilters.length > 0
    ? activeFilters
        .map(k => FILTERS.find(f => f.key === k)?.domain?.[0] as unknown[] | undefined)
        .filter((d): d is unknown[] => Array.isArray(d))
    : undefined

  const order = sortField ? `${sortField} ${sortDir}` : 'complete_name asc'

  const body: Record<string, unknown> = {
    offset: page * pageSize,
    limit: pageSize,
    order,
  }
  if (search) body.search = search
  if (usageFilter && usageFilter.length === 1) {
    body.usage = usageFilter[0][2]
  } else if (usageFilter && usageFilter.length > 1) {
    body.usage = usageFilter.map(d => d[2])
  }

  const { data, isLoading } = useQuery({
    queryKey: ['locations', search, activeFilters, page, order],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/inventory/locations', body)
      return data as { records: Array<Record<string, unknown>>; total: number }
    },
  })

  const columns: Column[] = [
    {
      key: 'complete_name',
      label: 'Location',
      render: v => <span className="font-medium text-sm">{v}</span>,
    },
    {
      key: 'usage',
      label: 'Type',
      render: v => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${USAGE_BADGE[v] || 'bg-muted/40 text-muted-foreground border-border/40'}`}
        >
          {USAGE_LABEL[v] || v}
        </span>
      ),
    },
    {
      key: 'company_id',
      label: 'Company',
      format: v => Array.isArray(v) ? v[1] : '',
    },
    {
      key: 'barcode',
      label: 'Barcode',
      render: v => v
        ? <span className="font-mono text-xs text-muted-foreground">{v}</span>
        : <span className="text-muted-foreground/40">—</span>,
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock Locations"
        subtitle="inventory"
        onNew={() => navigate('/admin/model/stock.location/new')}
        newLabel="New Location"
      />
      <SearchBar
        placeholder="Search locations..."
        onSearch={v => { setSearch(v); setPage(0) }}
        filters={FILTERS}
        activeFilters={activeFilters}
        onFilterToggle={k => {
          setActiveFilters(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k])
          setPage(0)
        }}
      />
      <DataTable
        columns={columns}
        data={data?.records || []}
        total={data?.total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        sortField={sortField}
        sortDir={sortDir}
        onSort={(f, d) => { setSortField(f); setSortDir(d) }}
        loading={isLoading}
        rowLink={(row) => `/admin/model/stock.location/${row.id}`}
        emptyMessage="No locations yet. Locations define where products live — create one to start stocking."
        emptyIcon={<MapPin className="h-10 w-10" />}
      />
    </div>
  )
}
