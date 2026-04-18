import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, cn, type BadgeVariant } from '@mashora/design-system'
import { ShoppingCart, CheckCircle2, XCircle, Mail, Lock, X } from 'lucide-react'
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
  'id', 'name', 'partner_id', 'state', 'date_order', 'validity_date',
  'amount_total', 'currency_id', 'user_id', 'invoice_status',
  'delivery_count', 'invoice_count', 'client_order_ref',
]

const STATE_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
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
  useDocumentTitle('Sales Orders')
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

  async function bulkAction(ids: number[], action: (id: number) => Promise<unknown>, successMsg: string) {
    try {
      await Promise.all(ids.map(action))
      toast.success(`${successMsg} (${ids.length})`)
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
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
      onClick: ids => bulkAction(ids, id => erpClient.raw.post(`/sales/orders/${id}/confirm`), 'Orders confirmed'),
    },
    {
      key: 'send',
      label: 'Send by Email',
      icon: <Mail className="h-3.5 w-3.5" />,
      onClick: ids => bulkAction(ids, id => erpClient.raw.post(`/sales/orders/${id}/send`), 'Sent emails'),
    },
    {
      key: 'lock',
      label: 'Lock',
      icon: <Lock className="h-3.5 w-3.5" />,
      onClick: ids => bulkAction(ids, id => erpClient.raw.post(`/sales/orders/${id}/lock`), 'Orders locked'),
    },
    {
      key: 'cancel',
      label: 'Cancel',
      icon: <XCircle className="h-3.5 w-3.5" />,
      variant: 'destructive',
      confirm: 'Cancel {count} order(s)?',
      onClick: ids => bulkAction(ids, id => erpClient.raw.post(`/sales/orders/${id}/cancel`), 'Orders cancelled'),
    },
  ]

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
        const s = STATE_BADGE[v] || { label: v, variant: 'secondary' as BadgeVariant }
        return <Badge variant={s.variant} className="rounded-full text-xs">{s.label}</Badge>
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

  const records = data?.records || []
  const selectedSet = new Set(selected)

  return (
    <div className="space-y-4">
      <PageHeader title={title} subtitle="sales" onNew={() => navigate('/admin/sales/orders/new')} />
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
      <DataTable columns={columns} data={records} total={data?.total} page={page} pageSize={pageSize}
        onPageChange={setPage} sortField={sortField} sortDir={sortDir}
        onSort={(f, d) => { setSortField(f); setSortDir(d) }} loading={isLoading}
        isError={isError} error={error} onRetry={() => refetch()}
        rowLink={row => `/admin/sales/orders/${row.id}`}
        selectable
        selectedIds={selectedSet}
        onSelectionChange={(ids) => setSelected(Array.from(ids) as number[])}
        emptyMessage="No orders found" emptyIcon={<ShoppingCart className="h-10 w-10" />} />
    </div>
  )
}
