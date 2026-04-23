import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import {
  Monitor, ShoppingCart, Receipt, DollarSign, Settings, PlayCircle,
  ChevronRight, Plus, Activity, CreditCard, Tags, BarChart3,
} from 'lucide-react'
import { erpClient } from '@/lib/erp-api'
import { fmtMoney } from './utils'

interface DashboardData {
  open_sessions: number
  closed_today: number
  orders_today: number
  revenue_today: number
}

interface PosConfig {
  id: number
  name: string
  open_session: number | null
  session_count: number
}

interface PosConfigsResponse {
  records: PosConfig[]
  total: number
}

interface StatTileProps {
  label: string
  value: string | number
  sub: string
  icon: React.ReactNode
  tone: 'emerald' | 'blue' | 'amber' | 'slate'
}

const TONE_CLASSES: Record<StatTileProps['tone'], { bg: string; text: string; ring: string }> = {
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', ring: 'ring-emerald-500/20' },
  blue:    { bg: 'bg-blue-500/10',    text: 'text-blue-500',    ring: 'ring-blue-500/20' },
  amber:   { bg: 'bg-amber-500/10',   text: 'text-amber-500',   ring: 'ring-amber-500/20' },
  slate:   { bg: 'bg-muted/60',       text: 'text-muted-foreground', ring: 'ring-border/40' },
}

