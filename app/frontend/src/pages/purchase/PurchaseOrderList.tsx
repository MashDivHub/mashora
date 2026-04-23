import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, cn, type BadgeVariant } from '@mashora/design-system'
import { Package, CheckCircle2, XCircle, Mail, ThumbsUp, X, Plus } from 'lucide-react'
import {
  DataTable, PageHeader, SearchBar, BulkActionBar,
  toast,
  type Column, type FilterOption, type BulkAction,
} from '@/components/shared'
import { useBulkSelect } from '@/hooks/useBulkSelect'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

const LIST_FIELDS = [
  'id', 'name', 'partner_id', 'state', 'date_order', 'date_planned',
  'amount_total', 'currency_id', 'user_id', 'invoice_status', 'receipt_status',
  'incoming_picking_count', 'invoice_count', 'partner_ref',
]

const STATE_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
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
  { key: 'late', label: 'Late', domain: [['state', '=', 'purchase'], ['date_planned', '<', new Date().toISOString().split('T')[0]]] },
]

export default function PurchaseOrderList() {
  useDocumentTitle('Purchase Orders')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialFilter = searchParams.get('filter')
  const productTmplId = searchParams.get('product_tmpl_id')
  const productName = searchParams.get('product_name') || ''
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>(initialFilter ? [initialFilter] : [])
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>('date_order')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const pageSize = 40
  const { selected, clear, setSelected } = useBulkSelect()

  const domain: unknown[] = []
  if (productTmplId) domain.push(['order_line.product.product_tmpl_id', '=', parseInt(productTmplId)])
  if (search) domain.push('|', ['name', 'ilike', search], ['partner_id.name', 'ilike', search])
  for (const key of activeFilters) {
    const f = FILTERS.find(fl => fl.key === key)
    if (f?.domain) domain.push(...f.domain)
  }

  const clearProductFilter = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('product_tmpl_id')
    next.delete('product_name')
    setSearchParams(next)
  }

  const order = sortField ? `${sortField} ${sortDir}` : 'date_order desc'

  const { data, isLoading, isError, error, refetch } = useQuery({
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

  async function bulkAction(ids: number[], action: (id: number) => Promise<unknown>, successMsg: string) {
    try {
      await Promise.all(ids.map(action))
      toast.success(`${successMsg} (${ids.length})`)
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      clear()
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, 'Action failed'))
    }
  }

  const bulkActions: BulkAction[] = [
    {
      key: 'confirm',
      label: 'Confirm',
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      confirm: 'Confirm {count} order(s)?',
      onClick: ids => bulkAction(ids, id => erpClient.raw.post(`/purchase/orders/${id}/confirm`), 'Orders confirmed'),
    },
    {
      key: 'send',
      label: 'Send RFQ',
      icon: <Mail className="h-3.5 w-3.5" />,
      onClick: ids => bulkAction(ids, id => erpClient.raw.post(`/purchase/orders/${id}/send`), 'RFQs sent'),
    },
    {
      key: 'approve',
      label: 'Approve',
      icon: <ThumbsUp className="h-3.5 w-3.5" />,
      confirm: 'Approve {count} order(s)?',
      onClick: ids => bulkAction(ids, id => erpClient.raw.post(`/purchase/orders/${id}/approve`), 'Orders approved'),
    },
    {
      key: 'cancel',
      label: 'Cancel',
      icon: <XCircle className="h-3.5 w-3.5" />,
      variant: 'destructive',
      confirm: 'Cancel {count} order(s)?',
      onClick: ids => bulkAction(ids, id => erpClient.raw.post(`/purchase/orders/${id}/cancel`), 'Orders cancelled'),
    },
  ]

  const columns: Column[] = [
    { key: 'name', label: 'Reference', render: (_, row) => <span className="font-mono text-sm">{row.name}</span> },
    { key: 'partner_id', label: 'Vendor', format: v => Array.isArray(v) ? v[1] : '' },
    { key: 'partner_ref', label: 'Vendor Ref' },
    { key: 'date_order', label: 'Order Date', format: v => v ? new Date(v).toLocaleDateString() : '' },
    { key: 'date_planned', label: 'Expected', format: v => v ? new Date(v).toLocaleDateString() : '' },
    {
      key: 'state', label: 'Status',
      render: v => { const s = STATE_BADGE[v] || { label: v, variant: 'secondary' as BadgeVariant }; return <Badge variant={s.variant} className="rounded-full text-xs">{s.label}</Badge> },
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

  const records = data?.records || []
  const selectedSet = new Set(selected)
  const hasFilters = !!search || activeFilters.length > 0 || !!productTmplId
  const showEmptyCta = !isLoading && !isError && records.length === 0 && page === 0 && !hasFilters
  const handleCreate = () => navigate('/admin/purchase/orders/new')

  return (
    <div className="space-y-4">
      <PageHeader title={title} subtitle="purchase" onNew={() => navigate('/admin/purchase/orders/new')} />
      {productTmplId && (
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs">
          <span>Product: <strong>{productName || `#${productTmplId}`}</strong></span>
          <button type="button" onClick={clearProductFilter} className="hover:text-destructive" title="Clear product filter" aria-label="Clear product filter">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <SearchBar placeholder="Search orders..." onSearch={v => { setSearch(v); setPage(0) }}
        filters={FILTERS} activeFilters={activeFilters}
        onFilterToggle={k => { setActiveFilters(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]); setPage(0) }} />
      <BulkActionBar selected={selected} onClear={clear} actions={bulkActions} />
      {showEmptyCta ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-12 text-center space-y-4">
          <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-primary">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">No purchase orders yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create a request for quotation to start procuring from vendors.
            </p>
          </div>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Create First RFQ
          </Button>
        </div>
      ) : (
        <DataTable columns={columns} data={records} total={data?.total} page={page} pageSize={pageSize}
          onPageChange={setPage} sortField={sortField} sortDir={sortDir}
          onSort={(f, d) => { setSortField(f); setSortDir(d) }} loading={isLoading}
          isError={isError} error={error} onRetry={() => refetch()}
          rowLink={row => `/admin/purchase/orders/${row.id}`}
          selectable
          selectedIds={selectedSet}
          onSelectionChange={(ids) => setSelected(Array.from(ids) as number[])}
          emptyMessage="No purchase orders found" emptyIcon={<Package className="h-10 w-10" />} />
      )}
    </div>
  )
}
