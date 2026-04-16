import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, cn } from '@mashora/design-system'
import { ShoppingBag } from 'lucide-react'
import { DataTable, PageHeader, SearchBar, type Column, type FilterOption } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

const INVOICE_STATUS_BADGE: Record<string, { label: string; variant: string }> = {
  nothing: { label: 'Nothing to Invoice', variant: 'secondary' },
  'to invoice': { label: 'To Invoice', variant: 'warning' },
  invoiced: { label: 'Invoiced', variant: 'success' },
  upselling: { label: 'Upselling', variant: 'info' },
}

const STATE_BADGE: Record<string, { label: string; variant: string }> = {
  draft: { label: 'Quotation', variant: 'secondary' },
  sent: { label: 'Sent', variant: 'info' },
  sale: { label: 'Confirmed', variant: 'success' },
  cancel: { label: 'Cancelled', variant: 'destructive' },
}

const FILTERS: FilterOption[] = [
  { key: 'to_invoice', label: 'To Invoice', domain: [['invoice_status', '=', 'to invoice']] },
  { key: 'invoiced', label: 'Invoiced', domain: [['invoice_status', '=', 'invoiced']] },
]

export default function EcomOrders() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>('date_order')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const pageSize = 40

  const domain: any[] = [['state', '=', 'sale']]
  if (search) domain.push('|', ['name', 'ilike', search], ['partner_id', 'ilike', search])
  for (const key of activeFilters) {
    const f = FILTERS.find(fl => fl.key === key)
    if (f?.domain) domain.push(...f.domain)
  }

  const order = sortField ? `${sortField} ${sortDir}` : 'date_order desc'

  const { data, isLoading } = useQuery({
    queryKey: ['ecom-orders', domain, page, order],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/sale.order', {
        domain,
        fields: ['id', 'name', 'state', 'partner_id', 'date_order', 'amount_total', 'invoice_status'],
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
      label: 'Order',
      render: (_, row) => <span className="font-mono text-sm">{row.name}</span>,
    },
    {
      key: 'partner_id',
      label: 'Customer',
      format: v => Array.isArray(v) ? v[1] : '',
    },
    {
      key: 'date_order',
      label: 'Date',
      format: v => v ? new Date(v).toLocaleDateString() : '',
    },
    {
      key: 'amount_total',
      label: 'Total',
      align: 'right',
      render: v => (
        <span className="font-mono text-sm text-right">
          {v != null ? `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : ''}
        </span>
      ),
    },
    {
      key: 'invoice_status',
      label: 'Invoice Status',
      render: v => {
        const s = INVOICE_STATUS_BADGE[v] || { label: v, variant: 'secondary' }
        return <Badge variant={s.variant as any} className="rounded-full text-xs">{s.label}</Badge>
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
      <PageHeader title="E-Commerce Orders" subtitle="website" />
      <SearchBar
        placeholder="Search orders..."
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
        rowLink={row => `/admin/sales/orders/${row.id}`}
        emptyMessage="No e-commerce orders found"
        emptyIcon={<ShoppingBag className="h-10 w-10" />}
      />
    </div>
  )
}
