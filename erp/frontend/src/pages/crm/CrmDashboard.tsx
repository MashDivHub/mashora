import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import { Target, DollarSign, Trophy, Clock, TrendingUp, Users } from 'lucide-react'
import { PageHeader, StatCards, type StatCardData } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

export default function CrmDashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['crm-dashboard'],
    queryFn: async () => {
      // Fetch pipeline stats in parallel
      const [pipeline, won, activities] = await Promise.all([
        erpClient.raw.post('/model/crm.lead', {
          domain: [['type', '=', 'opportunity'], ['active', '=', true]],
          fields: ['id', 'expected_revenue', 'stage_id'],
          limit: 1,
        }).then(r => r.data),
        erpClient.raw.post('/model/crm.lead', {
          domain: [['type', '=', 'opportunity'], ['won_status', '=', 'won']],
          fields: ['id', 'expected_revenue'],
          limit: 1,
        }).then(r => r.data),
        erpClient.raw.post('/model/mail.activity', {
          domain: [['res_model', '=', 'crm.lead']],
          fields: ['id'],
          limit: 1,
        }).then(r => r.data).catch(() => ({ total: 0 })),
      ])

      // Get revenue from read_group
      let totalRevenue = 0
      let wonRevenue = 0
      try {
        const { data: rg } = await erpClient.raw.post('/model/crm.lead/read_group', {
          domain: [['type', '=', 'opportunity'], ['active', '=', true]],
          fields: ['expected_revenue'],
          groupby: [],
        })
        totalRevenue = rg.groups?.[0]?.expected_revenue || 0
      } catch {}
      try {
        const { data: rg } = await erpClient.raw.post('/model/crm.lead/read_group', {
          domain: [['type', '=', 'opportunity'], ['won_status', '=', 'won']],
          fields: ['expected_revenue'],
          groupby: [],
        })
        wonRevenue = rg.groups?.[0]?.expected_revenue || 0
      } catch {}

      return {
        pipelineCount: pipeline.total || 0,
        pipelineRevenue: totalRevenue,
        wonCount: won.total || 0,
        wonRevenue,
        activityCount: activities.total || 0,
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
      </div>
    )
  }

  const fmtCur = (v: number) => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v/1e3).toFixed(0)}K` : `$${v.toFixed(0)}`

  const stats: StatCardData[] = [
    {
      label: 'Pipeline', value: data?.pipelineCount || 0,
      sub: fmtCur(data?.pipelineRevenue || 0) + ' expected',
      icon: <Target className="h-5 w-5" />, color: 'info',
      onClick: () => navigate('/crm/pipeline'),
    },
    {
      label: 'Won Deals', value: data?.wonCount || 0,
      sub: fmtCur(data?.wonRevenue || 0) + ' revenue',
      icon: <Trophy className="h-5 w-5" />, color: 'success',
    },
    {
      label: 'Expected Revenue', value: fmtCur(data?.pipelineRevenue || 0),
      icon: <DollarSign className="h-5 w-5" />, color: 'warning',
      onClick: () => navigate('/crm/pipeline'),
    },
    {
      label: 'Activities', value: data?.activityCount || 0,
      sub: 'pending on leads',
      icon: <Clock className="h-5 w-5" />, color: 'default',
      onClick: () => navigate('/activities'),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="CRM" subtitle="overview" />
      <StatCards stats={stats} columns={4} />

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { label: 'Pipeline', desc: 'Manage opportunities by stage', icon: <TrendingUp className="h-5 w-5" />, path: '/crm/pipeline' },
          { label: 'All Leads', desc: 'Browse all leads & opportunities', icon: <Target className="h-5 w-5" />, path: '/crm/leads' },
          { label: 'Customers', desc: 'View customer contacts', icon: <Users className="h-5 w-5" />, path: '/contacts' },
        ].map(item => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="rounded-2xl border border-border/50 bg-card p-5 text-left transition-all hover:bg-muted/20 hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center gap-3 mb-2">
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
  )
}
