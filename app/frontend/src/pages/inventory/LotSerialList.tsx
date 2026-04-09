import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DataTable, PageHeader, SearchBar } from '@/components/shared'
import type { Column } from '@/components/shared/DataTable'
import { Badge } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { ScanBarcode } from 'lucide-react'

const PAGE_SIZE = 40

export default function LotSerialList() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>('create_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const domain: any[] = search ? [['name', 'ilike', search]] : []
  const order = sortField ? `${sortField} ${sortDir}` : 'create_date desc'

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-lots', search, page, order],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/inventory/lots', {
        domain: domain.length ? domain : undefined,
        offset: page * PAGE_SIZE,
        limit: PAGE_SIZE,
        order,
      })
      return data
    },
  })

  const columns: Column[] = [
    {
      key: 'name',
      label: 'Lot / Serial',
      render: (v) => <span className="font-mono font-medium text-sm">{v}</span>,
    },
    {
      key: 'product_id',
      label: 'Product',
      format: (v) => (Array.isArray(v) ? v[1] : ''),
    },
    {
      key: 'ref',
      label: 'Reference',
      format: (v) => (v && v !== false ? String(v) : '—'),
    },
    {
      key: 'company_id',
      label: 'Company',
      format: (v) => (Array.isArray(v) ? v[1] : ''),
    },
    {
      key: 'create_date',
      label: 'Created',
      format: (v) => (v ? new Date(v).toLocaleDateString() : ''),
    },
  ]

  const total = data?.total ?? 0

  return (
    <div className="space-y-4">
      <PageHeader
        title="Lots / Serial Numbers"
        subtitle={total > 0 ? `${total} record${total === 1 ? '' : 's'}` : 'inventory'}
      />
      <SearchBar
        placeholder="Search lots..."
        onSearch={(v) => { setSearch(v); setPage(0) }}
      />
      <DataTable
        columns={columns}
        data={data?.records || []}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        sortField={sortField}
        sortDir={sortDir}
        onSort={(f, d) => { setSortField(f); setSortDir(d) }}
        loading={isLoading}
        emptyMessage="No lots or serial numbers found"
        emptyIcon={<ScanBarcode className="h-10 w-10" />}
      />
    </div>
  )
}
