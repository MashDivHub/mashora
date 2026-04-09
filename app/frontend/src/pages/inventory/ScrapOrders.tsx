import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DataTable, PageHeader, SearchBar } from '@/components/shared'
import type { Column } from '@/components/shared/DataTable'
import { Badge } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { Trash2 } from 'lucide-react'

const LIST_FIELDS = [
  'id', 'name', 'product_id', 'scrap_qty', 'product_uom_id',
  'location_id', 'scrap_location_id', 'state', 'date_done', 'create_date',
]

const STATE_BADGE: Record<string, { label: string; variant: string }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  done:  { label: 'Done',  variant: 'success' },
}

const FILTERS = [
  { key: 'draft', label: 'Draft', domain: [['state', '=', 'draft']] },
  { key: 'done',  label: 'Done',  domain: [['state', '=', 'done']]  },
]

export default function ScrapOrders() {
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>('create_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const pageSize = 40

  const domain: any[] = []
  if (search) domain.push(['name', 'ilike', search])
  for (const key of activeFilters) {
    const f = FILTERS.find(fl => fl.key === key)
    if (f?.domain) domain.push(...f.domain)
  }

  const order = sortField ? `${sortField} ${sortDir}` : 'create_date desc'

  const { data, isLoading } = useQuery({
    queryKey: ['scrap-orders', domain, page, order],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/inventory/scraps', {
        domain: domain.length ? domain : [],
        fields: LIST_FIELDS,
        offset: page * pageSize,
        limit: pageSize,
        order,
      })
      return data
    },
  })

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
      key: 'scrap_qty',
      label: 'Quantity',
      render: (v, row) => (
        <span className="text-sm">
          {v} {Array.isArray(row.product_uom_id) ? row.product_uom_id[1] : ''}
        </span>
      ),
    },
    {
      key: 'location_id',
      label: 'From Location',
      format: v => Array.isArray(v) ? v[1] : '',
    },
    {
      key: 'scrap_location_id',
      label: 'To Scrap Location',
      format: v => Array.isArray(v) ? v[1] : '',
    },
    {
      key: 'date_done',
      label: 'Date',
      render: (v, row) => {
        const raw = v || row.create_date
        return <span className="text-sm">{raw ? new Date(raw).toLocaleDateString() : ''}</span>
      },
    },
    {
      key: 'state',
      label: 'Status',
      render: v => {
        const s = STATE_BADGE[v] || { label: v, variant: 'secondary' }
        return <Badge variant={s.variant as any} className="rounded-full text-xs">{s.label}</Badge>
      },
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Scrap Orders"
        subtitle={data?.total != null ? `${data.total} record${data.total === 1 ? '' : 's'}` : 'inventory'}
      />
      <SearchBar
        placeholder="Search scrap orders..."
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
        emptyMessage="No scrap orders found"
        emptyIcon={<Trash2 className="h-10 w-10" />}
      />
    </div>
  )
}
