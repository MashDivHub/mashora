import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import {
  Target, Trophy, DollarSign, CalendarCheck,
  Layers, XCircle, Users, TrendingUp, Award,
  Activity as ActivityIcon, Filter,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { PageHeader, StatCards, type StatCardData } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

// Inline Kanban icon — lucide-react does not export one
function KanbanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="5" height="14" x="2" y="5" rx="1" />
      <rect width="5" height="10" x="9" y="5" rx="1" />
      <rect width="5" height="6" x="16" y="5" rx="1" />
    </svg>
  )
}

interface RevenuePoint {
  month: string
  revenue: number
}

interface PipelineForecast {
  stage_id: number
  stage_name: string
  revenue: number
}

interface LeaderboardEntry {
  user_id: number
  name: string
  revenue: number
  count: number
}

interface ActivityItem {
  id: number
  summary: string
  date_deadline: string
  res_id: number
  res_name: string | false
  user_id: [number, string] | false
  activity_type_id: [number, string] | false
}

interface DashboardData {
  opps_open: number
  won_this_month: number
  lost_this_month: number
  total_expected_revenue: number
  revenue_trend: RevenuePoint[]
  pipeline_forecast: PipelineForecast[]
  leaderboard: LeaderboardEntry[]
  activities: ActivityItem[]
}

function isoMonthsAgo(months: number) {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  d.setDate(1)
  return d.toISOString().split('T')[0]
}

function startOfMonth() {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().split('T')[0]
}

function startOfQuarter() {
  const d = new Date()
  const q = Math.floor(d.getMonth() / 3)
  d.setMonth(q * 3, 1)
  return d.toISOString().split('T')[0]
}

function fmtCur(v: number) {
  return v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M`
    : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K`
    : `$${(v || 0).toFixed(0)}`
}

function monthLabel(iso: string) {
  // iso may be 'YYYY-MM-01' or 'February 2026' depending on backend; try to parse
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso).slice(0, 7)
  return d.toLocaleString(undefined, { month: 'short', year: '2-digit' })
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join('')
}

type DomainTerm = [string, string, unknown] | string

interface ReadGroupRow {
  [key: string]: unknown
  __count?: number
}

async function loadCount(model: string, domain: DomainTerm[]): Promise<number> {
  try {
    const { data } = await erpClient.raw.post(`/model/${model}`, {
      domain, fields: ['id'], limit: 1,
    })
    return data?.total || 0
  } catch {
    return 0
  }
}

async function loadSum(model: string, domain: DomainTerm[], field: string): Promise<number> {
  try {
    const { data } = await erpClient.raw.post(`/model/${model}/read_group`, {
      domain, fields: [field], groupby: [],
    })
    return Number(data?.groups?.[0]?.[field] || 0)
  } catch {
    return 0
  }
}

async function loadRevenueTrend(): Promise<RevenuePoint[]> {
  const since = isoMonthsAgo(11)
  try {
    const { data } = await erpClient.raw.post('/model/crm.lead/read_group', {
      domain: [
        ['won_status', '=', 'won'],
        ['date_closed', '>=', since],
      ],
      fields: ['expected_revenue'],
      groupby: ['date_closed:month'],
      limit: 24,
    })
    const rows: RevenuePoint[] = ((data?.groups || []) as ReadGroupRow[]).map((g) => ({
      month: monthLabel(String(g['date_closed:month'] ?? g.date_closed ?? '')),
      revenue: Number(g.expected_revenue || 0),
    }))
    return rows
  } catch {
    return []
  }
}

async function loadPipelineForecast(): Promise<PipelineForecast[]> {
  try {
    const { data } = await erpClient.raw.post('/model/crm.lead/read_group', {
      domain: [
        ['type', '=', 'opportunity'],
        ['active', '=', true],
        ['won_status', '=', 'pending'],
      ],
      fields: ['expected_revenue'],
      groupby: ['stage_id'],
      limit: 50,
    })
    const rows: PipelineForecast[] = ((data?.groups || []) as ReadGroupRow[]).map((g) => {
      const sid = Array.isArray(g.stage_id) ? (g.stage_id as [number, string])[0] : (g.stage_id as number | undefined)
      const sname = Array.isArray(g.stage_id) ? (g.stage_id as [number, string])[1] : 'Unassigned'
      return {
        stage_id: sid || 0,
        stage_name: sname,
        revenue: Number(g.expected_revenue || 0),
      }
    })
    return rows.sort((a, b) => b.revenue - a.revenue)
  } catch {
    return []
  }
}

