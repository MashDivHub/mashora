import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Button, Badge, Input,
  Tabs, TabsList, TabsTrigger,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  CardTitle, CardDescription,
  cn,
} from '@mashora/design-system'
import { Plus, Search, SlidersHorizontal } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

interface PurchaseOrder {
  id: number
  name: string
  state: string
  partner_id: [number, string] | false
  user_id: [number, string] | false
  date_order: string | false
  date_planned: string | false
  amount_total: number
  invoice_status: string
  priority: string | false
  partner_ref: string | false
}

const stateLabels: Record<string, string> = {
  draft: 'RFQ',
  sent: 'RFQ Sent',
  'to approve': 'To Approve',
  purchase: 'Purchase Order',
  cancel: 'Cancelled',
}

const stateColors: Record<string, 'secondary' | 'info' | 'warning' | 'success' | 'destructive'> = {
  draft: 'secondary',
  sent: 'info',
  'to approve': 'warning',
  purchase: 'success',
  cancel: 'destructive',
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

type TabFilter = 'all' | 'rfqs' | 'to_approve' | 'orders' | 'to_invoice' | 'cancelled'

const tabConfig: { value: TabFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'rfqs', label: 'RFQs' },
  { value: 'to_approve', label: 'To Approve' },
  { value: 'orders', label: 'Purchase Orders' },
  { value: 'to_invoice', label: 'To Invoice' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default function PurchaseOrderList() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabFilter>('all')
  const [search, setSearch] = useState('')

  const params: Record<string, any> = { search: search || undefined, limit: 50 }

  if (tab === 'rfqs') params.state = ['draft', 'sent']
  else if (tab === 'to_approve') params.state = ['to approve']
  else if (tab === 'orders') params.state = ['purchase']
  else if (tab === 'to_invoice') {
    params.state = ['purchase']
    params.invoice_status = ['to invoice']
  } else if (tab === 'cancelled') params.state = ['cancel']

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders', tab, search],
    queryFn: () => erpClient.raw.post('/purchase/orders', params).then((r) => r.data),
  })

  const records: PurchaseOrder[] = data?.records ?? []

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Purchase
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Loading...' : `${data?.total ?? 0} orders`}
          </p>
        </div>
        <Button
          className="rounded-2xl"
          onClick={() => navigate('/purchase/orders/new')}
        >
          <Plus className="h-4 w-4" />
          New RFQ
        </Button>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabFilter)}>
        <TabsList className="rounded-xl">
          {tabConfig.map(({ value, label }) => (
            <TabsTrigger key={value} value={value} className="rounded-lg">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Table card */}
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)]">
        <div className="flex items-center justify-between border-b border-border/70 bg-muted/20 px-6 py-4">
          <div>
            <CardTitle>Orders</CardTitle>
            <CardDescription className="mt-0.5">
              {isLoading ? 'Loading...' : `${records.length} result${records.length !== 1 ? 's' : ''}`}
            </CardDescription>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="rounded-2xl border border-border/70 bg-muted/60 p-4">
              <SlidersHorizontal className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No purchase orders found</p>
            <p className="text-xs text-muted-foreground">
              Try adjusting your filters or create a new RFQ.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Number
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Vendor
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Vendor Ref
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Order Date
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Expected Arrival
                </TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Total
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer border-border/40 transition-colors hover:bg-muted/50"
                  onClick={() => navigate(`/purchase/orders/${row.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {row.priority === '1' && (
                        <span className="text-warning font-bold" title="Urgent">!</span>
                      )}
                      <span className="font-mono text-sm font-medium">{row.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.partner_id ? row.partner_id[1] : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.partner_ref || '—'}
                  </TableCell>
                  <TableCell className="tabular-nums text-sm text-muted-foreground">
                    {row.date_order ? row.date_order.split(' ')[0] : '—'}
                  </TableCell>
                  <TableCell className="tabular-nums text-sm text-muted-foreground">
                    {row.date_planned ? row.date_planned.split(' ')[0] : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-mono text-sm font-medium tabular-nums">
                      {formatCurrency(row.amount_total)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={stateColors[row.state] ?? 'secondary'}>
                      {stateLabels[row.state] || row.state}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
