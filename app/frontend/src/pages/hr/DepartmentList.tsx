import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'
import { DataTable, PageHeader, SearchBar, type Column } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

const FIELDS = ['id', 'name', 'parent_id', 'manager_id', 'total_employee', 'company_id']

export default function DepartmentList() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const domain: any[] = search ? [['name', 'ilike', search]] : []

  const { data, isLoading } = useQuery({
    queryKey: ['departments', domain, page, sortField, sortDir],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/hr.department', {
        domain: domain.length ? domain : undefined,
        fields: FIELDS, offset: page * 40, limit: 40, order: sortField ? `${sortField} ${sortDir}` : 'name asc',
      })
      return data
    },
  })

  const columns: Column[] = [
    {
      key: 'name', label: 'Department',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <Building2 className="h-4 w-4 text-blue-400" />
          </div>
          <span className="text-sm font-medium">{row.name}</span>
        </div>
      ),
    },
    { key: 'parent_id', label: 'Parent', format: v => Array.isArray(v) ? v[1] : '' },
    { key: 'manager_id', label: 'Manager', format: v => Array.isArray(v) ? v[1] : '' },
    { key: 'total_employee', label: 'Employees', align: 'right' as const, render: v => <span className="tabular-nums">{v || 0}</span> },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Departments" subtitle="hr" backTo="/admin/hr" />
      <SearchBar placeholder="Search departments..." onSearch={v => { setSearch(v); setPage(0) }} />
      <DataTable columns={columns} data={data?.records || []} total={data?.total} page={page} pageSize={40}
        onPageChange={setPage} sortField={sortField} sortDir={sortDir}
        onSort={(f, d) => { setSortField(f); setSortDir(d) }} loading={isLoading}
        emptyMessage="No departments found" emptyIcon={<Building2 className="h-10 w-10" />} />
    </div>
  )
}
