import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, Button, Badge, Skeleton, cn } from '@mashora/design-system'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  FileText, Receipt, CreditCard, Landmark, Wallet, BookOpen, BookMarked,
  FileBarChart, Settings, TrendingUp, BarChart3, Scale,
  ArrowDownCircle, ArrowUpCircle, Plus, ChevronRight, MoreHorizontal,
} from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

interface Journal {
  id: number
  name: string
  type: string
  code?: string
  color?: number
  currency_id?: [number, string] | false
  balance?: number
}

const JOURNAL_ICONS: Record<string, typeof FileText> = {
  sale: FileText,
  purchase: Receipt,
  bank: Landmark,
  cash: Wallet,
  general: BookMarked,
}

const JOURNAL_TYPE_LABEL: Record<string, string> = {
  sale: 'Sales',
  purchase: 'Purchase',
  bank: 'Bank',
  cash: 'Cash',
  general: 'Misc.',
}

const JOURNAL_ACCENT: Record<string, string> = {
  sale: 'from-emerald-500/15 to-emerald-500/0 border-emerald-500/30 text-emerald-600',
  purchase: 'from-amber-500/15 to-amber-500/0 border-amber-500/30 text-amber-600',
  bank: 'from-blue-500/15 to-blue-500/0 border-blue-500/30 text-blue-600',
  cash: 'from-violet-500/15 to-violet-500/0 border-violet-500/30 text-violet-600',
  general: 'from-slate-500/15 to-slate-500/0 border-slate-500/30 text-slate-600',
}

function fmtCur(v: number, cur = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency', currency: cur, maximumFractionDigits: 0,
    }).format(v || 0)
  } catch {
    const sign = v < 0 ? '-' : ''
    const a = Math.abs(v || 0)
    return `${sign}$${a >= 1e6 ? `${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${(a / 1e3).toFixed(0)}K` : a.toFixed(0)}`
  }
}

