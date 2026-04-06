import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import { Monitor, ShoppingCart, Receipt, DollarSign, Settings, PlayCircle } from 'lucide-react'
import { PageHeader, StatCards, type StatCardData } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface DashboardData {
  open_sessions: number
  closed_today: number
  orders_today: number
  revenue_today: number
}

interface PosConfig {
  id: number
  name: string
  open_session: number
  session_count: number
}

interface PosConfigsResponse {
  records: PosConfig[]
  total: number
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
        <Skeleton className="h-10 w-48 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  const stats: StatCardData[] = [
    {
      label: 'Open Sessions',
      value: dashboard?.open_sessions ?? 0,
      sub: 'currently active',
      icon: <Monitor className="h-5 w-5" />,
      color: (dashboard?.open_sessions ?? 0) > 0 ? 'success' : 'default',
    },
    {
      label: 'Closed Today',
      value: dashboard?.closed_today ?? 0,
      sub: 'sessions closed',
      icon: <Receipt className="h-5 w-5" />,
      color: 'default',
    },
    {
      label: 'Orders Today',
      value: dashboard?.orders_today ?? 0,
      sub: 'transactions',
      icon: <ShoppingCart className="h-5 w-5" />,
      color: 'info',
    },
    {
      label: "Today's Revenue",
      value: `$${(dashboard?.revenue_today ?? 0).toLocaleString()}`,
      sub: 'total sales',
      icon: <DollarSign className="h-5 w-5" />,
      color: 'warning',
    },
  ]

  const quickActions = [
    { label: 'Sessions', desc: 'View all POS sessions', icon: <Monitor className="h-5 w-5" />, path: '/pos/sessions' },
    { label: 'Orders', desc: 'Browse POS orders', icon: <ShoppingCart className="h-5 w-5" />, path: '/pos/orders' },
    { label: 'Configuration', desc: 'Manage POS settings', icon: <Settings className="h-5 w-5" />, path: '/pos/config' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Point of Sale" subtitle="overview" />

      <StatCards stats={stats} columns={4} />

      {/* POS Terminals */}
      {configs && configs.records.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Terminals
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {configs.records.map(config => {
              const isOpen = config.open_session > 0
              return (
                <div
                  key={config.id}
                  className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="rounded-xl bg-primary/10 p-2.5 text-primary shrink-0">
                        <Monitor className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{config.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {config.session_count} session{config.session_count !== 1 ? 's' : ''} total
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`h-2 w-2 rounded-full ${isOpen ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
                      />
                      <span className="text-xs text-muted-foreground">
                        {isOpen ? 'Open' : 'Closed'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(isOpen ? `/pos/sessions/${config.open_session}` : `/pos/sessions?config=${config.id}`)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-border/50 bg-muted/30 px-4 py-2.5 text-sm font-medium transition-all hover:bg-muted/60 hover:-translate-y-0.5"
                  >
                    <PlayCircle className="h-4 w-4" />
                    {isOpen ? 'View Session' : 'Open Session'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {quickActions.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="rounded-2xl border border-border/30 bg-card/50 p-6 text-left transition-all hover:bg-muted/20 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary shrink-0">
                  {item.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
