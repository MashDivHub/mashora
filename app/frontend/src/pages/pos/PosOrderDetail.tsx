import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/shared'
import {
  Badge, Button, Skeleton,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'
import {
  ArrowLeft, Ban, FileText, Printer, Receipt, CreditCard, User, Calendar,
  Monitor, ShoppingBag,
} from 'lucide-react'
import { fmtMoney } from './utils'

type RefField = [number, string] | number | false | null | undefined

interface OrderLine {
  id: number
  product_id: RefField
  name: string
  qty: number
  price_unit: number
  discount: number
  price_subtotal: number
  price_subtotal_incl: number
  note?: string
}

interface Payment {
  id: number
  amount: number
  payment_method_id: RefField
  card_type?: string
  transaction_id?: string
  payment_date?: string
}

interface PosOrder {
  id: number
  name: string
  pos_reference: string
  state: 'draft' | 'paid' | 'done' | 'cancel' | 'invoiced' | string
  date_order: string
  session_id: RefField
  partner_id: RefField
  user_id?: RefField
  amount_total: number
  amount_tax: number
  amount_paid: number
  amount_return: number
  lines: OrderLine[]
  payments: Payment[]
}

function refLabel(val: RefField, fallback = '—'): string {
  if (Array.isArray(val)) return val[1]
  if (typeof val === 'number') return `#${val}`
  return fallback
}

function refId(val: RefField): number | null {
  if (Array.isArray(val)) return val[0]
  if (typeof val === 'number') return val
  return null
}

const formatDate = (raw: string) => {
  try { return new Date(raw).toLocaleString() } catch { return raw }
}

const STATE_META: Record<string, { label: string; tone: 'emerald' | 'blue' | 'amber' | 'rose' | 'slate' }> = {
  paid:     { label: 'Paid',      tone: 'emerald' },
  done:     { label: 'Done',      tone: 'blue' },
  draft:    { label: 'Draft',     tone: 'slate' },
  cancel:   { label: 'Cancelled', tone: 'rose' },
  invoiced: { label: 'Invoiced',  tone: 'blue' },
}

const TONE_BADGE: Record<'emerald' | 'blue' | 'amber' | 'rose' | 'slate', string> = {
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20',
  blue:    'bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-500/20',
  amber:   'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20',
  rose:    'bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-rose-500/20',
  slate:   'bg-muted/60 text-muted-foreground ring-border/40',
}

function SectionCard({ icon, title, children }: { icon?: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card p-6 space-y-4 transition-all duration-200 hover:shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  )
}

function SummaryRow({ label, value, valueClass, strong }: { label: string; value: React.ReactNode; valueClass?: string; strong?: boolean }) {
  return (
    <div className="flex justify-between items-baseline gap-4">
      <span className={`text-sm ${strong ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{label}</span>
      <span className={`tabular-nums ${strong ? 'text-base font-bold' : 'text-sm font-medium'} ${valueClass || ''}`}>{value}</span>
    </div>
  )
}

export default function PosOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: order, isLoading, isError } = useQuery<PosOrder>({
    queryKey: ['pos-order', id],
    queryFn: async () => {
      const { data } = await erpClient.raw.get(`/pos/orders/${id}`)
      return data
    },
    enabled: !!id,
  })

  async function handleCancel() {
    if (!id) return
    if (!confirm('Cancel this order?')) return
    try {
      await erpClient.raw.post(`/pos/orders/${id}/cancel`)
      toast.success('Order cancelled')
      queryClient.invalidateQueries({ queryKey: ['pos-order', id] })
      queryClient.invalidateQueries({ queryKey: ['pos-orders'] })
    } catch (e) {
      toast.error('Cancel failed', extractErrorMessage(e))
    }
  }

  async function handleInvoice() {
    if (!id) return
    try {
      await erpClient.raw.post(`/pos/orders/${id}/invoice`)
      toast.success('Order invoiced')
      queryClient.invalidateQueries({ queryKey: ['pos-order', id] })
      queryClient.invalidateQueries({ queryKey: ['pos-orders'] })
    } catch (e) {
      toast.error('Invoice failed', extractErrorMessage(e))
    }
  }

  function handlePrint() {
    window.print()
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (isError || !order) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card p-12 text-center text-muted-foreground">
        Failed to load order.
      </div>
    )
  }

  const stateMeta = STATE_META[order.state] ?? { label: order.state, tone: 'slate' as const }
  const subtotal = Number(order.amount_total) - Number(order.amount_tax)
  const sessionId = refId(order.session_id)
  const sessionName = refLabel(order.session_id, '—')
  const customerName = order.partner_id ? refLabel(order.partner_id, 'Walk-in Customer') : 'Walk-in Customer'
  const cashierName = refLabel(order.user_id, '—')
  const canInvoice = order.state === 'paid' || order.state === 'done'
  const canCancel = order.state !== 'cancel' && order.state !== 'invoiced'
  const lines = order.lines ?? []
  const payments = order.payments ?? []

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-3xl border border-border/40 bg-gradient-to-br from-primary/10 via-background to-emerald-500/5 p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3 min-w-0">
            <button
              onClick={() => navigate('/admin/pos/orders')}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to orders
            </button>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold tracking-tight font-mono">{order.name}</h1>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ring-1 ${TONE_BADGE[stateMeta.tone]}`}>
                {stateMeta.label}
              </span>
            </div>
            {order.pos_reference && (
              <p className="text-xs font-mono text-muted-foreground">Ref: {order.pos_reference}</p>
            )}
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(order.date_order)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                {customerName}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Monitor className="h-3.5 w-3.5" />
                {cashierName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" className="rounded-xl gap-1.5" onClick={handlePrint}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            {canInvoice && (
              <Button variant="outline" className="rounded-xl gap-1.5" onClick={handleInvoice}>
                <FileText className="h-4 w-4" /> Invoice
              </Button>
            )}
            {canCancel && (
              <Button variant="outline" className="rounded-xl gap-1.5 text-rose-500 hover:text-rose-600 hover:border-rose-500/40" onClick={handleCancel}>
                <Ban className="h-4 w-4" /> Cancel
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        {/* Left */}
        <div className="space-y-6">
          <SectionCard title="Line Items" icon={<ShoppingBag className="h-4 w-4" />}>
            <div className="rounded-xl border border-border/40 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/40 bg-muted/30">
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Product</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-20">Qty</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-28">Unit Price</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-24">Discount</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-28">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">No order lines</TableCell>
                    </TableRow>
                  ) : lines.map(line => (
                    <TableRow key={line.id} className="border-border/30 hover:bg-muted/20">
                      <TableCell className="py-3">
                        <p className="text-sm font-medium">{line.name || refLabel(line.product_id, '—')}</p>
                        {line.note && (
                          <p className="text-xs text-muted-foreground italic mt-0.5">{line.note}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{Number(line.qty).toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{fmtMoney(line.price_unit)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                        {line.discount ? `${line.discount}%` : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-medium">{fmtMoney(line.price_subtotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </SectionCard>

          <SectionCard title="Session" icon={<Receipt className="h-4 w-4" />}>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Belongs to</p>
                {sessionId ? (
                  <button
                    onClick={() => navigate(`/admin/pos/sessions/${sessionId}`)}
                    className="text-sm font-medium text-primary hover:underline font-mono"
                  >
                    {sessionName}
                  </button>
                ) : (
                  <span className="text-sm font-medium">{sessionName}</span>
                )}
              </div>
              {sessionId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => navigate(`/admin/pos/sessions/${sessionId}`)}
                >
                  View session
                </Button>
              )}
            </div>
          </SectionCard>
        </div>

        {/* Right */}
        <div className="space-y-6 lg:sticky lg:top-6">
          <SectionCard title="Order Summary" icon={<Receipt className="h-4 w-4" />}>
            <div className="space-y-2.5">
              <SummaryRow label="Subtotal" value={fmtMoney(subtotal)} />
              <SummaryRow label="Tax" value={fmtMoney(order.amount_tax)} />
              <div className="border-t border-border/40 pt-3">
                <SummaryRow label="Total" value={fmtMoney(order.amount_total)} strong />
              </div>
              <div className="border-t border-border/40 pt-3 space-y-2.5">
                <SummaryRow label="Paid" value={fmtMoney(order.amount_paid)} valueClass="text-emerald-500" />
                {Number(order.amount_return) > 0 && (
                  <SummaryRow label="Change" value={fmtMoney(order.amount_return)} valueClass="text-amber-500" />
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Payments" icon={<CreditCard className="h-4 w-4" />}>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No payments recorded</p>
            ) : (
              <div className="space-y-3">
                {payments.map(p => (
                  <div key={p.id} className="flex items-start justify-between gap-3 rounded-xl border border-border/40 bg-muted/20 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{refLabel(p.payment_method_id, '—')}</p>
                      {p.card_type && (
                        <p className="text-xs text-muted-foreground mt-0.5">{p.card_type}</p>
                      )}
                      {p.transaction_id && (
                        <p className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">{p.transaction_id}</p>
                      )}
                    </div>
                    <p className="tabular-nums text-sm font-semibold whitespace-nowrap">{fmtMoney(p.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Customer" icon={<User className="h-4 w-4" />}>
            <div className="space-y-2">
              <p className="text-sm font-medium">{customerName}</p>
              <p className="text-xs text-muted-foreground">Cashier: {cashierName}</p>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
