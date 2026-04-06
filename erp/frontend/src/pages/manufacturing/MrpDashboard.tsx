import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { PageHeader, StatCards } from '@/components/shared'
import { Skeleton } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { Factory, ClipboardList, Layers, Wrench, AlertTriangle, CheckCircle, PlayCircle } from 'lucide-react'

interface DashboardData {
  draft: number
  confirmed: number
  in_progress: number
  done: number
  late: number
  bom_count: number
  workcenter_count: number
}

export default function MrpDashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['manufacturing', 'dashboard'],
    queryFn: () => erpClient.get('/manufacturing/dashboard').then((r) => r.data),
  })

  const statCards = isLoading
    ? null
    : [
        {
          label: 'Draft Orders',
          value: data?.draft ?? 0,
          icon: <ClipboardList className="h-4 w-4" />,
          color: 'default' as const,
        },
        {
          label: 'Confirmed',
          value: data?.confirmed ?? 0,
          icon: <CheckCircle className="h-4 w-4" />,
          color: 'info' as const,
        },
        {
          label: 'In Progress',
          value: data?.in_progress ?? 0,
          icon: <PlayCircle className="h-4 w-4" />,
          color: 'success' as const,
        },
        {
          label: 'Late',
          value: data?.late ?? 0,
          icon: <AlertTriangle className="h-4 w-4" />,
          color: ((data?.late ?? 0) > 0 ? 'danger' : 'default') as 'danger' | 'default',
        },
      ]

  const quickActions = [
    {
      label: 'Production Orders',
      description: 'Manage manufacturing orders',
      icon: <Factory className="h-5 w-5" />,
      route: '/manufacturing/orders',
    },
    {
      label: 'Bills of Materials',
      description: 'Configure product structures',
      icon: <Layers className="h-5 w-5" />,
      route: '/manufacturing/bom',
    },
    {
      label: 'Work Centers',
      description: 'Manage production resources',
      icon: <Wrench className="h-5 w-5" />,
      route: '/manufacturing/workcenters',
    },
    {
      label: 'Work Orders',
      description: 'Track operations and tasks',
      icon: <ClipboardList className="h-5 w-5" />,
      route: '/manufacturing/workorders',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Manufacturing" subtitle="overview" />

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <StatCards stats={statCards!} columns={4} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {quickActions.map((action) => (
          <button
            key={action.route}
            onClick={() => navigate(action.route)}
            className="rounded-2xl border border-border/50 bg-card p-5 text-left transition-all hover:bg-muted/20 hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary shrink-0">
                {action.icon}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm">{action.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border/50 bg-card p-5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Bills of Materials
          </p>
          {isLoading ? (
            <Skeleton className="h-8 w-16 mt-1 rounded-lg" />
          ) : (
            <p className="text-2xl font-bold tracking-tight mt-1 tabular-nums">{data?.bom_count ?? 0}</p>
          )}
        </div>
        <div className="rounded-2xl border border-border/50 bg-card p-5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Work Centers
          </p>
          {isLoading ? (
            <Skeleton className="h-8 w-16 mt-1 rounded-lg" />
          ) : (
            <p className="text-2xl font-bold tracking-tight mt-1 tabular-nums">{data?.workcenter_count ?? 0}</p>
          )}
        </div>
      </div>
    </div>
  )
}
