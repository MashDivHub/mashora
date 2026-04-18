import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge, cn, type BadgeVariant } from '@mashora/design-system'
import { CheckSquare, Star, Archive, CheckCircle2, Clock } from 'lucide-react'
import {
  DataTable, PageHeader, SearchBar, KanbanBoard, ViewToggle, BulkActionBar, GanttChart, toast,
  type Column, type FilterOption, type ViewMode, type KanbanColumn, type KanbanCardData,
  type BulkAction,
} from '@/components/shared'
import { useBulkSelect } from '@/hooks/useBulkSelect'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

type DomainLeaf = unknown
interface StageRecord { id: number; name: string; sequence?: number; fold?: boolean }
interface TaskRecord {
  id: number
  name: string
  project_id?: [number, string] | false
  user_ids?: Array<[number, string] | { id: number; display_name?: string } | number>
  stage_id?: [number, string] | false
  priority?: string
  state?: string
  date_deadline?: string | false
  date_start?: string | false
  create_date?: string | false
  progress?: number
  milestone_id?: [number, string] | false
}

const LIST_FIELDS = [
  'id', 'name', 'project_id', 'user_ids', 'stage_id', 'priority', 'state',
  'date_deadline', 'date_start', 'create_date', 'progress',
  'tag_ids', 'partner_id', 'milestone_id',
]

const STATE_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  '01_in_progress': { label: 'In Progress', variant: 'info' },
  '02_changes_requested': { label: 'Changes Requested', variant: 'warning' },
  '03_approved': { label: 'Approved', variant: 'success' },
  '1_done': { label: 'Done', variant: 'success' },
  '1_canceled': { label: 'Cancelled', variant: 'destructive' },
}

const FILTERS: FilterOption[] = [
  { key: 'my', label: 'My Tasks', domain: [['user_ids', '!=', false]] },
  { key: 'open', label: 'Open', domain: [['state', 'not in', ['1_done', '1_canceled']]] },
  { key: 'high', label: 'High Priority', domain: [['priority', '=', '1']] },
  { key: 'overdue', label: 'Overdue', domain: [['date_deadline', '<', new Date().toISOString()], ['state', 'not in', ['1_done', '1_canceled']]] },
]

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase() || '').join('') || '?'
}

