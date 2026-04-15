import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import {
  Target, Trophy, DollarSign, CalendarCheck,
  Layers, XCircle, Users,
} from 'lucide-react'
import { PageHeader, StatCards, type StatCardData } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

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

export default function CrmDashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['crm-dashboard'],
    queryFn: async () => {
      const res = await erpClient.raw.get('/crm/dashboard').then(r => r.data).catch(() => null)
      if (res) return res

      // Fallback: derive from models
      const [pipeline, won, activities] = await Promise.all([
        erpClient.raw.post('/model/crm.lead', {
          domain: [['type', '=', 'opportunity'], ['active', '=', true]],
          fields: ['id', 'expected_revenue'],
          limit: 1,
        }).then(r => r.data).catch(() => ({ total: 0 })),
        erpClient.raw.post('/model/crm.lead', {
          domain: [['type', '=', 'opportunity'], ['won_status', '=', 'won']],
          fields: ['id', 'expected_revenue'],
          limit: 1,
        }).then(r => r.data).catch(() => ({ total: 0 })),
        erpClient.raw.post('/model/mail.activity', {
          domain: [['res_model', '=', 'crm.lead']],
          fields: ['id'],
          limit: 1,
        }).then(r => r.data).catch(() => ({ total: 0 })),
      ])

      let total_expected = 0
      let won_revenue = 0
      try {
        const { data: rg } = await erpClient.raw.post('/model/crm.lead/read_group', {
          domain: [['type', '=', 'opportunity'], ['active', '=', true]],
          fields: ['expected_revenue'],
          groupby: [],
        })
        total_expected = rg.groups?.[0]?.expected_revenue || 0
      } catch {}
      try {
        const { data: rg } = await erpClient.raw.post('/model/crm.lead/read_group', {
          domain: [['type', '=', 'opportunity'], ['won_status', '=', 'won']],
          fields: ['expected_revenue'],
          groupby: [],
        })
        won_revenue = rg.groups?.[0]?.expected_revenue || 0
      } catch {}

      return {
        opportunities: { open: pipeline.total || 0, won_this_month: won.total || 0, lost_this_month: 0, total_expected_revenue: total_expected },
        leads: { new_this_month: 0, unassigned: 0 },
        overdue_activities: activities?.total || 0,
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  const fmtCur = (v: number) =>
    v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${(v || 0).toFixed(0)}`

  // API returns nested: { opportunities: { open, won_this_month, ... }, leads: { ... }, overdue_activities }
  const opps = data?.opportunities ?? {}
  const leads = data?.leads ?? {}
  const overdue = data?.overdue_activities ?? 0

  const stats: StatCardData[] = [
    {
      label: 'Opportunities',
      value: opps.open ?? 0,
      sub: `${leads.new_this_month ?? 0} new leads this month`,
      icon: <Target className="h-5 w-5" />,
      color: 'info',
      onClick: () => navigate('/admin/crm/pipeline'),
    },
    {
      label: 'Won This Month',
      value: opps.won_this_month ?? 0,
      sub: `${opps.lost_this_month ?? 0} lost`,
      icon: <Trophy className="h-5 w-5" />,
      color: 'success',
    },
    {
      label: 'Expected Revenue',
      value: fmtCur(opps.total_expected_revenue ?? 0),
      icon: <DollarSign className="h-5 w-5" />,
      color: 'warning',
      onClick: () => navigate('/admin/crm/pipeline'),
    },
    {
      label: 'Overdue Activities',
      value: overdue,
      sub: overdue > 0 ? 'needs attention' : 'all clear',
      icon: <CalendarCheck className="h-5 w-5" />,
      color: overdue > 0 ? 'danger' : 'default',
      onClick: () => navigate('/admin/crm/activities'),
    },
  ]

  const actions = [
    { label: 'Pipeline', desc: 'Manage opportunities by stage', icon: <KanbanIcon className="h-5 w-5" />, path: '/crm/pipeline' },
    { label: 'All Leads', desc: 'Browse leads & opportunities', icon: <Target className="h-5 w-5" />, path: '/crm/leads' },
    { label: 'Activities', desc: 'Scheduled & overdue tasks', icon: <CalendarCheck className="h-5 w-5" />, path: '/crm/activities' },
    { label: 'Pipeline Stages', desc: 'Configure pipeline stages', icon: <Layers className="h-5 w-5" />, path: '/crm/stages' },
    { label: 'Lost Reasons', desc: 'Analyse deal loss reasons', icon: <XCircle className="h-5 w-5" />, path: '/crm/lost-reasons' },
    { label: 'Contacts', desc: 'Customers & company contacts', icon: <Users className="h-5 w-5" />, path: '/contacts' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="CRM" subtitle="overview" />
      <StatCards stats={stats} columns={4} />

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
