import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Badge, Skeleton, Separator, cn,
} from '@mashora/design-system'
import {
  ArrowLeft, Check, X, Star, Calendar, Users, Link2, ListTree, Target,
  Clock, ChevronRight, FolderKanban,
} from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

// ─── State config ─────────────────────────────────────────────────────────────

const stateConfig: Record<string, { badge: 'secondary' | 'warning' | 'success' | 'info' | 'destructive'; label: string }> = {
  '01_in_progress': { badge: 'secondary', label: 'In Progress' },
  '02_changes_requested': { badge: 'warning', label: 'Changes Requested' },
  '03_approved': { badge: 'success', label: 'Approved' },
  '04_waiting_normal': { badge: 'info', label: 'Waiting' },
  '1_done': { badge: 'success', label: 'Done' },
  '1_canceled': { badge: 'destructive', label: 'Cancelled' },
}

const priorityLabels = ['Normal', 'Medium', 'High', 'Urgent']
const priorityBadge = ['secondary', 'info', 'warning', 'destructive'] as const

// ─── Detail row ───────────────────────────────────────────────────────────────

function DetailRow({
  label,
  children,
  last = false,
}: {
  label: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div className={cn('flex items-center justify-between py-3 text-sm', !last && 'border-b border-border/50')}>
      <span className="text-muted-foreground shrink-0 mr-4">{label}</span>
      <span className="font-medium text-right">{children}</span>
    </div>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, Math.round(value)))
  return (
    <div className="h-1.5 w-full rounded-full bg-border/60 overflow-hidden">
      <div
        className="h-full rounded-full bg-emerald-500 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', id],
    queryFn: () => erpClient.raw.get(`/projects/tasks/${id}`).then((r) => r.data),
    enabled: !!id,
  })

  const doneMut = useMutation({
    mutationFn: () => erpClient.raw.post(`/projects/tasks/${id}/state?state=1_done`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task', id] }),
  })

  const cancelMut = useMutation({
    mutationFn: () => erpClient.raw.post(`/projects/tasks/${id}/state?state=1_canceled`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task', id] }),
  })

  const reopenMut = useMutation({
    mutationFn: () => erpClient.raw.post(`/projects/tasks/${id}/state?state=01_in_progress`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task', id] }),
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <div className="rounded-2xl border border-border/70 bg-muted/60 p-4">
          <ListTree className="size-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">Task not found</p>
      </div>
    )
  }

  const isClosed = task.is_closed
  const stateCfg = stateConfig[task.state] ?? stateConfig['01_in_progress']
  const priorityNum = Number(task.priority)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            {task.project_id ? task.project_id[1] : 'Task'}
          </p>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">{task.name}</h1>
            {priorityNum > 0 && (
              <Star
                className={cn(
                  'h-5 w-5 shrink-0',
                  priorityNum >= 2 ? 'fill-amber-400 text-amber-400' : 'fill-zinc-400 text-zinc-400',
                )}
              />
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isClosed && (
            <Button
              variant="success"
              className="rounded-2xl"
              onClick={() => doneMut.mutate()}
              disabled={doneMut.isPending}
            >
              <Check className="h-4 w-4" />
              {doneMut.isPending ? 'Marking...' : 'Done'}
            </Button>
          )}
          {!isClosed && (
            <Button
              variant="outline"
              className="rounded-2xl"
              onClick={() => cancelMut.mutate()}
              disabled={cancelMut.isPending}
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
          )}
          {isClosed && (
            <Button
              variant="outline"
              className="rounded-2xl"
              onClick={() => reopenMut.mutate()}
              disabled={reopenMut.isPending}
            >
              {reopenMut.isPending ? 'Reopening...' : 'Reopen'}
            </Button>
          )}
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={() =>
              task.project_id
                ? navigate(`/projects/${task.project_id[0]}`)
                : navigate('/projects/list')
            }
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      </div>

      {/* Status strip */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={stateCfg.badge}>{stateCfg.label}</Badge>
        {task.stage_id && (
          <Badge variant="outline">{task.stage_id[1]}</Badge>
        )}
        {priorityNum > 0 && (
          <Badge variant={priorityBadge[Math.min(priorityNum, 3)]} className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-current" />
            {priorityLabels[Math.min(priorityNum, 3)]}
          </Badge>
        )}
        {task.tag_ids?.map((tag: any) => (
          <Badge key={typeof tag === 'number' ? tag : tag[0]} variant="secondary">
            {typeof tag === 'number' ? `Tag ${tag}` : tag[1]}
          </Badge>
        ))}
      </div>

      {/* Detail cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Assignment */}
        <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
          <div className="border-b border-border/70 bg-muted/20 px-5 py-4 flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              Assignment
            </p>
          </div>
          <div className="px-5 py-1">
            <DetailRow label="Assignees">
              {task.user_ids?.length > 0
                ? task.user_ids.map((u: any) => (typeof u === 'number' ? `User ${u}` : u[1])).join(', ')
                : <span className="text-muted-foreground">Unassigned</span>}
            </DetailRow>
            {task.partner_id && (
              <DetailRow label="Customer">{task.partner_id[1]}</DetailRow>
            )}
            {task.date_deadline && (
              <DetailRow label="Deadline">
                <span className="font-mono">{task.date_deadline.split(' ')[0]}</span>
              </DetailRow>
            )}
            {task.date_assign && (
              <DetailRow label="Assigned on">
                <span className="font-mono">{task.date_assign.split(' ')[0]}</span>
              </DetailRow>
            )}
            {task.allocated_hours > 0 && (
              <DetailRow label="Allocated hours">
                <span className="font-mono">{task.allocated_hours}h</span>
              </DetailRow>
            )}
            {task.milestone_id && (
              <DetailRow label="Milestone" last>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  {task.milestone_id[1]}
                </Badge>
              </DetailRow>
            )}
          </div>
        </div>

        {/* Related */}
        <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
          <div className="border-b border-border/70 bg-muted/20 px-5 py-4 flex items-center gap-2">
            <Link2 className="size-4 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              Related
            </p>
          </div>
          <div className="px-5 py-1">
            {task.parent_id && (
              <DetailRow label="Parent task">
                <button
                  onClick={() => navigate(`/projects/tasks/${task.parent_id[0]}`)}
                  className="group flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  {task.parent_id[1]}
                  <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </button>
              </DetailRow>
            )}
            {task.project_id && (
              <DetailRow label="Project">
                <button
                  onClick={() => navigate(`/projects/${task.project_id[0]}`)}
                  className="group flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  <FolderKanban className="size-3.5" />
                  {task.project_id[1]}
                </button>
              </DetailRow>
            )}
            <DetailRow label="Subtasks">
              <div className="flex items-center gap-2">
                <span className="tabular-nums">
                  {task.subtask_count || 0}
                  <span className="text-muted-foreground font-normal">
                    {' '}({task.closed_subtask_count || 0} done)
                  </span>
                </span>
              </div>
            </DetailRow>
            {(task.subtask_count ?? 0) > 0 && (
              <div className="py-3 border-b border-border/50">
                <ProgressBar value={task.subtask_completion_percentage ?? 0} />
              </div>
            )}
            <DetailRow label="Blocking tasks">
              <span className="tabular-nums">
                {task.depend_on_count || 0}
                <span className="text-muted-foreground font-normal">
                  {' '}({task.closed_depend_on_count || 0} resolved)
                </span>
              </span>
            </DetailRow>
            <DetailRow label="Dependent tasks" last>
              <span className="tabular-nums">{task.dependent_tasks_count || 0}</span>
            </DetailRow>
          </div>
        </div>
      </div>

      {/* Description */}
      {task.description && (
        <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
          <div className="border-b border-border/70 bg-muted/20 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              Description
            </p>
          </div>
          <div className="p-6">
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: task.description }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
