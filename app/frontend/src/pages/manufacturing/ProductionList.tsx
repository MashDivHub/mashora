import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@mashora/design-system'
import { Factory } from 'lucide-react'
import { DataTable, PageHeader, SearchBar, type Column, type FilterOption } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

const STATE_BADGE: Record<string, { label: string; variant: string }> = {
  draft:     { label: 'Draft',       variant: 'secondary' },
  confirmed: { label: 'Confirmed',   variant: 'info' },
  progress:  { label: 'In Progress', variant: 'warning' },
  to_close:  { label: 'To Close',   variant: 'warning' },
  done:      { label: 'Done',        variant: 'success' },
  cancel:    { label: 'Cancelled',   variant: 'destructive' },
}

const FILTERS: FilterOption[] = [
  { key: 'draft',     label: 'Draft',       domain: [['state', '=', 'draft']] },
  { key: 'confirmed', label: 'Confirmed',   domain: [['state', '=', 'confirmed']] },
  { key: 'progress',  label: 'In Progress', domain: [['state', '=', 'progress']] },
  { key: 'done',      label: 'Done',        domain: [['state', '=', 'done']] },
]

const columns: Column[] = [
  {
    key: 'name',
    label: 'Reference',
    render: (_, row) => <span className="font-mono text-sm">{row.name}</span>,
  },
  {
    key: 'product_id',
    label: 'Product',
    format: v => Array.isArray(v) ? v[1] : '',
  },
  {
    key: 'product_qty',
    label: 'Qty',
    align: 'right',
    render: (v, row) => (
      <span className="tabular-nums text-sm">
        {Number(v || 0).toFixed(2)}
        {Array.isArray(row.product_uom_id) ? ` ${row.product_uom_id[1]}` : ''}
      </span>
    ),
  },
  {
    key: 'bom_id',
    label: 'BoM',
    format: v => Array.isArray(v) ? v[1] : '',
  },
  {
    key: 'date_start',
    label: 'Start Date',
    format: v => v ? new Date(v).toLocaleDateString() : '',
  },
  {
    key: 'date_finished',
    label: 'End Date',
    format: v => v ? new Date(v).toLocaleDateString() : '',
  },
  {
    key: 'state',
    label: 'Status',
    sortable: false,
    render: v => {
      const s = STATE_BADGE[v] || { label: v, variant: 'secondary' }
      return <Badge variant={s.variant as any} className="rounded-full text-xs">{s.label}</Badge>
    },
  },
]

export default function ProductionList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>('date_start')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const pageSize = 40

  const stateFilter = activeFilters.length > 0 ? activeFilters : undefined
  const order = sortField ? `${sortField} ${sortDir}` : 'date_start desc'

  const { data, isLoading } = useQuery({
    queryKey: ['productions', stateFilter, search, page, order],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/manufacturing/productions', {
        state: stateFilter,
        search: search || undefined,
        offset: page * pageSize,
        limit: pageSize,
        order,
      })
      return data
    },
  })

  const handleFilterToggle = (key: string) => {
    setActiveFilters(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key])
    setPage(0)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Production Orders"
        subtitle="manufacturing"
        onNew={() => navigate('/admin/manufacturing/orders/new')}
      />
      <SearchBar
        placeholder="Search production orders..."
        onSearch={v => { setSearch(v); setPage(0) }}
        filters={FILTERS}
        activeFilters={activeFilters}
        onFilterToggle={handleFilterToggle}
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
        rowLink={row => `/manufacturing/orders/${row.id}`}
        emptyMessage="No production orders found"
        emptyIcon={<Factory className="h-10 w-10" />}
      />
    </div>
  )
}
