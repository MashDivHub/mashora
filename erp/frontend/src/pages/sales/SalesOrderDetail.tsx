import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Badge, Skeleton,
  CardTitle, CardDescription,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  cn,
} from '@mashora/design-system'
import {
  ArrowLeft, Check, Ban, RotateCcw, FileText, Lock,
  ChevronRight, User, MapPin, Tag, Calendar, Percent,
  Receipt, TrendingUp,
} from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

// ─── Constants ───────────────────────────────────────────────────────────────

const orderStates = [
  { value: 'draft', label: 'Quotation' },
  { value: 'sent', label: 'Sent' },
  { value: 'sale', label: 'Sales Order' },
  { value: 'cancel', label: 'Cancelled' },
]

const invoiceStatusColors: Record<string, 'warning' | 'success' | 'info' | 'secondary'> = {
  'to invoice': 'warning',
  invoiced: 'success',
  upselling: 'info',
  no: 'secondary',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
  mono = false,
  className,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-4 py-3 text-sm border-b border-border/40 last:border-0', className)}>
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={cn('text-right font-medium', mono && 'font-mono tabular-nums')}>{value}</span>
    </div>
  )
}

function SectionCard({
  title,
  description,
  children,
  noPadding = false,
}: {
  title: string
  description?: string
  children: React.ReactNode
  noPadding?: boolean
}) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
      <div className="border-b border-border/70 bg-muted/20 px-6 py-4">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription className="mt-0.5">{description}</CardDescription>}
      </div>
      <div className={noPadding ? '' : 'p-6'}>{children}</div>
    </div>
  )
}

// ─── Visual Status Bar ────────────────────────────────────────────────────────

