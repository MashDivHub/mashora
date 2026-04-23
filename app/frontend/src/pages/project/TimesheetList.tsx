import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Clock } from 'lucide-react'
import { DataTable, PageHeader, SearchBar, type Column } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimesheetRecord {
  id: number
  name: string
  project_id: [number, string]
  task_id: [number, string] | false
  employee_id: [number, string]
  date: string
  unit_amount: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 40

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TimesheetList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const order = sortField ? `${sortField} ${sortDir}` : 'date desc'

  const { data, isLoading } = useQuery({
    queryKey: ['timesheets', search, page, order],
    queryFn: () =>
      erpClient.raw
        .post('/projects/timesheets', {
          search: search || undefined,
          offset: page * PAGE_SIZE,
          limit: PAGE_SIZE,
          order,
        })
        .then((r) => r.data),
  })

  const records: TimesheetRecord[] = data?.records ?? []
  const total: number = data?.total ?? 0
  const totalHours = records.reduce((sum, r) => sum + (r.unit_amount || 0), 0)

  const handleSearch = (q: string) => {
    setSearch(q)
    setPage(0)
  }

  const columns: Column<TimesheetRecord>[] = [
    {
      key: 'name',
      label: 'Description',
      render: (_val, row) => (
        <span className="text-sm font-medium">{row.name || '—'}</span>
      ),
    },
    {
      key: 'project_id',
      label: 'Project',
      render: (_val, row) =>
        Array.isArray(row.project_id) ? row.project_id[1] : '—',
    },
    {
      key: 'task_id',
      label: 'Task',
      render: (_val, row) =>
        row.task_id ? (
          row.task_id[1]
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'employee_id',
      label: 'Employee',
      render: (_val, row) =>
        Array.isArray(row.employee_id) ? row.employee_id[1] : '—',
    },
    {
      key: 'date',
      label: 'Date',
      render: (_val, row) =>
        row.date ? new Date(row.date).toLocaleDateString() : '—',
    },
    {
      key: 'unit_amount',
      label: 'Hours',
      align: 'right' as const,
      render: (_val, row) => (
        <span className="font-mono text-sm">
          {(row.unit_amount ?? 0).toFixed(1)}h
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Timesheets"
        subtitle={isLoading ? 'Loading…' : `${total} records`}
        onNew={() => navigate('/admin/model/account.analytic.line/new')}
        newLabel="New Entry"
      />

      <SearchBar
        placeholder="Search timesheets..."
        onSearch={handleSearch}
      />

      <DataTable<TimesheetRecord>
        columns={columns}
        data={records}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        sortField={sortField}
        sortDir={sortDir}
        onSort={(f, d) => { setSortField(f); setSortDir(d) }}
        loading={isLoading}
        rowLink={row => `/admin/model/account.analytic.line/${row.id}`}
        emptyMessage="No timesheet entries found"
        emptyIcon={<Clock className="h-10 w-10" />}
      />

      {!isLoading && records.length > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-border/30 bg-card/50 px-4 py-3">
          <span className="text-sm text-muted-foreground">
            Total hours (this page)
          </span>
          <span className="font-mono text-sm font-semibold">
            {totalHours.toFixed(1)}h
          </span>
        </div>
      )}
    </div>
  )
}
