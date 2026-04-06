import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, cn } from '@mashora/design-system'
import { FolderKanban, CheckSquare } from 'lucide-react'
import { DataTable, PageHeader, SearchBar, type Column, type FilterOption } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

const LIST_FIELDS = [
  'id', 'name', 'partner_id', 'user_id', 'date_start', 'date',
  'task_count', 'open_task_count', 'tag_ids', 'last_update_status',
  'stage_id', 'color', 'active',
]

const STATUS_COLORS: Record<string, { label: string; color: string }> = {
  on_track: { label: 'On Track', color: 'text-emerald-400' },
  at_risk: { label: 'At Risk', color: 'text-amber-400' },
  off_track: { label: 'Off Track', color: 'text-red-400' },
  on_hold: { label: 'On Hold', color: 'text-blue-400' },
  done: { label: 'Done', color: 'text-emerald-400' },
  to_define: { label: 'To Define', color: 'text-muted-foreground' },
}

const FILTERS: FilterOption[] = [
  { key: 'active', label: 'Active', domain: [['active', '=', true]] },
  { key: 'my', label: 'My Projects', domain: [['user_id', '!=', false]] },
  { key: 'at_risk', label: 'At Risk', domain: [['last_update_status', '=', 'at_risk']] },
]

export default function ProjectList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const pageSize = 40

  const domain: any[] = []
  if (search) domain.push(['name', 'ilike', search])
  for (const key of activeFilters) {
    const f = FILTERS.find(fl => fl.key === key)
    if (f) domain.push(...f.domain)
  }

  const order = sortField ? `${sortField} ${sortDir}` : 'name asc'

  const { data, isLoading } = useQuery({
    queryKey: ['projects', domain, page, order],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/project.project', {
        domain: domain.length ? domain : undefined,
        fields: LIST_FIELDS, offset: page * pageSize, limit: pageSize, order,
      })
      return data
    },
  })

  const columns: Column[] = [
    {
      key: 'name', label: 'Project',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FolderKanban className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{row.name}</p>
            {row.partner_id && <p className="text-xs text-muted-foreground">{Array.isArray(row.partner_id) ? row.partner_id[1] : ''}</p>}
          </div>
        </div>
      ),
    },
    { key: 'user_id', label: 'Manager', format: v => Array.isArray(v) ? v[1] : '' },
    {
      key: 'task_count', label: 'Tasks', align: 'center' as const,
      render: (_, row) => (
        <div className="flex items-center gap-1.5 justify-center">
          <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm tabular-nums">{row.open_task_count || 0} / {row.task_count || 0}</span>
        </div>
      ),
    },
    {
      key: 'last_update_status', label: 'Status',
      render: v => {
        const s = STATUS_COLORS[v] || STATUS_COLORS.to_define
        return <span className={cn('text-xs font-medium', s.color)}>{s.label}</span>
      },
    },
    { key: 'date_start', label: 'Start', format: v => v ? new Date(v).toLocaleDateString() : '' },
    { key: 'date', label: 'End', format: v => v ? new Date(v).toLocaleDateString() : '' },
    {
      key: 'tag_ids', label: 'Tags', sortable: false,
      render: v => {
        if (!Array.isArray(v) || !v.length) return ''
        return (
          <div className="flex flex-wrap gap-1">
            {v.slice(0, 2).map((t: any, i: number) => (
              <Badge key={i} variant="secondary" className="text-[10px] rounded-full px-1.5 py-0">{Array.isArray(t) ? t[1] : t?.display_name || t}</Badge>
            ))}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Projects" subtitle="project" onNew={() => navigate('/projects/new')} />
      <SearchBar placeholder="Search projects..." onSearch={v => { setSearch(v); setPage(0) }}
        filters={FILTERS} activeFilters={activeFilters}
        onFilterToggle={k => { setActiveFilters(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]); setPage(0) }} />
      <DataTable columns={columns} data={data?.records || []} total={data?.total} page={page} pageSize={pageSize}
        onPageChange={setPage} sortField={sortField} sortDir={sortDir}
        onSort={(f, d) => { setSortField(f); setSortDir(d) }} loading={isLoading}
        rowLink={row => `/projects/${row.id}`} emptyMessage="No projects found" emptyIcon={<FolderKanban className="h-10 w-10" />} />
    </div>
  )
}
