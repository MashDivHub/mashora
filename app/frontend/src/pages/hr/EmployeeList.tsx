import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, type BadgeVariant } from '@mashora/design-system'
import { Users, Archive } from 'lucide-react'
import {
  DataTable, PageHeader, SearchBar, KanbanBoard, ViewToggle, BulkActionBar,
  toast,
  type Column, type FilterOption, type ViewMode, type KanbanColumn, type KanbanCardData,
  type BulkAction,
} from '@/components/shared'
import { useBulkSelect } from '@/hooks/useBulkSelect'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

/** ERP domain term shape used for model list-queries; accepts operators + tuples */
type DomainTerm = unknown

interface EmployeeRecord {
  id: number
  name?: string
  job_title?: string | false
  job_id?: [number, string] | false
  department_id?: [number, string] | false
  parent_id?: [number, string] | false
  work_email?: string | false
  work_phone?: string | false
  mobile_phone?: string | false
  work_location_id?: [number, string] | false
  employee_type?: string
  image_128?: string | false
  company_id?: [number, string] | false
  active?: boolean
  category_ids?: Array<[number, string] | { id: number; display_name?: string } | number>
}

interface DepartmentRecord {
  id: number
  name: string
}

const LIST_FIELDS = [
  'id', 'name', 'job_title', 'job_id', 'department_id', 'parent_id',
  'work_email', 'work_phone', 'mobile_phone', 'work_location_id',
  'employee_type', 'image_128', 'company_id', 'active', 'category_ids',
]

const TYPE_BADGE: Record<string, string> = {
  employee: 'Employee', worker: 'Worker', student: 'Student',
  trainee: 'Trainee', contractor: 'Contractor',
}

const FILTERS: FilterOption[] = [
  { key: 'employees', label: 'Employees', domain: [['employee_type', '=', 'employee']] },
  { key: 'contractors', label: 'Contractors', domain: [['employee_type', '=', 'contractor']] },
  { key: 'archived', label: 'Archived', domain: [['active', '=', false]] },
]

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase() || '').join('') || '?'
}

