import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, cn } from '@mashora/design-system'
import { ShoppingCart } from 'lucide-react'
import { DataTable, PageHeader, SearchBar, type Column, type FilterOption } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

const LIST_FIELDS = [
  'id', 'name', 'partner_id', 'state', 'date_order', 'validity_date',
  'amount_total', 'currency_id', 'user_id', 'invoice_status',
  'delivery_count', 'invoice_count', 'client_order_ref',
]

const STATE_BADGE: Record<string, { label: string; variant: string }> = {
  draft: { label: 'Quotation', variant: 'secondary' },
  sent: { label: 'Sent', variant: 'info' },
  sale: { label: 'Sales Order', variant: 'success' },
  cancel: { label: 'Cancelled', variant: 'destructive' },
}

const FILTERS: FilterOption[] = [
  { key: 'quotations', label: 'Quotations', domain: [['state', 'in', ['draft', 'sent']]] },
  { key: 'orders', label: 'Sales Orders', domain: [['state', '=', 'sale']] },
  { key: 'to_invoice', label: 'To Invoice', domain: [['invoice_status', '=', 'to invoice']] },
  { key: 'cancelled', label: 'Cancelled', domain: [['state', '=', 'cancel']] },
]

export default function SalesOrderList() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialFilter = searchParams.get('filter')
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>(initialFilter ? [initialFilter] : [])
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>('date_order')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const pageSize = 40

  const domain: any[] = []
  if (search) domain.push('|', ['name', 'ilike', search], ['partner_id', 'ilike', search])
  for (const key of activeFilters) {
    const f = FILTERS.find(fl => fl.key === key)
    if (f?.domain) domain.push(...f.domain)
  }

  const order = sortField ? `${sortField} ${sortDir}` : 'date_order desc'

  const { data, isLoading } = useQuery({
    queryKey: ['sales-orders', domain, page, order],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/sale.order', {
        domain: domain.length ? domain : undefined,
        fields: LIST_FIELDS, offset: page * pageSize, limit: pageSize, order,
      })
      return data
    },
  })

  const title = activeFilters.includes('quotations') ? 'Quotations' :
    activeFilters.includes('orders') ? 'Sales Orders' : 'Sales'

  const columns: Column[] = [
    {
      key: 'name', label: 'Number',
      render: (_, row) => <span className="font-mono text-sm">{row.name}</span>,
    },
    {
      key: 'partner_id', label: 'Customer',
      format: v => Array.isArray(v) ? v[1] : '',
    },
    {
      key: 'date_order', label: 'Date',
      format: v => v ? new Date(v).toLocaleDateString() : '',
    },
    {
      key: 'state', label: 'Status',
      render: v => {
        const s = STATE_BADGE[v] || { label: v, variant: 'secondary' }
        return <Badge variant={s.variant as any} className="rounded-full text-xs">{s.label}</Badge>
      },
    },
    {
      key: 'invoice_status', label: 'Invoice',
      render: v => {
        if (!v || v === 'no') return ''
        const colors: Record<string, string> = { 'to invoice': 'text-amber-400', invoiced: 'text-emerald-400', upselling: 'text-blue-400' }
        return <span className={cn('text-xs font-medium', colors[v])}>{v === 'to invoice' ? 'To Invoice' : v === 'invoiced' ? 'Invoiced' : v}</span>
      },
    },
    {
      key: 'amount_total', label: 'Total', align: 'right',
      format: v => v ? `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '',
    },
    {
      key: 'user_id', label: 'Salesperson',
      format: v => Array.isArray(v) ? v[1] : '',
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title={title} subtitle="sales" onNew={() => navigate('/admin/sales/orders/new')} />
      <SearchBar placeholder="Search orders..." onSearch={v => { setSearch(v); setPage(0) }}
        filters={FILTERS} activeFilters={activeFilters}
        onFilterToggle={k => { setActiveFilters(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]); setPage(0) }} />
      <DataTable columns={columns} data={data?.records || []} total={data?.total} page={page} pageSize={pageSize}
        onPageChange={setPage} sortField={sortField} sortDir={sortDir}
        onSort={(f, d) => { setSortField(f); setSortDir(d) }} loading={isLoading}
        rowLink={row => `/sales/orders/${row.id}`} emptyMessage="No orders found" emptyIcon={<ShoppingCart className="h-10 w-10" />} />
    </div>
  )
}