export default function AccountingDashboard() {
  useDocumentTitle('Accounting')
  const navigate = useNavigate()

  // Fetch journals
  const { data: journalsData, isLoading: journalsLoading } = useQuery({
    queryKey: ['accounting-dashboard', 'journals'],
    queryFn: async (): Promise<Journal[]> => {
      try {
        const { data } = await erpClient.raw.post('/model/account.journal', {
          domain: [],
          fields: ['id', 'name', 'type', 'code', 'color', 'currency_id'],
          limit: 50,
        })
        return data?.records || []
      } catch {
        return []
      }
    },
    staleTime: 60_000,
  })

  // Fetch draft counts grouped by journal
  const { data: draftCounts } = useQuery({
    queryKey: ['accounting-dashboard', 'draft-counts'],
    queryFn: async (): Promise<Record<number, number>> => {
      try {
        const { data } = await erpClient.raw.post('/model/account.move/read_group', {
          domain: [['state', '=', 'draft']],
          fields: ['journal_id'],
          groupby: ['journal_id'],
        })
        const map: Record<number, number> = {}
        for (const g of data?.groups || []) {
          const jid = Array.isArray(g.journal_id) ? g.journal_id[0] : g.journal_id
          if (jid) map[jid] = g.journal_id_count || g.__count || 0
        }
        return map
      } catch {
        return {}
      }
    },
    staleTime: 60_000,
  })

  // Fetch monthly revenue data
  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ['accounting-dashboard', 'monthly-revenue'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.post('/model/account.move/read_group', {
          domain: [['move_type', 'in', ['out_invoice', 'out_refund']], ['state', '=', 'posted']],
          fields: ['amount_total_signed:sum', 'invoice_date'],
          groupby: ['invoice_date:month'],
          orderby: 'invoice_date asc',
        })
        const groups = data?.groups || []
        interface RevenueGroup { invoice_date?: unknown; 'invoice_date:month'?: string; amount_total_signed?: number; amount_total?: number }
        return (groups as RevenueGroup[]).slice(-12).map((g) => {
          const label = typeof g.invoice_date === 'string'
            ? g.invoice_date
            : (g['invoice_date:month'] || '—')
          return {
            month: String(label).slice(0, 7),
            amount: g.amount_total_signed || g.amount_total || 0,
          }
        })
      } catch {
        return []
      }
    },
    staleTime: 60_000,
  })

  const journals = journalsData || []
  const grouped: Record<string, Journal[]> = { sale: [], purchase: [], bank: [], cash: [], general: [] }
  for (const j of journals) {
    const t = j.type || 'general'
    if (grouped[t]) grouped[t].push(j)
    else grouped.general.push(j)
  }

  const actions = [
    { label: 'Chart of Accounts', icon: <BookOpen className="h-5 w-5" />, path: '/admin/accounting/accounts' },
    { label: 'Journal Entries', icon: <FileBarChart className="h-5 w-5" />, path: '/admin/accounting/entries' },
    { label: 'Bank Statements', icon: <Landmark className="h-5 w-5" />, path: '/admin/accounting/bank' },
    { label: 'Tax Configuration', icon: <Settings className="h-5 w-5" />, path: '/admin/accounting/taxes' },
    { label: 'Trial Balance', icon: <Scale className="h-5 w-5" />, path: '/admin/accounting/reports/trial-balance' },
    { label: 'Profit & Loss', icon: <TrendingUp className="h-5 w-5" />, path: '/admin/accounting/reports/profit-loss' },
    { label: 'Balance Sheet', icon: <BarChart3 className="h-5 w-5" />, path: '/admin/accounting/reports/balance-sheet' },
    { label: 'Aged Receivable', icon: <ArrowDownCircle className="h-5 w-5" />, path: '/admin/accounting/reports/aged-receivable' },
    { label: 'Aged Payable', icon: <ArrowUpCircle className="h-5 w-5" />, path: '/admin/accounting/reports/aged-payable' },
  ]

  if (journalsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Accounting" subtitle="Today's overview" />

      {Object.entries(grouped).filter(([, list]) => list.length > 0).map(([type, list]) => (
        <section key={type} className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {JOURNAL_TYPE_LABEL[type] || type} Journals
            </p>
            <Badge variant="secondary" className="text-[10px]">{list.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {list.map((j) => (
              <JournalCard
                key={j.id}
                journal={j}
                draftCount={draftCounts?.[j.id] || 0}
                onNavigate={navigate}
              />
            ))}
          </div>
        </section>
      ))}

      {journals.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-12 text-center space-y-4">
          <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-primary">
            <BookMarked className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">No journals configured yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Set up a journal to post invoices, payments, and bank statements.
            </p>
          </div>
          <Button onClick={() => navigate('/admin/accounting/journals')} className="gap-2">
            <Plus className="h-4 w-4" />
            Create your first journal
          </Button>
        </div>
      )}

      {/* Revenue chart */}
      <Card className="rounded-2xl hover:shadow-md transition-shadow">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Revenue (last 12 months)</h3>
            </div>
            <span className="text-xs text-muted-foreground">posted invoices</span>
          </div>
          {revenueLoading ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : (revenueData?.length || 0) === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
              No revenue data —
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                  tickFormatter={(v) => fmtCur(v).replace('$', '')}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                  formatter={(v: unknown) => fmtCur(Number(v) || 0)}
                />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">
          Quick Actions
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {actions.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="rounded-2xl border border-border/50 bg-card p-4 text-left transition-all hover:bg-muted/20 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">{item.icon}</div>
                <p className="text-sm font-semibold">{item.label}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function JournalCard({
  journal, draftCount, onNavigate,
}: {
  journal: Journal
  draftCount: number
  onNavigate: (path: string) => void
}) {
  const type = journal.type || 'general'
  const Icon = JOURNAL_ICONS[type] || BookMarked
  const accent = JOURNAL_ACCENT[type] || JOURNAL_ACCENT.general
  const cur = Array.isArray(journal.currency_id) ? journal.currency_id[1] : 'USD'
  const balance = journal.balance ?? 0

  const draftFilter = `?journal=${journal.id}&state=draft`

  let primaryAction: { label: string; path: string } | null = null
  let secondaryLabel = 'To Validate'
  let secondaryPath = `/admin/accounting/entries${draftFilter}`

  if (type === 'sale') {
    primaryAction = { label: 'New Invoice', path: '/admin/invoicing/invoices/new' }
    secondaryPath = `/admin/invoicing/invoices?journal=${journal.id}&filter=draft`
  } else if (type === 'purchase') {
    primaryAction = { label: 'New Bill', path: '/admin/invoicing/invoices/new?type=in_invoice' }
    secondaryPath = `/admin/invoicing/invoices?journal=${journal.id}&filter=draft&type=bills`
  } else if (type === 'bank' || type === 'cash') {
    primaryAction = { label: 'New Statement', path: `/admin/accounting/bank?journal=${journal.id}` }
    secondaryLabel = 'Reconcile'
    secondaryPath = `/admin/accounting/bank?journal=${journal.id}&action=reconcile`
  } else {
    primaryAction = { label: 'New Entry', path: `/admin/model/account.move/new?journal_id=${journal.id}` }
  }

  return (
    <Card className={cn(
      'rounded-2xl overflow-hidden border bg-gradient-to-br hover:shadow-md transition-shadow',
      accent,
    )}>
      <CardContent className="p-0">
        {/* Header */}
        <div className="p-4 flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0">
            <div className={cn('rounded-xl p-2.5 bg-card/70 backdrop-blur-sm shrink-0')}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <button
                onClick={() => onNavigate(`/admin/accounting/entries?journal=${journal.id}`)}
                className="text-sm font-semibold truncate hover:underline text-foreground text-left block max-w-full"
                title={journal.name}
              >
                {journal.name}
              </button>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-card/60">
                  {JOURNAL_TYPE_LABEL[type] || type}
                </Badge>
                {journal.code && (
                  <span className="text-[10px] text-muted-foreground font-mono">{journal.code}</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigate(`/admin/accounting/entries?journal=${journal.id}`)}
            className="rounded-lg p-1 hover:bg-card/60 text-muted-foreground"
            aria-label="More"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 pb-3 space-y-2">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Balance
            </p>
            <p className="text-xl font-bold tracking-tight tabular-nums text-foreground">
              {fmtCur(balance, cur)}
            </p>
          </div>
          <button
            onClick={() => onNavigate(secondaryPath)}
            className="flex items-center justify-between w-full text-xs rounded-lg px-2 py-1.5 bg-card/60 hover:bg-card transition-colors text-foreground"
          >
            <span className="text-muted-foreground">{secondaryLabel}</span>
            <span className="flex items-center gap-1 font-semibold tabular-nums">
              {draftCount}
              <ChevronRight className="h-3 w-3" />
            </span>
          </button>
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 pt-1">
          {primaryAction && (
            <Button
              size="sm"
              variant="default"
              className="w-full h-8 text-xs"
              onClick={() => onNavigate(primaryAction!.path)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              {primaryAction.label}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
