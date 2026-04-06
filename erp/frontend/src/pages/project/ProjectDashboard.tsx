import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import { FolderKanban, CheckSquare, Clock, Users } from 'lucide-react'
import { PageHeader, StatCards, type StatCardData } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

export default function ProjectDashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['project-dashboard'],
    queryFn: async () => {
      const [projects, tasks, myTasks] = await Promise.all([
        erpClient.raw.post('/model/project.project', { domain: [['active', '=', true]], fields: ['id'], limit: 1 }).then(r => r.data),
        erpClient.raw.post('/model/project.task', { domain: [['state', 'not in', ['1_done', '1_canceled']]], fields: ['id'], limit: 1 }).then(r => r.data).catch(() => ({ total: 0 })),
        erpClient.raw.post('/model/project.task', { domain: [['user_ids', '!=', false], ['state', 'not in', ['1_done', '1_canceled']]], fields: ['id'], limit: 1 }).then(r => r.data).catch(() => ({ total: 0 })),
      ])
      return { projects: projects.total || 0, tasks: tasks.total || 0, myTasks: myTasks.total || 0 }
    },
    staleTime: 60_000,
  })

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-48 rounded-xl" /><div className="grid grid-cols-2 md:grid-cols-3 gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div></div>
  }

  const stats: StatCardData[] = [
    { label: 'Projects', value: data?.projects || 0, sub: 'active', icon: <FolderKanban className="h-5 w-5" />, color: 'info', onClick: () => navigate('/projects/list') },
    { label: 'Open Tasks', value: data?.tasks || 0, sub: 'in progress', icon: <CheckSquare className="h-5 w-5" />, color: 'success', onClick: () => navigate('/projects/tasks') },
    { label: 'My Tasks', value: data?.myTasks || 0, sub: 'assigned to me', icon: <Users className="h-5 w-5" />, color: 'warning', onClick: () => navigate('/projects/tasks?filter=my') },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Project" subtitle="overview" />
      <StatCards stats={stats} columns={3} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { label: 'All Projects', desc: 'Browse and manage projects', icon: <FolderKanban className="h-5 w-5" />, path: '/projects/list' },
          { label: 'All Tasks', desc: 'View all tasks across projects', icon: <CheckSquare className="h-5 w-5" />, path: '/projects/tasks' },
          { label: 'My Tasks', desc: 'Tasks assigned to me', icon: <Clock className="h-5 w-5" />, path: '/projects/tasks?filter=my' },
        ].map(item => (
          <button key={item.path} onClick={() => navigate(item.path)}
            className="rounded-2xl border border-border/50 bg-card p-5 text-left transition-all hover:bg-muted/20 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">{item.icon}</div>
              <div><p className="text-sm font-semibold">{item.label}</p><p className="text-xs text-muted-foreground">{item.desc}</p></div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