function StatTile({ label, value, sub, icon, tone }: StatTileProps) {
  const t = TONE_CLASSES[tone]
  return (
    <div className="rounded-2xl border border-border/40 bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        </div>
        <div className={`rounded-xl p-2.5 ring-1 ${t.bg} ${t.text} ${t.ring} shrink-0`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

export default function PosDashboard() {
  const navigate = useNavigate()

  const { data: dashboard, isLoading: dashLoading } = useQuery<DashboardData>({
    queryKey: ['pos-dashboard'],
    queryFn: () => erpClient.raw.get('/pos/dashboard').then(r => r.data),
    staleTime: 60_000,
  })

  const { data: configs, isLoading: configsLoading } = useQuery<PosConfigsResponse>({
    queryKey: ['pos-configs'],
    queryFn: () => erpClient.raw.get('/pos/configs').then(r => r.data),
    staleTime: 60_000,
  })

  const isLoading = dashLoading || configsLoading

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full rounded-3xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  const records = configs?.records ?? []
  const openCount = dashboard?.open_sessions ?? 0
  const totalRegisters = records.length
  const firstOpen = records.find(r => !!r.open_session)

  const handleHeroCta = () => {
    if (firstOpen) {
      navigate(`/admin/pos/terminal/${firstOpen.id}`)
    } else if (records[0]) {
      navigate(`/admin/pos/terminal/${records[0].id}`)
    } else {
      navigate('/admin/pos/config')
    }
  }

  const quickActions = [
    { label: 'Sessions', desc: 'Browse session history', icon: <Activity className="h-5 w-5" />, path: '/admin/pos/sessions' },
    { label: 'Orders', desc: 'View all POS orders', icon: <ShoppingCart className="h-5 w-5" />, path: '/admin/pos/orders' },
    { label: 'Payment Methods', desc: 'Cash, terminal, etc.', icon: <CreditCard className="h-5 w-5" />, path: '/admin/pos/payment-methods' },
    { label: 'Categories', desc: 'Product groupings', icon: <Tags className="h-5 w-5" />, path: '/admin/pos/categories' },
  ]

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="rounded-3xl border border-border/40 bg-gradient-to-br from-primary/10 via-background to-emerald-500/5 p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-primary/10 p-2 text-primary">
                <Monitor className="h-5 w-5" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Point of Sale
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Point of Sale
            </h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              Run your retail or restaurant business with lightning fast registers, session tracking, and live revenue insights.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 md:items-end">
            <div className="flex items-center gap-2 rounded-full border border-border/40 bg-card/70 px-4 py-2 backdrop-blur">
              <span className="flex h-2 w-2 items-center justify-center">
                <span className={`h-2 w-2 rounded-full ${openCount > 0 ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
              </span>
              <span className="text-xs font-medium text-foreground tabular-nums">
                {totalRegisters} register{totalRegisters !== 1 ? 's' : ''}
              </span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs font-medium text-foreground tabular-nums">
                {openCount} session{openCount !== 1 ? 's' : ''} open
              </span>
            </div>
            <button
              onClick={handleHeroCta}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:bg-primary/90"
            >
              <PlayCircle className="h-4 w-4" />
              {firstOpen ? 'Open Terminal' : records.length > 0 ? 'Open Register' : 'Set up Register'}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatTile
          label="Open Sessions"
          value={openCount}
          sub="currently active"
          icon={<Activity className="h-5 w-5" />}
          tone={openCount > 0 ? 'emerald' : 'slate'}
        />
        <StatTile
          label="Closed Today"
          value={dashboard?.closed_today ?? 0}
          sub="sessions closed"
          icon={<Receipt className="h-5 w-5" />}
          tone="slate"
        />
        <StatTile
          label="Orders Today"
          value={dashboard?.orders_today ?? 0}
          sub="transactions"
          icon={<ShoppingCart className="h-5 w-5" />}
          tone="blue"
        />
        <StatTile
          label="Revenue Today"
          value={fmtMoney(dashboard?.revenue_today ?? 0)}
          sub="total sales"
          icon={<DollarSign className="h-5 w-5" />}
          tone="amber"
        />
      </div>

      {/* Registers */}
      {records.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground">Registers</h2>
              <p className="text-xs text-muted-foreground">Launch a terminal or inspect today's activity.</p>
            </div>
            <button
              onClick={() => navigate('/admin/pos/config/new')}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              New Register
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {records.map(config => {
              const isOpen = (config.open_session ?? 0) > 0
              return (
                <div
                  key={config.id}
                  className="rounded-2xl border border-border/40 bg-card p-6 space-y-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`rounded-xl p-2.5 shrink-0 ring-1 ${isOpen ? 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/20' : 'bg-muted/60 text-muted-foreground ring-border/40'}`}>
                        <Monitor className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-bold tracking-tight truncate">{config.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {config.session_count} total session{config.session_count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${isOpen ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted/60 text-muted-foreground'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${isOpen ? 'bg-emerald-500' : 'bg-muted-foreground/50'}`} />
                      {isOpen ? 'Open' : 'Closed'}
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <button
                      onClick={() => navigate(`/admin/pos/terminal/${config.id}`)}
                      className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${isOpen ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                    >
                      <PlayCircle className="h-4 w-4" />
                      {isOpen ? 'Resume Register' : 'Open Register'}
                    </button>
                    <button
                      onClick={() => navigate(isOpen ? `/admin/pos/sessions/${config.open_session}` : `/admin/pos/sessions?config=${config.id}`)}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border/40 bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground transition-all duration-200 hover:bg-muted/60 hover:text-foreground"
                    >
                      {isOpen ? 'Session details' : 'Session history'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-border/40 bg-gradient-to-br from-primary/5 via-background to-emerald-500/5 p-12 text-center space-y-5">
          <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-primary">
            <Monitor className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-bold tracking-tight">No POS registers configured</p>
            <p className="text-sm text-muted-foreground">
              Create a register to start selling at the counter.
            </p>
          </div>
          <button
            onClick={() => navigate('/admin/pos/config/new')}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:bg-primary/90"
          >
            <Settings className="h-4 w-4" />
            Configure First Register
          </button>
        </div>
      )}

      {/* Quick actions */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground">Quick Actions</h2>
          <p className="text-xs text-muted-foreground">Jump straight into the workflow you need.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {quickActions.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="group rounded-2xl border border-border/40 bg-card p-6 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-border"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="rounded-xl bg-primary/10 p-2.5 text-primary shrink-0">
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Optional reports teaser */}
      <button
        onClick={() => navigate('/admin/pos/orders')}
        className="group w-full rounded-2xl border border-border/40 bg-card p-6 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-500">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Sales Reports</p>
              <p className="text-xs text-muted-foreground">Drill into totals by session, register, and time.</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/60 transition-transform duration-200 group-hover:translate-x-0.5" />
        </div>
      </button>
    </div>
  )
}