export default function TaskList() {
  useDocumentTitle('Tasks')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const initialFilter = searchParams.get('filter')
  const projectId = searchParams.get('project')
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>(initialFilter ? [initialFilter] : ['open'])
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>('date_deadline')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const pageSize = 40
  const { selected, clear, setSelected } = useBulkSelect()

  const domain: DomainLeaf[] = []
  if (projectId) domain.push(['project_id', '=', parseInt(projectId)])
  if (search) domain.push(['name', 'ilike', search])
  for (const key of activeFilters) {
    const f = FILTERS.find(fl => fl.key === key)
    if (f?.domain) domain.push(...f.domain)
  }

  const order = sortField ? `${sortField} ${sortDir}` : 'priority desc, date_deadline asc'

  // For kanban, fetch a larger page (no pagination) so the board is meaningful.
  const isKanban = viewMode === 'kanban'

  const tasksQueryKey = ['tasks', domain, isKanban ? 'kanban' : page, order]
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: tasksQueryKey,
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/project.task', {
        domain: domain.length ? domain : undefined,
        fields: LIST_FIELDS,
        offset: isKanban ? 0 : page * pageSize,
        limit: isKanban ? 200 : pageSize,
        order,
      })
      return data
    },
  })

  // Stages query — only when kanban is active.
  const stagesDomain: DomainLeaf[] = projectId ? [['project_ids', 'in', [parseInt(projectId)]]] : []
  const { data: stagesData } = useQuery({
    queryKey: ['task-stages', projectId || 'all'],
    enabled: isKanban,
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/project.task.type', {
        domain: stagesDomain.length ? stagesDomain : undefined,
        fields: ['id', 'name', 'sequence', 'fold'],
        order: 'sequence asc, id asc',
        limit: 100,
      })
      return data
    },
  })

  // Closing stage lookup for "Mark as Done"
  const { data: doneStage } = useQuery({
    queryKey: ['task-stages', 'closed-fold'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/project.task.type', {
        domain: [['fold', '=', true]],
        fields: ['id', 'name'], limit: 1, order: 'sequence asc',
      })
      return data?.records?.[0] || null
    },
  })

  async function bulkAction(ids: number[], action: (id: number) => Promise<unknown>, successMsg: string) {
    try {
      await Promise.all(ids.map(action))
      toast.success(`${successMsg} (${ids.length})`)
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      clear()
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, 'Action failed'))
    }
  }

  const bulkActions: BulkAction[] = [
    {
      key: 'done',
      label: 'Mark as Done',
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      confirm: 'Mark {count} task(s) as Done?',
      onClick: ids => {
        if (!doneStage) {
          toast.error('No closing stage found')
          return
        }
        return bulkAction(
          ids,
          id => erpClient.raw.put(`/model/project.task/${id}`, { vals: { stage_id: doneStage.id, state: '1_done' } }),
          'Tasks marked as done',
        )
      },
    },
    {
      key: 'archive',
      label: 'Archive',
      icon: <Archive className="h-3.5 w-3.5" />,
      variant: 'destructive',
      confirm: 'Archive {count} task(s)?',
      onClick: ids => bulkAction(
        ids,
        id => erpClient.raw.put(`/model/project.task/${id}`, { vals: { active: false } }),
        'Tasks archived',
      ),
    },
  ]

  const moveMut = useMutation({
    mutationFn: async ({ id, stageId }: { id: number; stageId: number }) => {
      await erpClient.raw.put(`/model/project.task/${id}`, { vals: { stage_id: stageId } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (err: unknown) => {
      toast('error', 'Move failed', extractErrorMessage(err, 'Could not move task.'))
    },
  })

  const columns: Column[] = [
    {
      key: 'name', label: 'Task',
      render: (_, row) => (
        <div className="flex items-center gap-2 min-w-0">
          {parseInt(row.priority) > 0 && <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400 shrink-0" />}
          <span className="text-sm font-medium truncate">{row.name}</span>
        </div>
      ),
    },
    { key: 'project_id', label: 'Project', format: v => Array.isArray(v) ? v[1] : '' },
    {
      key: 'user_ids', label: 'Assignees', sortable: false,
      render: v => {
        if (!Array.isArray(v) || !v.length) return ''
        return (
          <div className="flex flex-wrap gap-1">
            {v.slice(0, 2).map((u: [number, string] | { id: number; display_name?: string } | number, i: number) => (
              <Badge key={i} variant="secondary" className="text-[10px] rounded-full px-1.5 py-0">{Array.isArray(u) ? u[1] : (typeof u === 'object' && u !== null ? u.display_name : String(u))}</Badge>
            ))}
            {v.length > 2 && <Badge variant="secondary" className="text-[10px] rounded-full px-1.5 py-0">+{v.length - 2}</Badge>}
          </div>
        )
      },
    },
    { key: 'stage_id', label: 'Stage', render: v => Array.isArray(v) ? <Badge variant="secondary" className="rounded-full text-xs">{v[1]}</Badge> : '' },
    {
      key: 'state', label: 'State',
      render: v => {
        const s = STATE_BADGE[v] || { label: v || '', variant: 'secondary' as BadgeVariant }
        return s.label ? <Badge variant={s.variant} className="rounded-full text-xs">{s.label}</Badge> : ''
      },
    },
    {
      key: 'date_deadline', label: 'Deadline',
      render: (v, row) => {
        if (!v) return ''
        const overdue = !['1_done', '1_canceled'].includes(row.state) && new Date(v) < new Date()
        return (
          <span
            className={cn('text-sm inline-flex items-center gap-1', overdue && 'text-red-400 font-medium')}
            aria-label={overdue ? `overdue ${new Date(v).toLocaleDateString()}` : undefined}
          >
            {overdue && <Clock className="h-3 w-3" aria-hidden="true" />}
            {new Date(v).toLocaleDateString()}
          </span>
        )
      },
    },
    { key: 'milestone_id', label: 'Milestone', format: v => Array.isArray(v) ? v[1] : '' },
  ]

  const stages = stagesData?.records || []
  const tasks = data?.records || []

  // Build kanban columns. Add a synthetic "No stage" column for tasks without one if any.
  const kanbanColumns: KanbanColumn[] = [
    ...(stages as StageRecord[]).map((s) => ({ id: s.id, title: s.name, fold: !!s.fold })),
  ]
  const hasUnstaged = (tasks as TaskRecord[]).some((t) => !Array.isArray(t.stage_id) || !t.stage_id)
  if (hasUnstaged) kanbanColumns.unshift({ id: 'none', title: 'No Stage' })

  const kanbanCards: KanbanCardData[] = (tasks as TaskRecord[]).map((t): KanbanCardData => {
    const stageId: string | number = Array.isArray(t.stage_id) ? t.stage_id[0] : 'none'
    const projName = Array.isArray(t.project_id) ? t.project_id[1] : ''
    const firstUser: string = Array.isArray(t.user_ids) && t.user_ids.length > 0
      ? (() => {
          const u = t.user_ids[0]
          if (Array.isArray(u)) return String(u[1])
          if (typeof u === 'object' && u !== null) return u.display_name || ''
          return ''
        })()
      : ''
    const badges: { label: string; variant?: BadgeVariant }[] = []
    if (t.date_deadline) {
      const overdue = !['1_done', '1_canceled'].includes(t.state || '') && new Date(t.date_deadline) < new Date()
      badges.push({ label: new Date(t.date_deadline).toLocaleDateString(), variant: overdue ? 'destructive' : 'secondary' })
    }
    const stateBadge = t.state ? STATE_BADGE[t.state] : undefined
    if (stateBadge) badges.push({ label: stateBadge.label, variant: stateBadge.variant })
    return {
      id: t.id,
      columnId: stageId,
      title: t.name,
      subtitle: projName ? String(projName) : undefined,
      priority: parseInt(t.priority || '0') || 0,
      avatar: firstUser ? initials(firstUser) : undefined,
      badges,
      onClick: () => navigate(`/admin/projects/tasks/${t.id}`),
    }
  })

  const handleKanbanMove = (cardId: number, _fromCol: string | number, toCol: string | number) => {
    if (toCol === 'none' || typeof toCol !== 'number') return
    moveMut.mutate({ id: cardId, stageId: toCol })
  }

  return (
    <div className="space-y-4">
      <PageHeader title={projectId ? 'Project Tasks' : 'All Tasks'} subtitle="project" onNew={() => navigate('/admin/projects/tasks/new')} backTo={projectId ? `/admin/projects/${projectId}` : undefined} />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <SearchBar placeholder="Search tasks..." onSearch={v => { setSearch(v); setPage(0) }}
            filters={FILTERS} activeFilters={activeFilters}
            onFilterToggle={k => { setActiveFilters(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]); setPage(0) }} />
        </div>
        <ViewToggle value={viewMode} onChange={setViewMode} available={['list', 'kanban', 'gantt']} />
      </div>
      {viewMode === 'kanban' ? (
        <KanbanBoard
          columns={kanbanColumns}
          cards={kanbanCards}
          onCardMove={handleKanbanMove}
        />
      ) : viewMode === 'gantt' ? (
        <GanttChart
          items={(tasks as TaskRecord[])
            .filter((t) => t.date_deadline && (t.date_start || t.create_date))
            .map((t) => ({
              id: t.id,
              title: t.name,
              start: new Date((t.date_start || t.create_date) as string),
              end: new Date(t.date_deadline as string),
              progress: t.progress || 0,
              group: Array.isArray(t.project_id) ? t.project_id[1] : undefined,
              onClick: () => navigate(`/admin/projects/tasks/${t.id}`),
            }))}
          groupBy="group"
        />
      ) : (
        <>
          <BulkActionBar selected={selected} onClear={clear} actions={bulkActions} />
          <DataTable columns={columns} data={tasks} total={data?.total} page={page} pageSize={pageSize}
            onPageChange={setPage} sortField={sortField} sortDir={sortDir}
            onSort={(f, d) => { setSortField(f); setSortDir(d) }} loading={isLoading}
            isError={isError} error={error} onRetry={() => refetch()}
            rowLink={row => `/admin/projects/tasks/${row.id}`}
            selectable
            selectedIds={new Set(selected)}
            onSelectionChange={(ids) => setSelected(Array.from(ids) as number[])}
            emptyMessage="No tasks found" emptyIcon={<CheckSquare className="h-10 w-10" />} />
        </>
      )}
    </div>
  )
}