async function loadLeaderboard(): Promise<LeaderboardEntry[]> {
  const since = startOfQuarter()
  try {
    const { data } = await erpClient.raw.post('/model/crm.lead/read_group', {
      domain: [
        ['won_status', '=', 'won'],
        ['date_closed', '>=', since],
      ],
      fields: ['expected_revenue'],
      groupby: ['user_id'],
      limit: 50,
    })
    const rows: LeaderboardEntry[] = ((data?.groups || []) as ReadGroupRow[])
      .filter((g) => g.user_id)
      .map((g) => {
        const uid = Array.isArray(g.user_id) ? (g.user_id as [number, string])[0] : (g.user_id as number)
        const name = Array.isArray(g.user_id) ? (g.user_id as [number, string])[1] : 'Unassigned'
        return {
          user_id: uid,
          name,
          revenue: Number(g.expected_revenue || 0),
          count: Number(g.user_id_count || g.__count || 0),
        }
      })
    return rows.sort((a, b) => b.revenue - a.revenue).slice(0, 8)
  } catch {
    return []
  }
}

async function loadActivities(): Promise<ActivityItem[]> {
  try {
    const { data } = await erpClient.raw.post('/model/mail.activity', {
      domain: [['res_model', '=', 'crm.lead']],
      fields: ['id', 'summary', 'date_deadline', 'res_id', 'res_name', 'user_id', 'activity_type_id'],
      order: 'date_deadline asc',
      limit: 10,
    })
    return data?.records || []
  } catch {
    return []
  }
}

