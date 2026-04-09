import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import {
  FolderKanban, CheckSquare, ClipboardList, Layers,
  Clock, BarChart3, DollarSign, Flag, MessageSquare,
} from 'lucide-react'
import { PageHeader, StatCards, type StatCardData } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

export default function ProjectDashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['project-dashboard'],
    queryFn: () =>
      erpClient.raw.get('/projects/dashboard/metrics').then(r => r.data),
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  const overdue = data?.tasks?.overdue ?? 0

  const stats: StatCardData[] = [
    {
      label: 'Active Projects',
      value: data?.projects?.active ?? 0,
      sub: 'projects',
      icon: <FolderKanban className="h-5 w-5" />,
      color: 'info',
      onClick: () => navigate('/projects/list'),
    },
    {
      label: 'Open Tasks',
      value: data?.tasks?.open ?? 0,
      sub: 'in progress',
      icon: <ClipboardList className="h-5 w-5" />,
      color: 'success',
      onClick: () => navigate('/projects/tasks'),
    },
    {
      label: 'My Tasks',
      value: data?.tasks?.my_tasks ?? 0,
      sub: 'assigned to me',
      icon: <CheckSquare className="h-5 w-5" />,
      color: 'warning',
      onClick: () => navigate('/projects/todos'),
    },
    {
      label: 'Overdue',
      value: overdue,
      sub: 'past due date',
      icon: <Flag className="h-5 w-5" />,
      color: overdue > 0 ? 'danger' : 'default',
      onClick: () => navigate('/projects/tasks?filter=overdue'),
    },
  ]

  const groups = [
    {
      title: 'Projects',
      items: [
        { label: 'All Projects', desc: 'Browse and manage projects', icon: <FolderKanban className="h-5 w-5" />, path: '/projects/list' },
        { label: 'My To-Do', desc: 'Your personal to-do list', icon: <CheckSquare className="h-5 w-5" />, path: '/projects/todos' },
      ],
    },
    {
      title: 'Tasks',
      items: [
        { label: 'All Tasks', desc: 'View all tasks across projects', icon: <ClipboardList className="h-5 w-5" />, path: '/projects/tasks' },
        { label: 'Task Stages', desc: 'Manage task stage pipeline', icon: <Layers className="h-5 w-5" />, path: '/projects/stages' },
      ],
    },
    {
      title: 'Time & Billing',
      items: [
        { label: 'Timesheets', desc: 'Log and review time entries', icon: <Clock className="h-5 w-5" />, path: '/projects/timesheets' },
        { label: 'Timesheet Summary', desc: 'Aggregated time reports', icon: <BarChart3 className="h-5 w-5" />, path: '/projects/timesheets/summary' },
        { label: 'Project Billing', desc: 'Invoicing and billing records', icon: <DollarSign className="h-5 w-5" />, path: '/projects/billing' },
      ],
    },
    {
      title: 'Tracking',
      items: [
        { label: 'Milestones', desc: 'Track project milestones', icon: <Flag className="h-5 w-5" />, path: '/projects/milestones' },
        { label: 'Project Updates', desc: 'Status updates and notes', icon: <MessageSquare className="h-5 w-5" />, path: '/projects/updates' },
      ],
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Projects" subtitle="overview" />
      <StatCards stats={stats} columns={4} />
      <div className="space-y-4">
        {groups.map(group => (
          <div key={group.title}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.title}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {group.items.map(item => (
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
        ))}
      </div>
    </div>
  )
}