function VisualStatusBar({
  states,
  currentState,
}: {
  states: { value: string; label: string }[]
  currentState: string
}) {
  const currentIndex = states.findIndex((s) => s.value === currentState)
  const isCancelled = currentState === 'cancel'

  return (
    <div className="flex items-center gap-1.5">
      {states.map((state, index) => {
        const isPast = !isCancelled && index < currentIndex
        const isCurrent = state.value === currentState
        const isFuture = !isCancelled && index > currentIndex

        return (
          <div key={state.value} className="flex items-center gap-1.5">
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200',
                isPast && 'bg-success/15 text-success',
                isCurrent && !isCancelled && 'bg-primary text-primary-foreground shadow-sm',
                isCurrent && isCancelled && 'bg-destructive/15 text-destructive',
                isFuture && 'bg-muted text-muted-foreground',
              )}
            >
              {isPast && (
                <Check className="size-3" />
              )}
              {state.label}
            </div>
            {index < states.length - 1 && (
              <ChevronRight
                className={cn(
                  'size-3 shrink-0',
                  isPast ? 'text-success' : 'text-muted-foreground/40',
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SalesOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: order, isLoading } = useQuery({
    queryKey: ['sale-order', id],
    queryFn: () => erpClient.raw.get(`/sales/orders/${id}`).then((r) => r.data),
    enabled: !!id,
  })

  const confirmMutation = useMutation({
    mutationFn: () => erpClient.raw.post(`/sales/orders/${id}/confirm`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sale-order', id] }),
  })

  const cancelMutation = useMutation({
    mutationFn: () => erpClient.raw.post(`/sales/orders/${id}/cancel`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sale-order', id] }),
  })

  const draftMutation = useMutation({
    mutationFn: () => erpClient.raw.post(`/sales/orders/${id}/draft`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sale-order', id] }),
  })

  const invoiceMutation = useMutation({
    mutationFn: () => erpClient.raw.post(`/sales/orders/${id}/create-invoice`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sale-order', id] }),
  })

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-28 rounded-2xl" />
        </div>
        <Skeleton className="h-10 w-full rounded-full" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-56 w-full rounded-3xl" />
          <Skeleton className="h-56 w-full rounded-3xl" />
        </div>
        <Skeleton className="h-72 w-full rounded-3xl" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <p className="text-sm font-medium">Order not found.</p>
        <Button variant="outline" className="rounded-2xl" onClick={() => navigate('/sales/orders')}>
          <ArrowLeft className="h-4 w-4" />
          Back to Orders
        </Button>
      </div>
    )
  }

  const isDraft = order.state === 'draft' || order.state === 'sent'
  const isConfirmed = order.state === 'sale'
  const isCancelled = order.state === 'cancel'
  const lines = order.lines || []
  const eyebrow = isDraft ? 'Quotation' : isConfirmed ? 'Sales Order' : 'Cancelled'

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            {eyebrow}
          </p>
          <h1 className="text-2xl font-bold tracking-tight font-mono">
            {order.name || 'New Quotation'}
          </h1>
          {order.partner_id && (
            <p className="text-sm text-muted-foreground">
              {order.partner_id[1]}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isDraft && (
            <Button
              onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending}
              className="rounded-2xl"
            >
              <Check className="h-4 w-4" />
              {confirmMutation.isPending ? 'Confirming…' : 'Confirm Order'}
            </Button>
          )}
          {isConfirmed && order.invoice_status === 'to invoice' && (
            <Button
              variant="default"
              onClick={() => invoiceMutation.mutate()}
              disabled={invoiceMutation.isPending}
              className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <FileText className="h-4 w-4" />
              {invoiceMutation.isPending ? 'Creating…' : 'Create Invoice'}
            </Button>
          )}
          {(isDraft || isConfirmed) && (
            <Button
              variant="outline"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="rounded-2xl"
            >
              <Ban className="h-4 w-4" />
              Cancel
            </Button>
          )}
          {isCancelled && (
            <Button
              variant="outline"
              onClick={() => draftMutation.mutate()}
              disabled={draftMutation.isPending}
              className="rounded-2xl"
            >
              <RotateCcw className="h-4 w-4" />
              Reset to Draft
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => navigate('/sales/orders')}
            className="rounded-2xl"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      </div>

      {/* Status strip */}
      <div className="rounded-2xl border border-border/60 bg-card px-5 py-3.5 flex flex-wrap items-center gap-3">
        <VisualStatusBar states={orderStates} currentState={order.state} />
        {isConfirmed && order.invoice_status && order.invoice_status !== 'no' && (
          <>
            <span className="text-border/60 select-none">·</span>
            <Badge variant={invoiceStatusColors[order.invoice_status] ?? 'secondary'}>
              {order.invoice_status}
            </Badge>
          </>
        )}
        {order.locked && (
          <>
            <span className="text-border/60 select-none">·</span>
            <Badge variant="secondary">
              <Lock className="mr-1 h-3 w-3" />
              Locked
            </Badge>
          </>
        )}
      </div>

      {/* Two-column grid: Customer + Amounts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Customer card */}
        <SectionCard title="Customer" description="Contact and reference information">
          <InfoRow
            label="Customer"
            value={order.partner_id ? order.partner_id[1] : '—'}
          />
          <InfoRow
            label="Invoice Address"
            value={order.partner_invoice_id ? order.partner_invoice_id[1] : '—'}
          />
          <InfoRow
            label="Delivery Address"
            value={order.partner_shipping_id ? order.partner_shipping_id[1] : '—'}
          />
          {order.client_order_ref && (
            <InfoRow
              label="Customer Ref"
              value={order.client_order_ref}
            />
          )}
        </SectionCard>

        {/* Amounts card */}
        <SectionCard title="Summary" description="Dates and financial totals">
          <InfoRow
            label="Order Date"
            value={order.date_order ? order.date_order.split(' ')[0] : '—'}
          />
          {order.validity_date && (
            <InfoRow label="Expiration" value={order.validity_date} />
          )}
          <InfoRow
            label="Untaxed Amount"
            value={formatCurrency(order.amount_untaxed)}
            mono
          />
          <InfoRow
            label="Tax"
            value={formatCurrency(order.amount_tax)}
            mono
          />
          {/* Total row — visually prominent */}
          <div className="flex items-center justify-between gap-4 py-3 text-base font-semibold border-b border-border/40">
            <span>Total</span>
            <span className="font-mono tabular-nums">{formatCurrency(order.amount_total)}</span>
          </div>
          {isConfirmed && (
            <>
              <InfoRow
                label="Invoiced"
                value={formatCurrency(order.amount_invoiced ?? 0)}
                mono
                className="text-xs text-muted-foreground"
              />
              <InfoRow
                label="To Invoice"
                value={formatCurrency(order.amount_to_invoice ?? 0)}
                mono
                className="text-xs text-muted-foreground"
              />
            </>
          )}
        </SectionCard>
      </div>

      {/* Order lines */}
      <SectionCard
        title="Order Lines"
        description={`${lines.filter((l: any) => !l.display_type).length} product line${lines.filter((l: any) => !l.display_type).length !== 1 ? 's' : ''}`}
        noPadding
      >
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Product
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Description
              </TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Qty
              </TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Unit Price
              </TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Disc %
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Taxes
              </TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Subtotal
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                  No order lines.
                </TableCell>
              </TableRow>
            ) : (
              lines.map((line: any) => {
                if (line.display_type === 'line_section') {
                  return (
                    <TableRow key={line.id} className="bg-muted/30 border-border/40">
                      <TableCell colSpan={7} className="py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        {line.name}
                      </TableCell>
                    </TableRow>
                  )
                }
                if (line.display_type === 'line_note') {
                  return (
                    <TableRow key={line.id} className="border-border/40">
                      <TableCell colSpan={7} className="py-2 text-sm italic text-muted-foreground">
                        {line.name}
                      </TableCell>
                    </TableRow>
                  )
                }
                return (
                  <TableRow key={line.id} className="border-border/40 hover:bg-muted/50 transition-colors">
                    <TableCell className="text-sm font-medium">
                      {line.product_id ? line.product_id[1] : '—'}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {line.name || '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {line.product_uom_qty}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {formatCurrency(line.price_unit)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {line.discount > 0 ? `${line.discount}%` : '—'}
                    </TableCell>
                    <TableCell>
                      {line.tax_ids?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {line.tax_ids.map((tax: any) => (
                            <Badge
                              key={typeof tax === 'number' ? tax : tax[0]}
                              variant="secondary"
                              className="text-xs"
                            >
                              {typeof tax === 'number' ? `Tax ${tax}` : tax[1]}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold tabular-nums">
                      {formatCurrency(line.price_subtotal)}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </SectionCard>

      {/* Related Invoices */}
      {order.invoice_ids?.length > 0 && (
        <SectionCard
          title={`Invoices (${order.invoice_count})`}
          description="Accounting documents linked to this order"
        >
          <div className="flex flex-wrap gap-2">
            {order.invoice_ids.map((invId: number) => (
              <Button
                key={invId}
                variant="outline"
                size="sm"
                className="rounded-xl font-mono"
                onClick={() => navigate(`/accounting/invoices/${invId}`)}
              >
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                INV-{invId}
              </Button>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}
