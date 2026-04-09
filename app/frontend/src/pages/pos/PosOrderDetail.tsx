import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared'
import {
  Badge, Skeleton,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { ArrowLeft, Receipt, CreditCard, User, Calendar } from 'lucide-react'

// ── types ────────────────────────────────────────────────────────────────────

interface OrderLine {
  id: number
  product_id: [number, string]
  full_product_name: string
  qty: number
  price_unit: number
  discount: number
  price_subtotal: number
  price_subtotal_incl: number
  customer_note: string
}

interface Payment {
  id: number
  amount: number
  payment_method_id: [number, string]
  card_type: string
  transaction_id: string
}

interface PosOrder {
  id: number
  name: string
  pos_reference: string
  state: 'draft' | 'paid' | 'done' | 'cancel' | string
  date_order: string
  session_id: [number, string]
  partner_id: [number, string] | false
  employee_id: [number, string] | false
  amount_total: number
  amount_tax: number
  amount_paid: number
  amount_return: number
  order_lines: OrderLine[]
  payments: Payment[]
  account_move?: [number, string] | false
}

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => `$${Number(n || 0).toFixed(2)}`

const formatDate = (raw: string) => {
  try { return new Date(raw).toLocaleString() } catch { return raw }
}

type BadgeVariant = 'success' | 'default' | 'secondary' | 'destructive' | 'outline'

const STATE_META: Record<string, { label: string; variant: BadgeVariant }> = {
  paid:   { label: 'Paid',      variant: 'success' },
  done:   { label: 'Done',      variant: 'default' },
  draft:  { label: 'Draft',     variant: 'secondary' },
  cancel: { label: 'Cancelled', variant: 'destructive' },
}

// ── sub-components ────────────────────────────────────────────────────────────

function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
      {children}
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-muted-foreground shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="text-sm font-medium mt-0.5">{value}</div>
      </div>
    </div>
  )
}

// ── main component ─────────────────────────────────────────────────────────────

