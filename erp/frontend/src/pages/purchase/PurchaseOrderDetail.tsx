import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Badge, Skeleton,
  CardTitle, CardDescription,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  cn,
} from '@mashora/design-system'
import {
  ArrowLeft, Check, CheckCheck, Ban, RotateCcw, FileText, Lock,
  ChevronRight,
} from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

// ─── Constants ────────────────────────────────────────────────────────────────

const orderStates = [
  { value: 'draft', label: 'RFQ' },
  { value: 'sent', label: 'Sent' },
  { value: 'to approve', label: 'To Approve' },
  { value: 'purchase', label: 'Purchase Order' },
  { value: 'cancel', label: 'Cancelled' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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
    <div className={cn('flex items-center justify-between gap-4 border-b border-border/40 py-3 text-sm last:border-0', className)}>
      <span className="shrink-0 text-muted-foreground">{label}</span>
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
    <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)]">
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
    <div className="flex flex-wrap items-center gap-1.5">
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
              {isPast && <Check className="size-3" />}
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

export default function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: order, isLoading } = useQuery({
    queryKey: ['purchase-order', id],
    queryFn: () => erpClient.raw.get(`/purchase/orders/${id}`).then((r) => r.data),
    enabled: !!id,
  })

  const confirmMutation = useMutation({
    mutationFn: () => erpClient.raw.post(`/purchase/orders/${id}/confirm`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchase-order', id] }),
  })

  const approveMutation = useMutation({
    mutationFn: () => erpClient.raw.post(`/purchase/orders/${id}/approve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchase-order', id] }),
  })

  const cancelMutation = useMutation({
    mutationFn: () => erpClient.raw.post(`/purchase/orders/${id}/cancel`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchase-order', id] }),
  })

  const draftMutation = useMutation({
    mutationFn: () => erpClient.raw.post(`/purchase/orders/${id}/draft`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchase-order', id] }),
  })

  const billMutation = useMutation({
    mutationFn: () => erpClient.raw.post(`/purchase/orders/${id}/create-bill`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchase-order', id] }),
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
        <Button variant="outline" className="rounded-2xl" onClick={() => navigate('/purchase/orders')}>
          <ArrowLeft className="h-4 w-4" />
          Back to Orders
        </Button>
      </div>
    )
  }

  const isDraft = order.state === 'draft' || order.state === 'sent'
  const isToApprove = order.state === 'to approve'
  const isConfirmed = order.state === 'purchase'
  const isCancelled = order.state === 'cancel'
  const lines = order.lines || []

  const eyebrow = isDraft
    ? 'Request for Quotation'
    : isToApprove
    ? 'Awaiting Approval'
    : isConfirmed
    ? 'Purchase Order'
    : 'Cancelled'

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            {eyebrow}
          </p>
          <h1 className="font-mono text-2xl font-bold tracking-tight">
            {order.name || 'New RFQ'}
          </h1>
          {order.partner_id && (
            <p className="text-sm text-muted-foreground">{order.partner_id[1]}</p>
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
              {confirmMutation.isPending ? 'Confirming...' : 'Confirm Order'}
            </Button>
          )}
          {isToApprove && (
            <Button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="rounded-2xl"
            >
              <CheckCheck className="h-4 w-4" />
              {approveMutation.isPending ? 'Approving...' : 'Approve'}
            </Button>
          )}
          {isConfirmed && order.invoice_status === 'to invoice' && (
            <Button
              onClick={() => billMutation.mutate()}
              disabled={billMutation.isPending}
              className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <FileText className="h-4 w-4" />
              {billMutation.isPending ? 'Creating...' : 'Create Bill'}
            </Button>
          )}
          {!isCancelled && !isConfirmed && (
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
            onClick={() => navigate('/purchase/orders')}
            className="rounded-2xl"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      </div>

      {/* Status strip */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card px-5 py-3.5">
        <VisualStatusBar states={orderStates} currentState={order.state} />
        {order.locked && (
          <>
            <span className="select-none text-border/60">·</span>
            <Badge variant="secondary">
              <Lock className="mr-1 h-3 w-3" />
              Locked
            </Badge>
          </>
        )}
        {order.priority === '1' && (
          <>
            <span className="select-none text-border/60">·</span>
            <Badge variant="warning">Urgent</Badge>
          </>
        )}
      </div>

      {/* Two-column grid: Vendor info + Amounts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Vendor card */}
        <SectionCard title="Vendor" description="Contact and order reference">
          <InfoRow
            label="Vendor"
            value={order.partner_id ? order.partner_id[1] : '—'}
          />
          {order.partner_ref && (
            <InfoRow label="Vendor Reference" value={order.partner_ref} />
          )}
          <InfoRow
            label="Order Date"
            value={order.date_order ? order.date_order.split(' ')[0] : '—'}
          />
          <InfoRow
            label="Expected Arrival"
            value={order.date_planned ? order.date_planned.split(' ')[0] : '—'}
          />
          {order.date_approve && (
            <InfoRow
              label="Confirmed On"
              value={order.date_approve.split(' ')[0]}
            />
          )}
          {order.origin && (
            <InfoRow label="Source" value={order.origin} />
          )}
        </SectionCard>

        {/* Amounts card */}
        <SectionCard title="Amounts" description="Financial summary for this order">
          <InfoRow
            label="Untaxed"
            value={formatCurrency(order.amount_untaxed)}
            mono
          />
          <InfoRow
            label="Tax"
            value={formatCurrency(order.amount_tax)}
            mono
          />
          {/* Total row — visually prominent */}
          <div className="flex items-center justify-between gap-4 border-b border-border/40 py-3 text-base font-semibold last:border-0">
            <span>Total</span>
            <span className="font-mono tabular-nums">{formatCurrency(order.amount_total)}</span>
          </div>
          {order.invoice_status && order.invoice_status !== 'nothing to bill' && (
            <InfoRow
              label="Invoice Status"
              value={
                <Badge
                  variant={
                    order.invoice_status === 'to invoice'
                      ? 'warning'
                      : order.invoice_status === 'invoiced'
                      ? 'success'
                      : 'secondary'
                  }
                >
                  {order.invoice_status}
                </Badge>
              }
            />
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
                Ordered
              </TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Received
              </TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Billed
              </TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Unit Price
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
                <TableCell colSpan={8} className="h-24 text-center text-sm text-muted-foreground">
                  No order lines.
                </TableCell>
              </TableRow>
            ) : (
              lines.map((line: any) => {
                if (line.display_type === 'line_section' || line.display_type === 'line_subsection') {
                  return (
                    <TableRow key={line.id} className="border-border/40 bg-muted/30">
                      <TableCell colSpan={8} className="py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        {line.name}
                      </TableCell>
                    </TableRow>
                  )
                }
                if (line.display_type === 'line_note') {
                  return (
                    <TableRow key={line.id} className="border-border/40">
                      <TableCell colSpan={8} className="py-2 text-sm italic text-muted-foreground">
                        {line.name}
                      </TableCell>
                    </TableRow>
                  )
                }
                return (
                  <TableRow key={line.id} className="border-border/40 transition-colors hover:bg-muted/50">
                    <TableCell className="text-sm font-medium">
                      {line.product_id ? line.product_id[1] : '—'}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-sm text-muted-foreground">
                      {line.name || '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {line.product_qty}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      <span
                        className={cn(
                          line.qty_received < line.product_qty && 'text-warning'
                        )}
                      >
                        {line.qty_received}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {line.qty_invoiced}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {formatCurrency(line.price_unit)}
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

      {/* Related Vendor Bills */}
      {order.invoice_ids?.length > 0 && (
        <SectionCard
          title={`Vendor Bills (${order.invoice_count})`}
          description="Accounting documents linked to this purchase order"
        >
          <div className="flex flex-wrap gap-2">
            {order.invoice_ids.map((billId: number) => (
              <Button
                key={billId}
                variant="outline"
                size="sm"
                className="rounded-xl font-mono"
                onClick={() => navigate(`/accounting/invoices/${billId}`)}
              >
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                Bill #{billId}
              </Button>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}
