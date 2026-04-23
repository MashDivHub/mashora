import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/shared'
import {
  Button, Badge, Skeleton,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input, Label,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'
import {
  Square, DollarSign, Receipt, Clock, StickyNote, ArrowLeft, PlayCircle,
  RotateCcw, Monitor, User, ShoppingCart, Banknote,
} from 'lucide-react'
import { fmtMoney } from './utils'

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

function m2oLabel(value: [number, string] | string | null | undefined): string {
  if (Array.isArray(value)) return value[1] ?? '—'
  return value ?? '—'
}

const STATE_BADGE: Record<string, { label: string; tone: 'emerald' | 'amber' | 'blue' | 'slate' }> = {
  opening_control: { label: 'Opening', tone: 'blue' },
  opened:          { label: 'Open',    tone: 'emerald' },
  closing_control: { label: 'Closing', tone: 'amber' },
  closed:          { label: 'Closed',  tone: 'slate' },
}

const STATE_CLASSES: Record<'emerald' | 'amber' | 'blue' | 'slate', string> = {
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20',
  amber:   'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20',
  blue:    'bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-500/20',
  slate:   'bg-muted/60 text-muted-foreground ring-border/40',
}

type OrderState = 'draft' | 'paid' | 'done' | 'cancel' | 'invoiced'

const ORDER_BADGE: Record<string, { variant: 'secondary' | 'success' | 'default' | 'destructive'; label: string }> = {
  draft:    { variant: 'secondary',   label: 'Draft' },
  paid:     { variant: 'success',     label: 'Paid' },
  done:     { variant: 'default',     label: 'Done' },
  invoiced: { variant: 'default',     label: 'Invoiced' },
  cancel:   { variant: 'destructive', label: 'Cancelled' },
}

interface PosOrderSummary {
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
  config_id: [number, string] | null
  user_id: [number, string] | null
  start_at: string | null
  stop_at: string | null
  opening_notes: string | null
  closing_notes: string | null
  cash_register_balance_start: number | null
  cash_register_balance_end_real: number | null
  cash_register_balance_end: number | null
  order_count: number
  total_amount: number
  orders?: PosOrderSummary[]
}

interface StatTileProps {
  label: string
  value: string | number
  icon: React.ReactNode
  tone: 'emerald' | 'blue' | 'amber' | 'slate'
}

const TONE_MAP: Record<StatTileProps['tone'], { bg: string; text: string; ring: string }> = {
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', ring: 'ring-emerald-500/20' },
  blue:    { bg: 'bg-blue-500/10',    text: 'text-blue-500',    ring: 'ring-blue-500/20' },
  amber:   { bg: 'bg-amber-500/10',   text: 'text-amber-500',   ring: 'ring-amber-500/20' },
  slate:   { bg: 'bg-muted/60',       text: 'text-muted-foreground', ring: 'ring-border/40' },
}

function StatTile({ label, value, icon, tone }: StatTileProps) {
  const t = TONE_MAP[tone]
  return (
    <div className="rounded-2xl border border-border/40 bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">{value}</p>
        </div>
        <div className={`rounded-xl p-2.5 shrink-0 ring-1 ${t.bg} ${t.text} ${t.ring}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card p-6 space-y-4 transition-all duration-200 hover:shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
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

function computeDuration(start: string | null, end: string | null): string {
  if (!start) return '—'
  const s = new Date(start).getTime()
  const e = end ? new Date(end).getTime() : Date.now()
  const mins = Math.max(0, Math.floor((e - s) / 60000))
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h < 24) return `${h}h ${m}m`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

export default function PosSessionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const sessionId = id ? parseInt(id, 10) : null

  const [closeDialog, setCloseDialog] = useState(false)
  const [closingCash, setClosingCash] = useState<string>('0')
  const [closingNotes, setClosingNotes] = useState<string>('')

  const { data: session, isLoading } = useQuery<PosSession>({
    queryKey: ['pos-session', sessionId],
    queryFn: async () => {
      const { data } = await erpClient.raw.get(`/pos/sessions/${sessionId}`)
      return data
    },
    enabled: !!sessionId,
  })

  const { data: orderListData } = useQuery<{ records?: PosOrderSummary[] }>({
    queryKey: ['pos-session-orders', sessionId],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.get(`/pos/orders`, {
          params: { session_id: sessionId, limit: 50 },
        })
        return data
      } catch {
        return { records: undefined }
      }
    },
    enabled: !!sessionId,
    retry: false,
  })

  const closeMut = useMutation({
    mutationFn: async () => {
      const { data } = await erpClient.raw.post(`/pos/sessions/${sessionId}/close`, {
        closing_cash: Number(closingCash) || 0,
        closing_notes: closingNotes,
      })
      return data
    },
    onSuccess: () => {
      toast.success('Session Closed', 'The POS session has been closed.')
      queryClient.invalidateQueries({ queryKey: ['pos-session', sessionId] })
      setCloseDialog(false)
    },
    onError: (e: unknown) => {
      toast.error('Failed to Close', extractErrorMessage(e, 'Unknown error'))
    },
  })

  const openMut = useMutation({
    mutationFn: async () => {
      const { data } = await erpClient.raw.post(`/pos/sessions/${sessionId}/open`, {})
      return data
    },
    onSuccess: () => {
      toast.success('Session Re-Opened', 'The session is open again.')
      queryClient.invalidateQueries({ queryKey: ['pos-session', sessionId] })
    },
    onError: (e: unknown) => {
      toast.error('Failed to Open', extractErrorMessage(e, 'Unknown error'))
    },
  })

  if (isLoading || !session) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    )
  }

  const stateBadge = STATE_BADGE[session.state] ?? { label: session.state, tone: 'slate' as const }
  const stateClasses = STATE_CLASSES[stateBadge.tone]
  const isOpen = session.state !== 'closed'
  const orders: PosOrderSummary[] = orderListData?.records ?? session.orders ?? []
  const duration = computeDuration(session.start_at, session.stop_at)

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-3xl border border-border/40 bg-gradient-to-br from-primary/10 via-background to-emerald-500/5 p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3 min-w-0">
            <button
              onClick={() => navigate('/admin/pos/sessions')}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to sessions
            </button>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold tracking-tight font-mono">{session.name}</h1>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ring-1 ${stateClasses}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${stateBadge.tone === 'emerald' ? 'bg-emerald-500' : stateBadge.tone === 'amber' ? 'bg-amber-500' : stateBadge.tone === 'blue' ? 'bg-blue-500' : 'bg-muted-foreground/50'}`} />
                {stateBadge.label}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                <Monitor className="h-3.5 w-3.5" />
                {m2oLabel(session.config_id)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                {m2oLabel(session.user_id)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {duration}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {session.state === 'closing_control' && (
              <Button
                variant="outline"
                className="rounded-xl gap-1.5"
                onClick={() => openMut.mutate()}
                disabled={openMut.isPending}
              >
                <RotateCcw className="h-4 w-4" />
                Re-Open
              </Button>
            )}
            {session.config_id && isOpen && session.state === 'opened' && (
              <Button
                variant="outline"
                className="rounded-xl gap-1.5"
                onClick={() => navigate(`/admin/pos/terminal/${Array.isArray(session.config_id) ? session.config_id[0] : ''}`)}
              >
                <PlayCircle className="h-4 w-4" />
                Open Terminal
              </Button>
            )}
            {isOpen && (
              <Button
                className="rounded-xl gap-1.5"
                onClick={() => {
                  setClosingCash(String(session.cash_register_balance_end_real ?? 0))
                  setClosingNotes('')
                  setCloseDialog(true)
                }}
              >
                <Square className="h-4 w-4" />
                Close Session
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <StatTile
          label="Orders"
          value={session.order_count ?? 0}
          icon={<ShoppingCart className="h-5 w-5" />}
          tone="blue"
        />
        <StatTile
          label="Total Sales"
          value={fmtMoney(session.total_amount ?? 0)}
          icon={<DollarSign className="h-5 w-5" />}
          tone="emerald"
        />
        <StatTile
          label="Opening Cash"
          value={fmtMoney(session.cash_register_balance_start ?? 0)}
          icon={<Banknote className="h-5 w-5" />}
          tone="slate"
        />
        <StatTile
          label="Closing Cash"
          value={session.state === 'closed'
            ? fmtMoney(session.cash_register_balance_end_real ?? 0)
            : '—'
          }
          icon={<Banknote className="h-5 w-5" />}
          tone={session.state === 'closed' ? 'amber' : 'slate'}
        />
      </div>

      {/* Info cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Session Info" icon={<Clock className="h-4 w-4" />}>
          <div className="space-y-2.5">
            <InfoRow label="Register" value={m2oLabel(session.config_id)} />
            <InfoRow label="User" value={m2oLabel(session.user_id)} />
            <InfoRow label="Start" value={formatDate(session.start_at)} />
            <InfoRow label="End" value={formatDate(session.stop_at)} />
            <InfoRow label="Duration" value={duration} />
          </div>
        </Card>

        <Card title="Notes" icon={<StickyNote className="h-4 w-4" />}>
          <div className="space-y-4">
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Opening</div>
              <div className="text-sm whitespace-pre-wrap">
                {session.opening_notes?.trim() ? session.opening_notes : <span className="text-muted-foreground italic">No notes</span>}
              </div>
            </div>
            <div className="border-t border-border/40 pt-3">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Closing</div>
              <div className="text-sm whitespace-pre-wrap">
                {session.closing_notes?.trim() ? session.closing_notes : <span className="text-muted-foreground italic">No notes</span>}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Orders */}
      <Card title="Session Orders" icon={<Receipt className="h-4 w-4" />}>
        <div className="rounded-xl border border-border/40 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/40 bg-muted/30">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Order</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Customer</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Date</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Total</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground text-sm">
                    No orders in this session yet
                  </TableCell>
                </TableRow>
              ) : orders.map(o => {
                const b = ORDER_BADGE[o.state] ?? { variant: 'secondary' as const, label: o.state }
                return (
                  <TableRow
                    key={o.id}
                    className="border-border/30 hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => navigate(`/admin/pos/orders/${o.id}`)}
                  >
                    <TableCell className="text-sm font-mono font-medium text-primary">{o.name}</TableCell>
                    <TableCell className="text-sm">
                      {o.partner_id
                        ? m2oLabel(o.partner_id)
                        : <span className="text-muted-foreground">Guest</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(o.date_order)}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-medium">{fmtMoney(o.amount_total)}</TableCell>
                    <TableCell><Badge variant={b.variant}>{b.label}</Badge></TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={closeDialog} onOpenChange={v => !closeMut.isPending && setCloseDialog(v)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Close POS Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-border/40 p-4 bg-muted/20 text-sm space-y-2">
              <InfoRow label="Orders" value={session.order_count ?? 0} valueClass="tabular-nums" />
              <InfoRow label="Total Sales" value={fmtMoney(session.total_amount ?? 0)} valueClass="tabular-nums" />
              <InfoRow label="Opening Cash" value={fmtMoney(session.cash_register_balance_start ?? 0)} valueClass="tabular-nums" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="closing-cash">Closing Cash</Label>
              <Input
                id="closing-cash"
                type="number"
                step="0.01"
                value={closingCash}
                onChange={e => setClosingCash(e.target.value)}
                className="rounded-xl tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="closing-notes">Closing Notes</Label>
              <Input
                id="closing-notes"
                value={closingNotes}
                onChange={e => setClosingNotes(e.target.value)}
                placeholder="Optional notes"
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setCloseDialog(false)} disabled={closeMut.isPending} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={() => closeMut.mutate()} disabled={closeMut.isPending} className="rounded-xl gap-1.5">
              <DollarSign className="h-4 w-4" />
              {closeMut.isPending ? 'Closing...' : 'Confirm Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
