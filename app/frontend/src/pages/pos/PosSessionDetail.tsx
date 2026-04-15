import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader, StatusBar, stepsFromSelection, toast } from '@/components/shared'
import {
  Button, Badge, Skeleton,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { ArrowLeft, Play, Square, DollarSign, Receipt, Clock } from 'lucide-react'

// ── helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—'
  return '$' + Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

function m2oLabel(value: [number, string] | string | null | undefined): string {
  if (Array.isArray(value)) return value[1] ?? '—'
  return value ?? '—'
}

// ── status steps ─────────────────────────────────────────────────────────────

const SESSION_STEPS = stepsFromSelection([
  ['opening_control', 'Opening'],
  ['opened', 'In Progress'],
  ['closing_control', 'Closing'],
  ['closed', 'Closed'],
])

// ── order status badge ────────────────────────────────────────────────────────

type OrderState = 'draft' | 'paid' | 'done' | 'cancel'

const ORDER_BADGE: Record<OrderState, { variant: 'secondary' | 'success' | 'default' | 'destructive'; label: string }> = {
  draft:  { variant: 'secondary',   label: 'Draft' },
  paid:   { variant: 'success',     label: 'Paid' },
  done:   { variant: 'default',     label: 'Done' },
  cancel: { variant: 'destructive', label: 'Cancelled' },
}

// ── types ─────────────────────────────────────────────────────────────────────

interface PaymentMethod {
  id: number
  name: string
  type?: string
}

interface PosOrder {
  id: number
  name: string
  partner_id: [number, string] | null
  date_order: string
  amount_total: number
  state: OrderState
}

interface PosSession {
  id: number
  name: string
  state: string
  config_id: [number, string]
  user_id: [number, string]
  start_at: string | null
  stop_at: string | null
  opening_notes: string | null
  cash_register_balance_start: number
  cash_register_balance_end_real: number
  cash_register_balance_end: number
  cash_register_difference: number
  total_payments_amount?: number
  payment_methods: PaymentMethod[]
  orders: PosOrder[]
}

// ── card wrapper ──────────────────────────────────────────────────────────────

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        {icon}
        {title}
      </div>
      {children}
    </div>
  )
}

function InfoRow({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex justify-between items-start gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={['font-medium text-right', valueClass].filter(Boolean).join(' ')}>{value ?? '—'}</span>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function PosSessionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const sessionId = id ? parseInt(id, 10) : null

  const { data: session, isLoading } = useQuery<PosSession>({
    queryKey: ['pos-session', sessionId],
    queryFn: async () => {
      const { data } = await erpClient.raw.get(`/pos/sessions/${sessionId}`)
      return data
    },
    enabled: !!sessionId,
  })

  const openMut = useMutation({
    mutationFn: async () => {
      const { data } = await erpClient.raw.post(`/pos/sessions/${sessionId}/open`, {})
      return data
    },
    onSuccess: () => {
      toast.success('Session Opened', 'The POS session is now open.')
      queryClient.invalidateQueries({ queryKey: ['pos-session', sessionId] })
    },
    onError: (e: any) => {
      toast.error('Failed to Open', e?.response?.data?.detail || e.message || 'Unknown error')
    },
  })

  const closeMut = useMutation({
    mutationFn: async () => {
      const { data } = await erpClient.raw.post(`/pos/sessions/${sessionId}/close`, {})
      return data
    },
    onSuccess: () => {
      toast.success('Session Closed', 'The POS session has been closed.')
      queryClient.invalidateQueries({ queryKey: ['pos-session', sessionId] })
    },
    onError: (e: any) => {
      toast.error('Failed to Close', e?.response?.data?.detail || e.message || 'Unknown error')
    },
  })

  // ── loading skeleton ──────────────────────────────────────────────────────

  if (isLoading || !session) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-8 w-96 rounded-full" />
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    )
  }

  const state = session.state
  const diff = session.cash_register_difference ?? 0

  // ── action buttons ────────────────────────────────────────────────────────

  const actionButtons = (
    <>
      {state === 'opening_control' && (
        <Button
          size="sm"
          className="rounded-xl gap-1.5"
          onClick={() => openMut.mutate()}
          disabled={openMut.isPending}
        >
          <Play className="h-3.5 w-3.5" />
          Open Session
        </Button>
      )}
      {state === 'opened' && (
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl gap-1.5"
          onClick={() => closeMut.mutate()}
          disabled={closeMut.isPending}
        >
          <Square className="h-3.5 w-3.5" />
          Close Session
        </Button>
      )}
    </>
  )

  return (
    <div className="space-y-6">
      {/* Page header */}
      <PageHeader
        title={session.name}
        backTo="/pos/sessions"
        actions={actionButtons}
      >
        <StatusBar steps={SESSION_STEPS} current={state} />
      </PageHeader>

      {/* Info cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Session Info */}
        <Card title="Session Info" icon={<Clock className="h-4 w-4" />}>
          <div className="space-y-2.5">
            <InfoRow label="Config" value={m2oLabel(session.config_id)} />
            <InfoRow label="Opened By" value={m2oLabel(session.user_id)} />
            <InfoRow label="Start Date" value={formatDate(session.start_at)} />
            <InfoRow label="End Date" value={formatDate(session.stop_at)} />
            {session.opening_notes && (
              <InfoRow label="Opening Notes" value={session.opening_notes} />
            )}
          </div>
        </Card>

        {/* Cash Summary */}
        <Card title="Cash Summary" icon={<DollarSign className="h-4 w-4" />}>
          <div className="space-y-2.5">
            <InfoRow label="Opening Balance" value={formatCurrency(session.cash_register_balance_start)} />
            <InfoRow label="Closing Balance" value={formatCurrency(session.cash_register_balance_end_real)} />
            <InfoRow label="Theoretical Balance" value={formatCurrency(session.cash_register_balance_end)} />
            <InfoRow
              label="Difference"
              value={formatCurrency(diff)}
              valueClass={diff < 0 ? 'text-destructive' : undefined}
            />
            <div className="border-t border-border/30 pt-2.5">
              <InfoRow label="Total Payments" value={formatCurrency(session.total_payments_amount)} />
            </div>
          </div>
        </Card>
      </div>

      {/* Payment Methods table */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Payment Methods
        </h2>
        <div className="rounded-2xl border border-border/30 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/30">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Method</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!session.payment_methods || session.payment_methods.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="h-16 text-center text-muted-foreground text-sm">
                    No payment methods
                  </TableCell>
                </TableRow>
              ) : session.payment_methods.map(pm => (
                <TableRow key={pm.id} className="border-border/20 hover:bg-muted/10">
                  <TableCell className="text-sm font-medium">{pm.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground capitalize">{pm.type ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Orders table */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          Orders
        </h2>
        <div className="rounded-2xl border border-border/30 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/30">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Order</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Customer</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Date</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Total</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!session.orders || session.orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-20 text-center text-muted-foreground text-sm">
                    No orders in this session
                  </TableCell>
                </TableRow>
              ) : session.orders.map(order => {
                const badge = ORDER_BADGE[order.state] ?? { variant: 'secondary' as const, label: order.state }
                return (
                  <TableRow
                    key={order.id}
                    className="border-border/20 hover:bg-muted/10 cursor-pointer"
                    onClick={() => navigate(`/admin/pos/orders/${order.id}`)}
                  >
                    <TableCell className="text-sm font-medium text-primary">{order.name}</TableCell>
                    <TableCell className="text-sm">
                      {order.partner_id ? m2oLabel(order.partner_id) : <span className="text-muted-foreground">Guest</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(order.date_order)}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium">{formatCurrency(order.amount_total)}</TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