export default function PosOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: order, isLoading, isError } = useQuery<PosOrder>({
    queryKey: ['pos-order', id],
    queryFn: async () => {
      const { data } = await erpClient.raw.get(`/pos/orders/${id}`)
      return data
    },
    enabled: !!id,
  })

  // ── loading / error states ─────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  if (isError || !order) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Failed to load order.
      </div>
    )
  }

  // ── derived values ─────────────────────────────────────────────────────────

  const stateMeta = STATE_META[order.state] ?? { label: order.state, variant: 'outline' as BadgeVariant }
  const subtotal = Number(order.amount_total) - Number(order.amount_tax)
  const sessionId = Array.isArray(order.session_id) ? order.session_id[0] : null
  const sessionName = Array.isArray(order.session_id) ? order.session_id[1] : '—'
  const customerName = Array.isArray(order.partner_id) ? order.partner_id[1] : 'Walk-in Customer'
  const cashierName = Array.isArray(order.employee_id) ? order.employee_id[1] : '—'
  const invoiceRef = Array.isArray(order.account_move) ? order.account_move[1] : null

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* ── header ── */}
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <button
              onClick={() => navigate('/pos/orders')}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Back to orders"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span>{order.name}</span>
            <span className="text-muted-foreground font-normal text-base">{order.pos_reference}</span>
          </span>
        }
        actions={<Badge variant={stateMeta.variant}>{stateMeta.label}</Badge>}
      />

      {/* ── body: 2-column on desktop ── */}
      <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">

        {/* ── left column ── */}
        <div className="space-y-6">

          {/* ── info grid ── */}
          <InfoCard>
            <div className="grid sm:grid-cols-3 gap-6">
              <InfoRow
                icon={<Receipt className="h-4 w-4" />}
                label="Session"
                value={
                  sessionId ? (
                    <button
                      onClick={() => navigate(`/pos/sessions/${sessionId}`)}
                      className="text-primary hover:underline"
                    >
                      {sessionName}
                    </button>
                  ) : sessionName
                }
              />
              <InfoRow
                icon={<User className="h-4 w-4" />}
                label="Customer"
                value={customerName}
              />
              <InfoRow
                icon={<User className="h-4 w-4" />}
                label="Cashier"
                value={cashierName}
              />
              <InfoRow
                icon={<Calendar className="h-4 w-4" />}
                label="Date"
                value={formatDate(order.date_order)}
              />
              {invoiceRef && (
                <InfoRow
                  icon={<Receipt className="h-4 w-4" />}
                  label="Invoice"
                  value={invoiceRef}
                />
              )}
            </div>
          </InfoCard>

          {/* ── order lines ── */}
          <InfoCard>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Order Lines</h2>
            <div className="rounded-xl border border-border/40 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/40">
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Product</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-20">Qty</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-28">Unit Price</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-24">Discount</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-28">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.order_lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">No order lines</TableCell>
                    </TableRow>
                  ) : order.order_lines.map(line => (
                    <TableRow key={line.id} className="border-border/30 hover:bg-muted/10">
                      <TableCell className="py-2">
                        <p className="text-sm font-medium">{line.full_product_name}</p>
                        {line.customer_note && (
                          <p className="text-xs text-muted-foreground italic mt-0.5">{line.customer_note}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{Number(line.qty).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmt(line.price_unit)}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-muted-foreground">
                        {line.discount ? `${line.discount}%` : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-medium">{fmt(line.price_subtotal)}</TableCell>
                    </TableRow>
                  ))}

                  {/* totals footer */}
                  <TableRow className="border-t border-border/40 bg-muted/10 hover:bg-muted/10">
                    <TableCell colSpan={4} className="text-right text-sm text-muted-foreground py-2">Subtotal</TableCell>
                    <TableCell className="text-right font-mono text-sm py-2">{fmt(subtotal)}</TableCell>
                  </TableRow>
                  <TableRow className="bg-muted/10 hover:bg-muted/10">
                    <TableCell colSpan={4} className="text-right text-sm text-muted-foreground py-2">Tax</TableCell>
                    <TableCell className="text-right font-mono text-sm py-2">{fmt(order.amount_tax)}</TableCell>
                  </TableRow>
                  <TableRow className="bg-muted/10 hover:bg-muted/10">
                    <TableCell colSpan={4} className="text-right text-sm font-bold py-2">Total</TableCell>
                    <TableCell className="text-right font-mono text-sm font-bold py-2">{fmt(order.amount_total)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </InfoCard>

          {/* ── payments ── */}
          <InfoCard>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Payments
            </h2>
            <div className="rounded-xl border border-border/40 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/40">
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Method</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-32">Amount</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider w-32">Card Type</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Transaction ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">No payments</TableCell>
                    </TableRow>
                  ) : order.payments.map(p => (
                    <TableRow key={p.id} className="border-border/30 hover:bg-muted/10">
                      <TableCell className="text-sm font-medium">
                        {Array.isArray(p.payment_method_id) ? p.payment_method_id[1] : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmt(p.amount)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.card_type || '—'}</TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">{p.transaction_id || '—'}</TableCell>
                    </TableRow>
                  ))}

                  {/* change row */}
                  {Number(order.amount_return) > 0 && (
                    <TableRow className="border-t border-border/40 bg-muted/10 hover:bg-muted/10">
                      <TableCell className="text-sm font-medium text-muted-foreground italic py-2">Change</TableCell>
                      <TableCell className="text-right font-mono text-sm text-muted-foreground py-2">
                        -{fmt(order.amount_return)}
                      </TableCell>
                      <TableCell /><TableCell />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </InfoCard>
        </div>

        {/* ── right column: receipt summary ── */}
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 text-white rounded-2xl p-6 space-y-4 lg:sticky lg:top-6">
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="h-4 w-4 text-zinc-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Receipt Summary</span>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">Subtotal</span>
              <span className="font-mono">{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Tax</span>
              <span className="font-mono">{fmt(order.amount_tax)}</span>
            </div>
          </div>

          <div className="border-t border-zinc-700 pt-4">
            <div className="flex justify-between items-baseline">
              <span className="text-base font-bold">Total</span>
              <span className="font-mono text-2xl font-bold">{fmt(order.amount_total)}</span>
            </div>
          </div>

          <div className="border-t border-zinc-700 pt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">Paid</span>
              <span className="font-mono text-green-400">{fmt(order.amount_paid)}</span>
            </div>
            {Number(order.amount_return) > 0 && (
              <div className="flex justify-between">
                <span className="text-zinc-400">Change</span>
                <span className="font-mono text-yellow-400">{fmt(order.amount_return)}</span>
              </div>
            )}
          </div>

          <div className="pt-2">
            <Badge
              variant={stateMeta.variant}
              className="w-full justify-center text-xs py-1"
            >
              {stateMeta.label}
            </Badge>
          </div>
        </div>

      </div>
    </div>
  )
}
