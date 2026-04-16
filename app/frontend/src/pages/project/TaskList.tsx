import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, cn } from '@mashora/design-system'
import { CheckSquare, Star } from 'lucide-react'
import { DataTable, PageHeader, SearchBar, type Column, type FilterOption } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

const LIST_FIELDS = [
  'id', 'name', 'project_id', 'user_ids', 'stage_id', 'priority', 'state',
  'date_deadline', 'tag_ids', 'partner_id', 'milestone_id',
]

const STATE_BADGE: Record<string, { label: string; variant: string }> = {
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

export default function TaskList() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialFilter = searchParams.get('filter')
  const projectId = searchParams.get('project')
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>(initialFilter ? [initialFilter] : ['open'])
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>('date_deadline')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const pageSize = 40

  const domain: any[] = []
  if (projectId) domain.push(['project_id', '=', parseInt(projectId)])
  if (search) domain.push(['name', 'ilike', search])
  for (const key of activeFilters) {
    const f = FILTERS.find(fl => fl.key === key)
    if (f?.domain) domain.push(...f.domain)
  }

  const order = sortField ? `${sortField} ${sortDir}` : 'priority desc, date_deadline asc'

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', domain, page, order],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/project.task', {
        domain: domain.length ? domain : undefined,
        fields: LIST_FIELDS, offset: page * pageSize, limit: pageSize, order,
      })
      return data
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
            {v.slice(0, 2).map((u: any, i: number) => (
              <Badge key={i} variant="secondary" className="text-[10px] rounded-full px-1.5 py-0">{Array.isArray(u) ? u[1] : u?.display_name || u}</Badge>
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
        const s = STATE_BADGE[v] || { label: v || '', variant: 'secondary' }
        return s.label ? <Badge variant={s.variant as any} className="rounded-full text-xs">{s.label}</Badge> : ''
      },
    },
    {
      key: 'date_deadline', label: 'Deadline',
      render: (v, row) => {
        if (!v) return ''
        const overdue = !['1_done', '1_canceled'].includes(row.state) && new Date(v) < new Date()
        return <span className={cn('text-sm', overdue && 'text-red-400 font-medium')}>{new Date(v).toLocaleDateString()}</span>
      },
    },
    { key: 'milestone_id', label: 'Milestone', format: v => Array.isArray(v) ? v[1] : '' },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title={projectId ? 'Project Tasks' : 'All Tasks'} subtitle="project" onNew={() => navigate('/admin/projects/tasks/new')} backTo={projectId ? `/projects/${projectId}` : undefined} />
      <SearchBar placeholder="Search tasks..." onSearch={v => { setSearch(v); setPage(0) }}
        filters={FILTERS} activeFilters={activeFilters}
        onFilterToggle={k => { setActiveFilters(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]); setPage(0) }} />
      <DataTable columns={columns} data={data?.records || []} total={data?.total} page={page} pageSize={pageSize}
        onPageChange={setPage} sortField={sortField} sortDir={sortDir}
        onSort={(f, d) => { setSortField(f); setSortDir(d) }} loading={isLoading}
        rowLink={row => `/admin/projects/tasks/${row.id}`} emptyMessage="No tasks found" emptyIcon={<CheckSquare className="h-10 w-10" />} />
    </div>
  )
}
