import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button, type BadgeVariant } from '@mashora/design-system'
import { ShoppingBag, ArrowRight } from 'lucide-react'
import { DataTable, PageHeader, SearchBar, type Column, type FilterOption } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

const INVOICE_STATUS_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  nothing: { label: 'Nothing to Invoice', variant: 'secondary' },
  'to invoice': { label: 'To Invoice', variant: 'warning' },
  invoiced: { label: 'Invoiced', variant: 'success' },
  upselling: { label: 'Upselling', variant: 'info' },
}

const STATE_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
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

  const domain: unknown[] = [['state', '=', 'sale']]
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
        const s = INVOICE_STATUS_BADGE[v] || { label: v, variant: 'secondary' as BadgeVariant }
        return <Badge variant={s.variant} className="rounded-full text-xs">{s.label}</Badge>
      },
    },
    {
      key: 'state',
      label: 'Status',
      render: v => {
        const s = STATE_BADGE[v] || { label: v, variant: 'secondary' as BadgeVariant }
        return <Badge variant={s.variant} className="rounded-full text-xs">{s.label}</Badge>
      },
    },
  ]

  const records = data?.records || []
  const hasFilters = search.length > 0 || activeFilters.length > 0
  const showEmptyCta = !isLoading && records.length === 0 && !hasFilters

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
      {showEmptyCta ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-12 text-center space-y-4">
          <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-muted-foreground">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">No e-commerce orders yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Orders appear here when customers check out on your storefront.
              Visit the product catalog to publish items for sale.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/admin/website/products')} className="gap-2">
            Manage Products <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={records}
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
      )}
    </div>
  )
}
