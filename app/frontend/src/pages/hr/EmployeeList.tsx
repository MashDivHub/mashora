import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, cn } from '@mashora/design-system'
import { Users, Building2 } from 'lucide-react'
import { DataTable, PageHeader, SearchBar, type Column, type FilterOption } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

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

export default function EmployeeList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const pageSize = 40

  const domain: any[] = []
  if (search) domain.push('|', '|', ['name', 'ilike', search], ['work_email', 'ilike', search], ['job_title', 'ilike', search])
  for (const key of activeFilters) {
    const f = FILTERS.find(fl => fl.key === key)
    if (f?.domain) domain.push(...f.domain)
  }

  const order = sortField ? `${sortField} ${sortDir}` : 'name asc'

  const { data, isLoading } = useQuery({
    queryKey: ['employees', domain, page, order],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/hr.employee', {
        domain: domain.length ? domain : undefined,
        fields: LIST_FIELDS, offset: page * pageSize, limit: pageSize, order,
      })
      return data
    },
  })

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
      <PageHeader title="Employees" subtitle="hr" onNew={() => navigate('/admin/hr/employees/new')} />
      <SearchBar placeholder="Search employees..." onSearch={v => { setSearch(v); setPage(0) }}
        filters={FILTERS} activeFilters={activeFilters}
        onFilterToggle={k => { setActiveFilters(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]); setPage(0) }} />
      <DataTable columns={columns} data={data?.records || []} total={data?.total} page={page} pageSize={pageSize}
        onPageChange={setPage} sortField={sortField} sortDir={sortDir}
        onSort={(f, d) => { setSortField(f); setSortDir(d) }} loading={isLoading}
        rowLink={row => `/hr/employees/${row.id}`} emptyMessage="No employees found" emptyIcon={<Users className="h-10 w-10" />} />
    </div>
  )
}
