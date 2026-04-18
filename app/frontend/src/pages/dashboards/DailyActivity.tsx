import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, Button, Badge, Skeleton, Input, cn } from '@mashora/design-system'
import {
  ArrowDownCircle, ArrowUpCircle, TrendingUp, ShoppingCart, CreditCard,
  FileText, Receipt, Truck, PackageOpen, ChevronRight, Calendar, Activity,
} from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface Summary {
  total: number
  count: number
}

interface DailyActivity {
  range: { start: string; end: string; days: number }
  summary: {
    sales: Summary
    purchases: Summary
    invoices: Summary
    bills: Summary
    deposits: Summary
    withdrawals: Summary
    receipts: { count: number }
    deliveries: { count: number }
    cash_net: number
  }
  timeline: TimelineRow[]
}

interface TimelineRow {
  kind: 'sale' | 'purchase' | 'invoice' | 'bill' | 'deposit' | 'withdrawal' | 'receipt' | 'delivery' | 'transfer'
  at: string | null
  ref: string | null
  amount?: number | null
  partner?: string
  journal?: string
  link: string | null
}

const PRESETS = [
  { key: 'today', label: 'Today', days: 1, offset: 0 },
  { key: 'yesterday', label: 'Yesterday', days: 1, offset: 1 },
  { key: '7d', label: 'Last 7 days', days: 7, offset: 0 },
  { key: '30d', label: 'Last 30 days', days: 30, offset: 0 },
]

