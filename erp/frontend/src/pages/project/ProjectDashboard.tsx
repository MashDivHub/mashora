import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  PageHeader, Button, Skeleton, Badge, Separator, cn,
} from '@mashora/design-system'
import {
  FolderKanban, ListTodo, AlertTriangle, User, ArrowRight,
  CheckCircle2, Clock, TrendingUp, Plus, Zap,
} from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ElementType
  description: string
  accent?: 'default' | 'success' | 'warning' | 'destructive'
  loading?: boolean
}

function StatCard({ title, value, icon: Icon, description, accent = 'default', loading }: StatCardProps) {
  const iconAccent: Record<string, string> = {
    default:
      'group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:border-zinc-700 dark:group-hover:bg-zinc-800 dark:group-hover:text-zinc-50',
    success:
      'group-hover:bg-emerald-950 group-hover:text-emerald-300 dark:group-hover:bg-emerald-950 dark:group-hover:border-emerald-800 dark:group-hover:text-emerald-300',
    warning:
      'group-hover:bg-amber-950 group-hover:text-amber-300 dark:group-hover:bg-amber-950 dark:group-hover:border-amber-800 dark:group-hover:text-amber-300',
    destructive:
      'group-hover:bg-red-950 group-hover:text-red-300 dark:group-hover:bg-red-950 dark:group-hover:border-red-800 dark:group-hover:text-red-300',
  }

  return (
    <div className="group overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_80px_-40px_rgba(15,23,42,0.55)]">
      <div className="p-6">
        <div className="mb-5 flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              {title}
            </p>
            {loading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <div className="text-3xl font-semibold tracking-tight">{value}</div>
            )}
          </div>
          <div
            className={cn(
              'rounded-2xl border border-border/70 bg-muted/60 p-3 text-muted-foreground transition-all duration-200',
              iconAccent[accent],
            )}
          >
            <Icon className="size-5" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

// ─── Status row ───────────────────────────────────────────────────────────────

const statusRows = [
  { key: 'on_track', label: 'On Track', badge: 'success' as const },
  { key: 'at_risk', label: 'At Risk', badge: 'warning' as const },
  { key: 'off_track', label: 'Off Track', badge: 'destructive' as const },
  { key: 'on_hold', label: 'On Hold', badge: 'info' as const },
  { key: 'done', label: 'Done', badge: 'secondary' as const },
]

// ─── Quick actions ─────────────────────────────────────────────────────────────

const quickActions = [
  {
    route: '/projects/new',
    label: 'New Project',
    description: 'Create a new project and set up stages, team, and milestones.',
    icon: FolderKanban,
  },
  {
    route: '/projects/list',
    label: 'All Projects',
    description: 'Browse every project across the organization with status filters.',
    icon: TrendingUp,
  },
  {
    route: '/projects/tasks?mine=true',
    label: 'My Tasks',
    description: 'View all tasks currently assigned to you across every project.',
    icon: Zap,
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectDashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['project-dashboard'],
    queryFn: () => erpClient.raw.get('/projects/dashboard/metrics').then((r) => r.data),
  })

  const projects = data?.projects ?? {}
  const tasks = data?.tasks ?? {}
  const statusCounts = projects.status ?? {}

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Overview
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">Project and task management</p>
        </div>
        <Button className="rounded-2xl" onClick={() => navigate('/projects/new')}>
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Projects"
          value={projects.active ?? 0}
          icon={FolderKanban}
          description="Currently in progress"
          loading={isLoading}
        />
        <StatCard
          title="Open Tasks"
          value={tasks.open ?? 0}
          icon={ListTodo}
          description="Across all projects"
          loading={isLoading}
        />
        <StatCard
          title="Overdue Tasks"
          value={tasks.overdue ?? 0}
          icon={AlertTriangle}
          description="Past deadline"
          accent="destructive"
          loading={isLoading}
        />
        <StatCard
          title="My Tasks"
          value={tasks.my_tasks ?? 0}
          icon={User}
          description="Assigned to you"
          loading={isLoading}
        />
      </div>

      {/* Summary + quick actions */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Project status summary */}
        <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
          <div className="border-b border-border/70 bg-muted/20 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              Project Status
            </p>
          </div>
          <div className="p-6 space-y-0">
            {statusRows.map(({ key, label, badge }, idx) => (
              <div
                key={key}
                className={cn(
                  'flex items-center justify-between py-3.5 text-sm',
                  idx < statusRows.length - 1 && 'border-b border-border/50',
                )}
              >
                <span className="text-muted-foreground">{label}</span>
                {isLoading ? (
                  <Skeleton className="h-5 w-8" />
                ) : (
                  <Badge variant={badge} className="tabular-nums">
                    {statusCounts[key] ?? 0}
                  </Badge>
                )}
              </div>
            ))}
            <div className="pt-4">
              <button
                onClick={() => navigate('/projects/list')}
                className="group flex w-full items-center justify-between rounded-2xl border border-border/70 bg-muted/40 px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 hover:bg-muted/70 hover:shadow-md"
              >
                View All Projects
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </div>

        {/* Task breakdown */}
        <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
          <div className="border-b border-border/70 bg-muted/20 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              Task Overview
            </p>
          </div>
          <div className="p-6 space-y-0">
            {[
              { label: 'Open', key: 'open', color: '' },
              { label: 'In Progress', key: 'in_progress', color: '' },
              { label: 'Closed This Month', key: 'closed_this_month', color: 'text-emerald-500' },
              { label: 'Overdue', key: 'overdue', color: 'text-red-500' },
              { label: 'My Tasks', key: 'my_tasks', color: '' },
            ].map(({ label, key, color }, idx, arr) => (
              <div
                key={key}
                className={cn(
                  'flex items-center justify-between py-3.5 text-sm',
                  idx < arr.length - 1 && 'border-b border-border/50',
                )}
              >
                <span className="text-muted-foreground">{label}</span>
                {isLoading ? (
                  <Skeleton className="h-5 w-8" />
                ) : (
                  <span className={cn('font-semibold tabular-nums', color)}>
                    {tasks[key] ?? 0}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick action cards */}
      <div>
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
          Quick Actions
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {quickActions.map(({ route, label, description, icon: Icon }) => (
            <button
              key={route}
              onClick={() => navigate(route)}
              className="group rounded-3xl border border-border/70 bg-card/85 p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-zinc-900/20 hover:shadow-xl dark:hover:border-zinc-100/20"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-2xl border border-border/70 bg-muted/60 p-3 text-zinc-900 dark:text-zinc-100 transition-colors group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:bg-zinc-800 dark:group-hover:border-zinc-700 dark:group-hover:text-zinc-50">
                  <Icon className="size-5" />
                </div>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-semibold">{label}</h3>
                <p className="text-sm leading-6 text-muted-foreground">{description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
