import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Badge, cn } from '@mashora/design-system'
import { Star, CalendarClock, ClipboardCheck } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface ProjectTask {
  id: number
  name: string
  project_id: [number, string] | false
  stage_id: [number, string] | false
  priority: '0' | '1'
  date_deadline: string | false
}

interface TaskResponse {
  records: ProjectTask[]
  total: number
}

function fmt(v: unknown): string {
  if (Array.isArray(v)) return String(v[1] ?? '')
  return v == null || v === false ? '' : String(v)
}

function isOverdue(deadline: string | false): boolean {
  if (!deadline) return false
  return new Date(deadline) < new Date()
}

function fmtDate(v: string | false): string {
  if (!v) return ''
  return new Date(v).toLocaleDateString()
}

function groupByProject(tasks: ProjectTask[]): Map<string, ProjectTask[]> {
  const map = new Map<string, ProjectTask[]>()
  for (const task of tasks) {
    const key = task.project_id ? fmt(task.project_id) : 'No Project'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(task)
  }
  return map
}

export default function ProjectTodoList() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery<TaskResponse>({
    queryKey: ['project-todos'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.post('/model/project.task', {
          domain: [['user_ids', 'in', ['__uid__']], '&', ['state', '!=', '1_done']],
          fields: ['id', 'name', 'project_id', 'stage_id', 'priority', 'date_deadline'],
          order: 'priority desc, date_deadline asc',
          limit: 100,
        })
        return data
      } catch {
        // Fallback: recent tasks without user filter
        const { data } = await erpClient.raw.post('/model/project.task', {
          fields: ['id', 'name', 'project_id', 'stage_id', 'priority', 'date_deadline'],
          order: 'priority desc, date_deadline asc',
          limit: 100,
        })
        return data
      }
    },
  })

  const tasks = data?.records ?? []
  const grouped = groupByProject(tasks)
  const handleCreate = () => navigate('/admin/projects/tasks/new')

  return (
    <div className="space-y-4">
      <PageHeader
        title="My To-Do"
        subtitle="project"
        onNew={handleCreate}
        newLabel="New Task"
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/30 bg-card/50 h-14 animate-pulse" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="h-12 w-12" />}
          title="All caught up"
          description="No pending tasks assigned to you."
          actionLabel="New Task"
          onAction={handleCreate}
        />
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([project, ptasks]) => (
            <div key={project} className="space-y-2">
              {/* Project group header */}
              <div className="flex items-center gap-2 px-1">
                <Badge variant="outline" className="rounded-lg text-xs font-semibold px-2.5 py-0.5">
                  {project}
                </Badge>
                <span className="text-xs text-muted-foreground">{ptasks.length} task{ptasks.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Task rows */}
              <div className="rounded-2xl border border-border/30 bg-card/50 divide-y divide-border/30 overflow-hidden">
                {ptasks.map((task) => {
                  const overdue = isOverdue(task.date_deadline)
                  const highPriority = task.priority === '1'
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/10 transition-colors"
                    >
                      {/* Priority star */}
                      <Star
                        className={cn(
                          'h-4 w-4 shrink-0',
                          highPriority ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30',
                        )}
                      />

                      {/* Task name */}
                      <span className="flex-1 text-sm font-medium truncate">{task.name}</span>

                      {/* Stage badge */}
                      {task.stage_id && (
                        <Badge variant="secondary" className="rounded-full text-xs shrink-0">
                          {fmt(task.stage_id)}
                        </Badge>
                      )}

                      {/* Deadline */}
                      {task.date_deadline && (
                        <div className={cn(
                          'flex items-center gap-1 text-xs shrink-0',
                          overdue ? 'text-destructive font-semibold' : 'text-muted-foreground',
                        )}>
                          <CalendarClock className="h-3.5 w-3.5" />
                          {fmtDate(task.date_deadline)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
