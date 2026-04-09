import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@mashora/design-system'
import { Package } from 'lucide-react'
import { DataTable, PageHeader, SearchBar, type Column, type FilterOption } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

const FIELDS = [
  'id', 'product_id', 'location_id', 'lot_id', 'quantity',
  'reserved_quantity', 'available_quantity', 'product_uom_id', 'company_id',
]

const FILTERS: FilterOption[] = [
  { key: 'on_hand', label: 'On Hand', domain: [['quantity', '>', 0]] },
  { key: 'negative', label: 'Negative Stock', domain: [['quantity', '<', 0]] },
  { key: 'reserved', label: 'Has Reserved', domain: [['reserved_quantity', '>', 0]] },
  { key: 'internal', label: 'Internal Locations', domain: [['location_id.usage', '=', 'internal']] },
]

export default function StockLevels() {
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>(['on_hand'])
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>('quantity')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const pageSize = 50

  const domain: any[] = []
  if (search) domain.push(['product_id', 'ilike', search])
  for (const key of activeFilters) {
    const f = FILTERS.find(fl => fl.key === key)
    if (f) domain.push(...f.domain)
  }

  const order = sortField ? `${sortField} ${sortDir}` : 'quantity desc'

  const { data, isLoading } = useQuery({
    queryKey: ['stock-quants', domain, page, order],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/stock.quant', {
        domain: domain.length ? domain : [['quantity', '!=', 0]],
        fields: FIELDS, offset: page * pageSize, limit: pageSize, order,
      })
      return data
    },
  })

  const columns: Column[] = [
    { key: 'product_id', label: 'Product', render: (v) => <span className="text-sm font-medium">{Array.isArray(v) ? v[1] : ''}</span> },
    { key: 'location_id', label: 'Location', format: v => Array.isArray(v) ? v[1] : '' },
    { key: 'lot_id', label: 'Lot/Serial', format: v => Array.isArray(v) ? v[1] : '' },
    {
      key: 'quantity', label: 'On Hand', align: 'right' as const,
      render: v => <span className={cn('font-mono text-sm font-medium', Number(v) < 0 && 'text-red-400')}>{Number(v || 0).toFixed(2)}</span>,
    },
    {
      key: 'reserved_quantity', label: 'Reserved', align: 'right' as const,
      render: v => v && Number(v) > 0 ? <span className="font-mono text-sm text-amber-400">{Number(v).toFixed(2)}</span> : '',
    },
    {
      key: 'available_quantity', label: 'Available', align: 'right' as const,
      render: v => <span className={cn('font-mono text-sm font-medium', Number(v) > 0 ? 'text-emerald-400' : Number(v) < 0 ? 'text-red-400' : '')}>{Number(v || 0).toFixed(2)}</span>,
    },
    { key: 'product_uom_id', label: 'Unit', format: v => Array.isArray(v) ? v[1] : '' },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Stock on Hand" subtitle="inventory" />
      <SearchBar placeholder="Search products..." onSearch={v => { setSearch(v); setPage(0) }}
        filters={FILTERS} activeFilters={activeFilters}
        onFilterToggle={k => { setActiveFilters(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]); setPage(0) }} />
      <DataTable columns={columns} data={data?.records || []} total={data?.total} page={page} pageSize={pageSize}
        onPageChange={setPage} sortField={sortField} sortDir={sortDir}
        onSort={(f, d) => { setSortField(f); setSortDir(d) }} loading={isLoading}
        emptyMessage="No stock found" emptyIcon={<Package className="h-10 w-10" />} />
    </div>
  )
}