export default function EmployeeList() {
  useDocumentTitle('Employees')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const pageSize = 40
  const { selected, clear, setSelected } = useBulkSelect()

  const domain: DomainTerm[] = []
  if (search) domain.push('|', '|', ['name', 'ilike', search], ['work_email', 'ilike', search], ['job_title', 'ilike', search])
  for (const key of activeFilters) {
    const f = FILTERS.find(fl => fl.key === key)
    if (f?.domain) domain.push(...f.domain)
  }

  const order = sortField ? `${sortField} ${sortDir}` : 'name asc'

  const isKanban = viewMode === 'kanban'

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['employees', domain, isKanban ? 'kanban' : page, order],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/hr.employee', {
        domain: domain.length ? domain : undefined,
        fields: LIST_FIELDS,
        offset: isKanban ? 0 : page * pageSize,
        limit: isKanban ? 200 : pageSize,
        order,
      })
      return data
    },
  })

  // Fetch departments for kanban grouping.
  const { data: deptsData } = useQuery({
    queryKey: ['employee-departments'],
    enabled: isKanban,
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/hr.department', {
        fields: ['id', 'name'],
        order: 'name asc',
        limit: 100,
      })
      return data
    },
  })

  async function bulkAction(ids: number[], action: (id: number) => Promise<unknown>, successMsg: string) {
    try {
      await Promise.all(ids.map(action))
      toast.success(`${successMsg} (${ids.length})`)
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      clear()
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, 'Action failed'))
    }
  }

  const bulkActions: BulkAction[] = [
    {
      key: 'archive',
      label: 'Archive',
      icon: <Archive className="h-3.5 w-3.5" />,
      variant: 'destructive',
      confirm: 'Archive {count} employee(s)?',
      onClick: ids => bulkAction(
        ids,
        id => erpClient.raw.put(`/model/hr.employee/${id}`, { vals: { active: false } }),
        'Employees archived',
      ),
    },
  ]

  const columns: Column[] = [
    {
      key: 'name', label: 'Employee',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          {row.image_128 ? (
            <img src={`data:image/png;base64,${row.image_128}`} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-violet-500/15 flex items-center justify-center text-xs font-bold text-violet-400 shrink-0">
              {(row.name?.[0] || '?').toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{row.name}</p>
            {row.job_title && <p className="text-xs text-muted-foreground truncate">{row.job_title}</p>}
          </div>
        </div>
      ),
    },
    { key: 'department_id', label: 'Department', format: v => Array.isArray(v) ? v[1] : '' },
    { key: 'parent_id', label: 'Manager', format: v => Array.isArray(v) ? v[1] : '' },
    { key: 'work_email', label: 'Email', render: v => v ? <a href={`mailto:${v}`} className="text-sm text-primary hover:underline" onClick={e => e.stopPropagation()}>{v}</a> : '' },
    { key: 'work_phone', label: 'Phone' },
    { key: 'work_location_id', label: 'Location', format: v => Array.isArray(v) ? v[1] : '' },
    {
      key: 'employee_type', label: 'Type',
      render: v => v && v !== 'employee' ? <Badge variant="secondary" className="rounded-full text-xs">{TYPE_BADGE[v] || v}</Badge> : '',
    },
    {
      key: 'category_ids', label: 'Tags', sortable: false,
      render: v => {
        if (!Array.isArray(v) || !v.length) return ''
        return (
          <div className="flex flex-wrap gap-1">
            {(v as Array<[number, string] | { id: number; display_name?: string } | number>).slice(0, 2).map((t, i: number) => {
              const key = Array.isArray(t) ? t[0] : (typeof t === 'object' && t !== null ? t.id : i)
              const label = Array.isArray(t)
                ? t[1]
                : (typeof t === 'object' && t !== null ? (t.display_name ?? String(t.id)) : String(t))
              return (
                <Badge key={key} variant="secondary" className="text-[10px] rounded-full px-1.5 py-0">{label}</Badge>
              )
            })}
          </div>
        )
      },
    },
  ]

  const employees: EmployeeRecord[] = data?.records || []
  const depts: DepartmentRecord[] = deptsData?.records || []

  // Build kanban columns: one per department + "No Department" fallback for orphans.
  const kanbanColumns: KanbanColumn[] = depts.map((d) => ({ id: d.id, title: d.name }))
  const hasUnassigned = employees.some((e) => !Array.isArray(e.department_id))
  if (hasUnassigned) kanbanColumns.push({ id: 'none', title: 'No Department' })

  const kanbanCards: KanbanCardData[] = employees.map((e): KanbanCardData => {
    const deptId: string | number = Array.isArray(e.department_id) ? e.department_id[0] : 'none'
    const badges: { label: string; variant?: BadgeVariant }[] = []
    if (e.employee_type && e.employee_type !== 'employee') {
      badges.push({ label: TYPE_BADGE[e.employee_type] || e.employee_type, variant: 'secondary' })
    }
    return {
      id: e.id,
      columnId: deptId,
      title: e.name ?? '',
      subtitle: e.job_title || undefined,
      avatar: initials(e.name || ''),
      badges,
      onClick: () => navigate(`/admin/hr/employees/${e.id}`),
    }
  })

  return (
    <div className="space-y-4">
      <PageHeader title="Employees" subtitle="hr" onNew={() => navigate('/admin/hr/employees/new')} />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <SearchBar placeholder="Search employees..." onSearch={v => { setSearch(v); setPage(0) }}
            filters={FILTERS} activeFilters={activeFilters}
            onFilterToggle={k => { setActiveFilters(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]); setPage(0) }} />
        </div>
        <ViewToggle value={viewMode} onChange={setViewMode} />
      </div>
      {viewMode === 'kanban' ? (
        <KanbanBoard
          columns={kanbanColumns.length ? kanbanColumns : [{ id: 'all', title: 'Employees' }]}
          cards={kanbanColumns.length ? kanbanCards : kanbanCards.map(c => ({ ...c, columnId: 'all' }))}
        />
      ) : (
        <>
          <BulkActionBar selected={selected} onClear={clear} actions={bulkActions} />
          <DataTable columns={columns} data={employees} total={data?.total} page={page} pageSize={pageSize}
            onPageChange={setPage} sortField={sortField} sortDir={sortDir}
            onSort={(f, d) => { setSortField(f); setSortDir(d) }} loading={isLoading}
            isError={isError} error={error} onRetry={() => refetch()}
            rowLink={row => `/admin/hr/employees/${row.id}`}
            selectable
            selectedIds={new Set(selected)}
            onSelectionChange={(ids) => setSelected(Array.from(ids) as number[])}
            emptyMessage="No employees found" emptyIcon={<Users className="h-10 w-10" />} />
        </>
      )}
    </div>
  )
}
