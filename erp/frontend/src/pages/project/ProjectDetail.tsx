import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Badge, Skeleton, Input, Label, CardTitle, cn,
} from '@mashora/design-system'
import {
  ArrowLeft, ListTodo, Target, Calendar, TrendingUp, Star,
  FolderKanban, User, CheckCircle2, Clock, ChevronRight,
} from 'lucide-react'
import { erpClient } from '@/lib/erp-api'
import { useState } from 'react'

// ─── Status config ────────────────────────────────────────────────────────────

const statusConfig: Record<string, { badge: 'success' | 'warning' | 'destructive' | 'info' | 'secondary'; label: string }> = {
  on_track: { badge: 'success', label: 'On Track' },
  at_risk: { badge: 'warning', label: 'At Risk' },
  off_track: { badge: 'destructive', label: 'Off Track' },
  on_hold: { badge: 'info', label: 'On Hold' },
  done: { badge: 'secondary', label: 'Done' },
  to_define: { badge: 'secondary', label: 'Not Set' },
}

const stateConfig: Record<string, { badge: 'secondary' | 'warning' | 'success' | 'info' | 'destructive'; label: string }> = {
  '01_in_progress': { badge: 'secondary', label: 'In Progress' },
  '02_changes_requested': { badge: 'warning', label: 'Changes Requested' },
  '03_approved': { badge: 'success', label: 'Approved' },
  '04_waiting_normal': { badge: 'info', label: 'Waiting' },
  '1_done': { badge: 'secondary', label: 'Done' },
  '1_canceled': { badge: 'destructive', label: 'Cancelled' },
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' }) {
  const pct = Math.min(100, Math.max(0, Math.round(value)))
  const color =
    pct >= 80 ? 'bg-emerald-500' :
    pct >= 40 ? 'bg-amber-500' :
    'bg-zinc-400 dark:bg-zinc-600'

  return (
    <div className="flex items-center gap-3">
      <div className={cn('flex-1 rounded-full bg-border/60 overflow-hidden', size === 'sm' ? 'h-1.5' : 'h-2')}>
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-medium tabular-nums w-12 text-right">{pct}%</span>
    </div>
  )
}

// ─── Kanban task card ─────────────────────────────────────────────────────────