const KIND_META: Record<TimelineRow['kind'], { label: string; icon: typeof TrendingUp; accent: string }> = {
  sale:       { label: 'Sale',       icon: ShoppingCart, accent: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' },
  purchase:   { label: 'Purchase',   icon: CreditCard,   accent: 'text-amber-600 dark:text-amber-400 bg-amber-500/10' },
  invoice:    { label: 'Invoice',    icon: FileText,     accent: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' },
  bill:       { label: 'Bill',       icon: Receipt,      accent: 'text-amber-600 dark:text-amber-400 bg-amber-500/10' },
  deposit:    { label: 'Deposit',    icon: ArrowDownCircle, accent: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' },
  withdrawal: { label: 'Withdrawal', icon: ArrowUpCircle,   accent: 'text-rose-600 dark:text-rose-400 bg-rose-500/10' },
  receipt:    { label: 'Receipt',    icon: PackageOpen,  accent: 'text-blue-600 dark:text-blue-400 bg-blue-500/10' },
  delivery:   { label: 'Delivery',   icon: Truck,        accent: 'text-violet-600 dark:text-violet-400 bg-violet-500/10' },
  transfer:   { label: 'Transfer',   icon: Truck,        accent: 'text-slate-600 dark:text-slate-400 bg-slate-500/10' },
}

function fmtMoney(v: number | null | undefined): string {
  const n = Number(v || 0)
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function fmtTime(at: string | null): string {
  if (!at) return '—'
  try {
    const d = new Date(at)
    if (isNaN(d.getTime())) return at.slice(0, 16)
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return at.slice(0, 16)
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export default function DailyActivity() {
  const navigate = useNavigate()
  const [preset, setPreset] = useState('today')
  const [customDay, setCustomDay] = useState<string>(today())
  const [customDays, setCustomDays] = useState<number>(1)

  // Resolve current (day, days)
  const { day, days } = useMemo(() => {
    if (preset === 'custom') return { day: customDay, days: customDays }
    const p = PRESETS.find(p => p.key === preset)!
    return { day: p.offset ? daysAgo(p.offset) : today(), days: p.days }
  }, [preset, customDay, customDays])

  const { data, isLoading, refetch, isFetching } = useQuery<DailyActivity>({
    queryKey: ['daily-activity', day, days],
    queryFn: async () => (await erpClient.raw.get(`/daily-activity?day=${day}&days=${days}`)).data,
  })

  const summary = data?.summary
  const timeline = data?.timeline || []

  const kpiCards = summary ? [
    { title: 'Sales', value: fmtMoney(summary.sales.total), sub: `${summary.sales.count} order(s)`, icon: ShoppingCart, tone: 'emerald' },
    { title: 'Purchases', value: fmtMoney(summary.purchases.total), sub: `${summary.purchases.count} order(s)`, icon: CreditCard, tone: 'amber' },
    { title: 'Invoices', value: fmtMoney(summary.invoices.total), sub: `${summary.invoices.count} posted`, icon: FileText, tone: 'emerald' },
    { title: 'Bills', value: fmtMoney(summary.bills.total), sub: `${summary.bills.count} posted`, icon: Receipt, tone: 'amber' },
    { title: 'Deposits', value: fmtMoney(summary.deposits.total), sub: `${summary.deposits.count} payment(s)`, icon: ArrowDownCircle, tone: 'emerald' },
    { title: 'Withdrawals', value: fmtMoney(summary.withdrawals.total), sub: `${summary.withdrawals.count} payment(s)`, icon: ArrowUpCircle, tone: 'rose' },
    { title: 'Receipts', value: String(summary.receipts.count), sub: 'incoming transfers', icon: PackageOpen, tone: 'blue' },
    { title: 'Deliveries', value: String(summary.deliveries.count), sub: 'outgoing transfers', icon: Truck, tone: 'violet' },
  ] : []

  const toneClass: Record<string, string> = {
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber:   'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
    rose:    'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20',
    blue:    'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20',
    violet:  'text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/20',
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Daily Activity" subtitle="operations" />

      {/* Date picker / presets */}
      <div className="flex items-center gap-2 flex-wrap">
        {PRESETS.map(p => (
          <Button key={p.key} type="button"
            variant={preset === p.key ? 'default' : 'outline'}
            size="sm" className="rounded-xl"
            onClick={() => setPreset(p.key)}>
            {p.label}
          </Button>
        ))}
        <Button type="button"
          variant={preset === 'custom' ? 'default' : 'outline'}
          size="sm" className="rounded-xl gap-1.5"
          onClick={() => setPreset('custom')}>
          <Calendar className="h-3.5 w-3.5" /> Custom
        </Button>
        {preset === 'custom' && (
          <>
            <Input type="date" value={customDay} onChange={e => setCustomDay(e.target.value)}
              className="h-9 max-w-[170px] text-sm" />
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>range:</span>
              <Input type="number" min="1" max="365" value={customDays}
                onChange={e => setCustomDays(parseInt(e.target.value) || 1)}
                className="h-9 w-20 text-sm text-right font-mono" />
              <span>day(s)</span>
            </div>
          </>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {data ? (data.range.days === 1 ? data.range.end : `${data.range.start} → ${data.range.end}`) : ''}
        </span>
        <Button type="button" variant="ghost" size="sm" className="rounded-xl"
          onClick={() => refetch()} disabled={isFetching}>
          <Activity className={cn('h-3.5 w-3.5 mr-1.5', isFetching && 'animate-pulse')} />
          Refresh
        </Button>
      </div>

      {/* Cash net card (wide) */}
      {summary && (
        <Card className="rounded-2xl border-border/60">
          <CardContent className="p-5 flex items-center gap-4">
            <div className={cn('rounded-2xl p-3', summary.cash_net >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600')}>
              <TrendingUp className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Net Cash Flow</div>
              <div className={cn('text-2xl font-bold tabular-nums', summary.cash_net >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                {summary.cash_net >= 0 ? '+' : ''}{fmtMoney(summary.cash_net)}
              </div>
              <div className="text-xs text-muted-foreground">
                Deposits {fmtMoney(summary.deposits.total)} − Withdrawals {fmtMoney(summary.withdrawals.total)}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpiCards.map(k => (
            <Card key={k.title} className={cn('rounded-2xl border', toneClass[k.tone])}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wider opacity-80">{k.title}</div>
                  <k.icon className="h-4 w-4 opacity-60" />
                </div>
                <div className="text-xl font-bold mt-1 tabular-nums truncate">{k.value}</div>
                <div className="text-[11px] opacity-70">{k.sub}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Timeline */}
      <Card className="rounded-2xl">
        <CardContent className="p-0">
          <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Activity Timeline</h2>
            <Badge variant="outline" className="text-xs">{timeline.length} event(s)</Badge>
          </div>
          {isLoading ? (
            <div className="p-5 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
            </div>
          ) : timeline.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
              No activity for this period.
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {timeline.map((t, i) => {
                const meta = KIND_META[t.kind]
                const Icon = meta.icon
                const clickable = !!t.link
                return (
                  <li key={`${t.kind}-${t.ref}-${i}`}
                    className={cn('flex items-center gap-3 px-5 py-2.5', clickable && 'cursor-pointer hover:bg-muted/30 transition-colors')}
                    onClick={() => clickable && t.link && navigate(t.link)}>
                    <div className={cn('rounded-lg p-1.5 shrink-0', meta.accent)}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0 grid grid-cols-[90px_1fr_auto] gap-3 items-center">
                      <Badge variant="outline" className="text-[10px] justify-self-start">{meta.label}</Badge>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {t.ref || '—'}
                          {t.partner && <span className="text-muted-foreground font-normal"> · {t.partner}</span>}
                          {t.journal && <span className="text-muted-foreground font-normal"> · {t.journal}</span>}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{fmtTime(t.at)}</div>
                      </div>
                      <div className="text-right">
                        {t.amount != null && (
                          <span className={cn('font-mono text-sm font-medium tabular-nums',
                            t.kind === 'withdrawal' && 'text-rose-600')}>
                            {t.kind === 'withdrawal' ? '−' : ''}{fmtMoney(t.amount)}
                          </span>
                        )}
                      </div>
                    </div>
                    {clickable && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
