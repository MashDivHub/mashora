import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, cn } from '@mashora/design-system'
import { Truck } from 'lucide-react'
import { DataTable, PageHeader, SearchBar, type Column, type FilterOption } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

const LIST_FIELDS = [
  'id', 'name', 'partner_id', 'state', 'picking_type_id', 'picking_type_code',
  'origin', 'scheduled_date', 'date_done', 'location_id', 'location_dest_id',
  'backorder_id', 'user_id',
]

const STATE_BADGE: Record<string, { label: string; variant: string }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  waiting: { label: 'Waiting', variant: 'warning' },
  confirmed: { label: 'Waiting', variant: 'warning' },
  assigned: { label: 'Ready', variant: 'info' },
  done: { label: 'Done', variant: 'success' },
  cancel: { label: 'Cancelled', variant: 'destructive' },
}

const FILTERS: FilterOption[] = [
  { key: 'receipts', label: 'Receipts', domain: [['picking_type_code', '=', 'incoming']] },
  { key: 'deliveries', label: 'Deliveries', domain: [['picking_type_code', '=', 'outgoing']] },
  { key: 'internal', label: 'Internal', domain: [['picking_type_code', '=', 'internal']] },
  { key: 'ready', label: 'Ready', domain: [['state', '=', 'assigned']] },
  { key: 'waiting', label: 'Waiting', domain: [['state', 'in', ['waiting', 'confirmed']]] },
  { key: 'late', label: 'Late', domain: [['scheduled_date', '<', new Date().toISOString()], ['state', 'not in', ['done', 'cancel']]] },
]

export default function TransferList() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialFilter = searchParams.get('filter')
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>(initialFilter ? [initialFilter] : [])
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>('scheduled_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const pageSize = 40

  const domain: any[] = []
  if (search) domain.push('|', ['name', 'ilike', search], ['origin', 'ilike', search])
  for (const key of activeFilters) {
    const f = FILTERS.find(fl => fl.key === key)
    if (f?.domain) domain.push(...f.domain)
  }

  const order = sortField ? `${sortField} ${sortDir}` : 'scheduled_date desc'

  const { data, isLoading } = useQuery({
    queryKey: ['transfers', domain, page, order],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/stock.picking', {
        domain: domain.length ? domain : undefined,
        fields: LIST_FIELDS, offset: page * pageSize, limit: pageSize, order,
      })
      return data
    },
  })

  const title = activeFilters.includes('receipts') ? 'Receipts' :
    activeFilters.includes('deliveries') ? 'Deliveries' :
    activeFilters.includes('internal') ? 'Internal Transfers' : 'Transfers'

  const TYPE_ICON: Record<string, string> = { incoming: 'text-emerald-400', outgoing: 'text-blue-400', internal: 'text-violet-400' }

  const columns: Column[] = [
    { key: 'name', label: 'Reference', render: (_, row) => <span className="font-mono text-sm">{row.name}</span> },
    { key: 'partner_id', label: 'Contact', format: v => Array.isArray(v) ? v[1] : '' },
    { key: 'picking_type_id', label: 'Operation', render: (v, row) => (
      <span className={cn('text-sm font-medium', TYPE_ICON[row.picking_type_code] || '')}>
        {Array.isArray(v) ? v[1] : ''}
      </span>
    )},
    { key: 'origin', label: 'Source' },
    { key: 'scheduled_date', label: 'Scheduled', render: (v, row) => {
      if (!v) return ''
      const late = row.state !== 'done' && row.state !== 'cancel' && new Date(v) < new Date()
      return <span className={cn('text-sm', late && 'text-red-400 font-medium')}>{new Date(v).toLocaleDateString()}</span>
    }},
    { key: 'date_done', label: 'Done', format: v => v ? new Date(v).toLocaleDateString() : '' },
    { key: 'state', label: 'Status', render: v => {
      const s = STATE_BADGE[v] || { label: v, variant: 'secondary' }
      return <Badge variant={s.variant as any} className="rounded-full text-xs">{s.label}</Badge>
    }},
    { key: 'backorder_id', label: 'Back Order', format: v => Array.isArray(v) ? v[1] : '' },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title={title} subtitle="inventory" onNew={() => navigate('/inventory/transfers/new')} />
      <SearchBar placeholder="Search transfers..." onSearch={v => { setSearch(v); setPage(0) }}
        filters={FILTERS} activeFilters={activeFilters}
        onFilterToggle={k => { setActiveFilters(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]); setPage(0) }} />
      <DataTable columns={columns} data={data?.records || []} total={data?.total} page={page} pageSize={pageSize}
        onPageChange={setPage} sortField={sortField} sortDir={sortDir}
        onSort={(f, d) => { setSortField(f); setSortDir(d) }} loading={isLoading}
        rowLink={row => `/inventory/transfers/${row.id}`} emptyMessage="No transfers found" emptyIcon={<Truck className="h-10 w-10" />} />
    </div>
  )
}