function TaskCard({ task, onClick }: { task: any; onClick: () => void }) {
  const cfg = stateConfig[task.state] ?? stateConfig['01_in_progress']
  const hasPriority = Number(task.priority) > 0
  const isHighPriority = Number(task.priority) >= 2

  return (
    <button
      onClick={onClick}
      className="group w-full rounded-2xl border border-border/60 bg-card/90 p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-[0_8px_30px_-12px_rgba(15,23,42,0.35)] dark:hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)]"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium leading-snug line-clamp-2 flex-1">{task.name}</p>
        {hasPriority && (
          <Star
            className={cn(
              'mt-0.5 h-3.5 w-3.5 shrink-0',
              isHighPriority ? 'fill-amber-400 text-amber-400' : 'fill-zinc-400 text-zinc-400',
            )}
          />
        )}
      </div>

      {task.user_ids?.length > 0 && (
        <p className="text-[11px] text-muted-foreground truncate mb-2">
          {task.user_ids.map((u: any) => (typeof u === 'number' ? `User ${u}` : u[1])).join(', ')}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        {task.date_deadline ? (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Calendar className="h-2.5 w-2.5" />
            {task.date_deadline.split(' ')[0]}
          </span>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1.5">
          {task.subtask_count > 0 && (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {task.closed_subtask_count ?? 0}/{task.subtask_count}
            </span>
          )}
          <Badge variant={cfg.badge} className="text-[10px] px-1.5 py-0">
            {cfg.label}
          </Badge>
        </div>
      </div>
    </button>
  )
}

// ─── Detail row ───────────────────────────────────────────────────────────────

function DetailRow({ label, children, last = false }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between py-3 text-sm', !last && 'border-b border-border/50')}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{children}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = id === 'new'

  const [formName, setFormName] = useState('')
  const [formManager, setFormManager] = useState('')
  const [formCustomer, setFormCustomer] = useState('')

  const createMut = useMutation({
    mutationFn: (vals: Record<string, any>) =>
      erpClient.raw.post('/projects/create', vals).then((r) => r.data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['project'] })
      navigate(`/projects/${result.id}`, { replace: true })
    },
  })

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => erpClient.raw.get(`/projects/${id}`).then((r) => r.data),
    enabled: !isNew,
  })

  const { data: pipeline } = useQuery({
    queryKey: ['project-pipeline', id],
    queryFn: () => erpClient.raw.get(`/projects/${id}/pipeline`).then((r) => r.data),
    enabled: !isNew,
  })

  const { data: milestones } = useQuery({
    queryKey: ['project-milestones', id],
    queryFn: () => erpClient.raw.get(`/projects/${id}/milestones`).then((r) => r.data),
    enabled: !isNew,
  })

  // ── Create mode ──
  if (isNew) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Projects</p>
          <h1 className="text-2xl font-bold tracking-tight">New Project</h1>
        </div>
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)]">
          <div className="border-b border-border/70 bg-muted/20 px-6 py-4">
            <CardTitle>Project Details</CardTitle>
          </div>
          <div className="p-6 space-y-4 max-w-lg">
            <div className="space-y-1.5">
              <Label htmlFor="proj-name">Name</Label>
              <Input id="proj-name" placeholder="Project name" value={formName} onChange={(e) => setFormName(e.target.value)} className="rounded-2xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proj-manager">Manager</Label>
              <Input id="proj-manager" placeholder="Project manager" value={formManager} onChange={(e) => setFormManager(e.target.value)} className="rounded-2xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proj-customer">Customer</Label>
              <Input id="proj-customer" placeholder="Customer (optional)" value={formCustomer} onChange={(e) => setFormCustomer(e.target.value)} className="rounded-2xl" />
            </div>
          </div>
          <div className="border-t border-border/60 bg-muted/20 px-6 py-4 flex gap-2">
            <Button
              onClick={() => createMut.mutate({ name: formName, manager_name: formManager, partner_name: formCustomer || undefined })}
              disabled={createMut.isPending || !formName}
              className="rounded-2xl"
            >
              {createMut.isPending ? 'Creating…' : 'Create Project'}
            </Button>
            <Button variant="outline" className="rounded-2xl" onClick={() => navigate('/projects/list')}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <div className="rounded-2xl border border-border/70 bg-muted/60 p-4">
          <FolderKanban className="size-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">Project not found</p>
      </div>
    )
  }

  const status = project.last_update_status || 'to_define'
  const cfg = statusConfig[status] ?? statusConfig.to_define
  const pipelineData = pipeline?.pipeline ?? []
  const milestoneData = milestones?.records ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Project
          </p>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight truncate">{project.name}</h1>
            {project.is_favorite && (
              <Star className="h-5 w-5 shrink-0 fill-amber-400 text-amber-400" />
            )}
          </div>
          <div className="flex items-center gap-2 pt-0.5">
            <Badge variant={cfg.badge}>{cfg.label}</Badge>
            {project.partner_id && (
              <span className="text-sm text-muted-foreground">{project.partner_id[1]}</span>
            )}
          </div>
        </div>
        <Button variant="outline" className="rounded-2xl shrink-0" onClick={() => navigate('/projects/list')}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Progress bar */}
      <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] p-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Overall Progress
          </p>
          <span className="text-sm text-muted-foreground tabular-nums">
            {project.closed_task_count} / {project.task_count} tasks complete
          </span>
        </div>
        <ProgressBar value={project.task_completion_percentage} />
      </div>

      {/* Info grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Details */}
        <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
          <div className="border-b border-border/70 bg-muted/20 px-5 py-4 flex items-center gap-2">
            <ListTodo className="size-4 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              Details
            </p>
          </div>
          <div className="px-5 py-1">
            <DetailRow label="Manager">
              {project.user_id ? project.user_id[1] : '—'}
            </DetailRow>
            {project.partner_id && (
              <DetailRow label="Customer">{project.partner_id[1]}</DetailRow>
            )}
            {project.date_start && (
              <DetailRow label="Start date">{project.date_start}</DetailRow>
            )}
            {project.date && (
              <DetailRow label="Deadline" last={!project.date_start && !project.partner_id}>
                <span className="font-mono">{project.date}</span>
              </DetailRow>
            )}
            {!project.date_start && !project.date && !project.partner_id && (
              <DetailRow label="" last>
                <span className="text-muted-foreground text-xs">No extra details</span>
              </DetailRow>
            )}
          </div>
        </div>

        {/* Task stats */}
        <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
          <div className="border-b border-border/70 bg-muted/20 px-5 py-4 flex items-center gap-2">
            <TrendingUp className="size-4 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              Tasks
            </p>
          </div>
          <div className="px-5 py-1">
            <DetailRow label="Open">
              <span className="tabular-nums">{project.open_task_count}</span>
            </DetailRow>
            <DetailRow label="Closed">
              <span className="tabular-nums text-emerald-500">{project.closed_task_count}</span>
            </DetailRow>
            <DetailRow label="Total" last>
              <span className="tabular-nums font-semibold">{project.task_count}</span>
            </DetailRow>
          </div>
        </div>

        {/* Milestones */}
        <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
          <div className="border-b border-border/70 bg-muted/20 px-5 py-4 flex items-center gap-2">
            <Target className="size-4 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              Milestones
            </p>
          </div>
          {milestoneData.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <p className="text-sm text-muted-foreground">No milestones set</p>
            </div>
          ) : (
            <div className="px-5 py-1">
              {milestoneData.slice(0, 5).map((m: any, idx: number) => (
                <div
                  key={m.id}
                  className={cn(
                    'flex items-center justify-between py-3 text-sm',
                    idx < Math.min(milestoneData.length, 5) - 1 && 'border-b border-border/50',
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {m.is_reached ? (
                      <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                    ) : (
                      <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span
                      className={cn(
                        'truncate',
                        m.is_reached && 'line-through text-muted-foreground',
                      )}
                    >
                      {m.name}
                    </span>
                  </div>
                  {m.deadline && (
                    <span className="text-[11px] text-muted-foreground font-mono ml-2 shrink-0">
                      {m.deadline}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Kanban pipeline */}
      <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
        <div className="border-b border-border/70 bg-muted/20 px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Task Pipeline
          </p>
        </div>

        {pipelineData.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="rounded-2xl border border-border/70 bg-muted/60 p-4">
              <ListTodo className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No stages configured</p>
            <p className="text-xs text-muted-foreground">Add stages to this project to see the kanban board.</p>
          </div>
        ) : (
          <div className="p-4 overflow-x-auto">
            <div className="flex gap-3 pb-2" style={{ minWidth: 'max-content' }}>
              {pipelineData.map((col: any) => (
                <div
                  key={col.stage.id}
                  className="flex w-64 shrink-0 flex-col rounded-2xl border border-border/60 bg-muted/20 overflow-hidden"
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 px-3.5 py-2.5">
                    <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground truncate">
                      {col.stage.name}
                    </h4>
                    <span className="ml-2 shrink-0 rounded-full border border-border/60 bg-card px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                      {col.count}
                    </span>
                  </div>

                  {/* Tasks */}
                  <div
                    className="flex flex-col gap-2 p-2.5 overflow-y-auto"
                    style={{ maxHeight: '420px' }}
                  >
                    {col.tasks.length === 0 ? (
                      <p className="py-6 text-center text-xs text-muted-foreground">No tasks</p>
                    ) : (
                      col.tasks.map((task: any) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onClick={() => navigate(`/projects/tasks/${task.id}`)}
                        />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