export default function CrmDashboard() {
  useDocumentTitle('CRM Dashboard')
  const navigate = useNavigate()

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['crm-dashboard-v2'],
    queryFn: async () => {
      const monthStart = startOfMonth()
      const [
        oppsOpen,
        wonThisMonth,
        lostThisMonth,
        totalExpected,
        revenueTrend,
        pipelineForecast,
        leaderboard,
        activities,
      ] = await Promise.all([
        loadCount('crm.lead', [
          ['type', '=', 'opportunity'],
          ['active', '=', true],
          ['won_status', '=', 'pending'],
        ]),
        loadCount('crm.lead', [
          ['won_status', '=', 'won'],
          ['date_closed', '>=', monthStart],
        ]),
        loadCount('crm.lead', [
          ['won_status', '=', 'lost'],
          ['date_closed', '>=', monthStart],
        ]),
        loadSum('crm.lead', [
          ['type', '=', 'opportunity'],
          ['active', '=', true],
          ['won_status', '=', 'pending'],
        ], 'expected_revenue'),
        loadRevenueTrend(),
        loadPipelineForecast(),
        loadLeaderboard(),
        loadActivities(),
      ])

      return {
        opps_open: oppsOpen,
        won_this_month: wonThisMonth,
        lost_this_month: lostThisMonth,
        total_expected_revenue: totalExpected,
        revenue_trend: revenueTrend,
        pipeline_forecast: pipelineForecast,
        leaderboard,
        activities,
      }
    },
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  const stats: StatCardData[] = [
    {
      label: 'Open Opportunities',
      value: data?.opps_open ?? 0,
      icon: <Target className="h-5 w-5" />,
      color: 'info',
      onClick: () => navigate('/admin/crm/pipeline'),
    },
    {
      label: 'Won This Month',
      value: data?.won_this_month ?? 0,
      sub: `${data?.lost_this_month ?? 0} lost`,
      icon: <Trophy className="h-5 w-5" />,
      color: 'success',
    },
    {
      label: 'Lost This Month',
      value: data?.lost_this_month ?? 0,
      icon: <XCircle className="h-5 w-5" />,
      color: (data?.lost_this_month ?? 0) > 0 ? 'danger' : 'default',
    },
    {
      label: 'Expected Revenue',
      value: fmtCur(data?.total_expected_revenue ?? 0),
      sub: 'open pipeline',
      icon: <DollarSign className="h-5 w-5" />,
      color: 'warning',
      onClick: () => navigate('/admin/crm/pipeline'),
    },
  ]

  const actions = [
    { label: 'Pipeline', desc: 'Manage opportunities by stage', icon: <KanbanIcon className="h-5 w-5" />, path: '/admin/crm/pipeline' },
    { label: 'All Leads', desc: 'Browse leads & opportunities', icon: <Target className="h-5 w-5" />, path: '/admin/crm/leads' },
    { label: 'Stages', desc: 'Configure pipeline stages', icon: <Layers className="h-5 w-5" />, path: '/admin/crm/stages' },
    { label: 'Lost Reasons', desc: 'Analyse deal loss reasons', icon: <XCircle className="h-5 w-5" />, path: '/admin/crm/lost-reasons' },
    { label: 'Sales Teams', desc: 'Configure sales teams', icon: <Users className="h-5 w-5" />, path: '/admin/sales/teams' },
  ]

  const revenue = data?.revenue_trend ?? []
  const forecast = data?.pipeline_forecast ?? []
  const leaders = data?.leaderboard ?? []
  const activities = data?.activities ?? []
  const maxForecast = forecast.length ? Math.max(...forecast.map(f => f.revenue)) : 0
  const maxLeader = leaders.length ? Math.max(...leaders.map(l => l.revenue)) : 0

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="space-y-6">
      <PageHeader title="CRM" subtitle="overview" onNew="/admin/crm/leads/new" newLabel="New Lead" />
      <StatCards stats={stats} columns={4} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue trend */}
        <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Won Revenue</h3>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              last 12 months
            </span>
          </div>
          {revenue.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No closed-won deals in the last 12 months.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenue} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" tickFormatter={fmtCur} width={50} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                    formatter={(v: unknown) => fmtCur(Number(v))}
                  />
                  <Bar dataKey="revenue" fill="hsl(220, 70%, 55%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Pipeline forecast */}
        <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Pipeline Forecast</h3>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              by stage
            </span>
          </div>
          {forecast.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No active opportunities in the pipeline.
            </div>
          ) : (
            <ul className="space-y-3">
              {forecast.map(f => {
                const pct = maxForecast > 0 ? (f.revenue / maxForecast) * 100 : 0
                return (
                  <li key={f.stage_id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium truncate">{f.stage_name}</span>
                      <span className="tabular-nums text-muted-foreground shrink-0 ml-2">
                        {fmtCur(f.revenue)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/70"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Leaderboard */}
        <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Sales Leaderboard</h3>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              this quarter
            </span>
          </div>

          {leaders.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No closed-won deals this quarter.
            </div>
          ) : (
            <ol className="space-y-2">
              {leaders.map((l, idx) => {
                const pct = maxLeader > 0 ? (l.revenue / maxLeader) * 100 : 0
                const medal = idx === 0 ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : idx === 1 ? 'bg-slate-400/15 text-slate-300 border-slate-400/30'
                  : idx === 2 ? 'bg-orange-500/15 text-orange-400 border-orange-500/30'
                  : 'bg-primary/10 text-primary border-primary/20'
                return (
                  <li key={l.user_id} className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-full border flex items-center justify-center text-xs font-semibold shrink-0 ${medal}`}>
                      {initials(l.name) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">{l.name}</span>
                        <span className="text-sm font-semibold tabular-nums shrink-0">
                          {fmtCur(l.revenue)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex-1 h-1 rounded-full bg-muted/40 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary/60"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                          {l.count} won
                        </span>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>

        {/* Activities */}
        <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ActivityIcon className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Upcoming Activities</h3>
            </div>
            <button
              onClick={() => navigate('/admin/crm/activities')}
              className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-colors"
            >
              view all
            </button>
          </div>

          {activities.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No scheduled activities.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {activities.map(a => {
                const due = a.date_deadline ? new Date(a.date_deadline) : null
                const overdue = due && due < today
                const dueLabel = due
                  ? due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                  : '—'
                const typeLabel = Array.isArray(a.activity_type_id) ? a.activity_type_id[1] : ''
                return (
                  <li key={a.id}>
                    <button
                      onClick={() => navigate(`/admin/crm/leads/${a.res_id}`)}
                      className="w-full text-left rounded-lg p-2 hover:bg-muted/40 transition-colors group flex items-center gap-3"
                    >
                      <div className={`text-xs font-semibold tabular-nums shrink-0 w-12 text-center rounded-md py-1 border ${
                        overdue
                          ? 'border-red-500/30 bg-red-500/10 text-red-400'
                          : 'border-border/40 bg-muted/30 text-muted-foreground'
                      }`}>
                        {dueLabel}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {a.summary || typeLabel || 'Activity'}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {a.res_name || `Lead #${a.res_id}`}
                          {Array.isArray(a.user_id) && ` · ${a.user_id[1]}`}
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">
          Quick Actions
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {actions.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="rounded-2xl border border-border/50 bg-card p-5 text-left transition-all hover:bg-muted/20 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">{item.icon}</div>
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
