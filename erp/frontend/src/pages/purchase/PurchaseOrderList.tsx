import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, cn } from '@mashora/design-system'
import { Package } from 'lucide-react'
import { DataTable, PageHeader, SearchBar, type Column, type FilterOption } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

const LIST_FIELDS = [
  'id', 'name', 'partner_id', 'state', 'date_order', 'date_planned',
  'amount_total', 'currency_id', 'user_id', 'invoice_status', 'receipt_status',
  'incoming_picking_count', 'invoice_count', 'partner_ref',
]

const STATE_BADGE: Record<string, { label: string; variant: string }> = {
  draft: { label: 'RFQ', variant: 'secondary' },
  sent: { label: 'RFQ Sent', variant: 'info' },
  'to approve': { label: 'To Approve', variant: 'warning' },
  purchase: { label: 'Purchase Order', variant: 'success' },
  cancel: { label: 'Cancelled', variant: 'destructive' },
}

const FILTERS: FilterOption[] = [
  { key: 'rfq', label: 'RFQs', domain: [['state', 'in', ['draft', 'sent']]] },
  { key: 'orders', label: 'Purchase Orders', domain: [['state', '=', 'purchase']] },
  { key: 'to_approve', label: 'To Approve', domain: [['state', '=', 'to approve']] },
  { key: 'to_bill', label: 'To Bill', domain: [['invoice_status', '=', 'to invoice']] },
]

export default function PurchaseOrderList() {
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
    if (f) domain.push(...f.domain)
  }

  const order = sortField ? `${sortField} ${sortDir}` : 'date_order desc'

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders', domain, page, order],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/purchase.order', {
        domain: domain.length ? domain : undefined,
        fields: LIST_FIELDS, offset: page * pageSize, limit: pageSize, order,
      })
      return data
    },
  })

  const title = activeFilters.includes('rfq') ? 'Requests for Quotation' :
    activeFilters.includes('orders') ? 'Purchase Orders' : 'Purchase'

  const columns: Column[] = [
    { key: 'name', label: 'Reference', render: (_, row) => <span className="font-mono text-sm">{row.name}</span> },
    { key: 'partner_id', label: 'Vendor', format: v => Array.isArray(v) ? v[1] : '' },
    { key: 'partner_ref', label: 'Vendor Ref' },
    { key: 'date_order', label: 'Order Date', format: v => v ? new Date(v).toLocaleDateString() : '' },
    { key: 'date_planned', label: 'Expected', format: v => v ? new Date(v).toLocaleDateString() : '' },
    {
      key: 'state', label: 'Status',
      render: v => { const s = STATE_BADGE[v] || { label: v, variant: 'secondary' }; return <Badge variant={s.variant as any} className="rounded-full text-xs">{s.label}</Badge> },
    },
    {
      key: 'receipt_status', label: 'Receipt',
      render: v => {
        if (!v || v === 'pending') return ''
        return <span className={cn('text-xs font-medium', v === 'full' ? 'text-emerald-400' : 'text-amber-400')}>{v === 'full' ? 'Received' : 'Partial'}</span>
      },
    },
    { key: 'amount_total', label: 'Total', align: 'right' as const, format: v => v ? `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '' },
    { key: 'user_id', label: 'Buyer', format: v => Array.isArray(v) ? v[1] : '' },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title={title} subtitle="purchase" onNew={() => navigate('/purchase/orders/new')} />
      <SearchBar placeholder="Search orders..." onSearch={v => { setSearch(v); setPage(0) }}
        filters={FILTERS} activeFilters={activeFilters}
        onFilterToggle={k => { setActiveFilters(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]); setPage(0) }} />
      <DataTable columns={columns} data={data?.records || []} total={data?.total} page={page} pageSize={pageSize}
        onPageChange={setPage} sortField={sortField} sortDir={sortDir}
        onSort={(f, d) => { setSortField(f); setSortDir(d) }} loading={isLoading}
        rowLink={row => `/purchase/orders/${row.id}`} emptyMessage="No purchase orders found" emptyIcon={<Package className="h-10 w-10" />} />
    </div>
  )
}
