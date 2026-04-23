import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { DataTable, PageHeader, SearchBar } from '@/components/shared'
import type { Column } from '@/components/shared/DataTable'
import { Badge } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { Clock } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttendanceRecord {
  id: number
  employee_id: [number, string]
  department_id: [number, string] | false
  check_in: string
  check_out: string | false
  worked_hours: number
  overtime_hours: number | 0
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtHours = (h: number) => {
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`
}

function fmtDatetime(dt: string): string {
  // dt is "YYYY-MM-DD HH:MM:SS" — convert to locale string
  const d = new Date(dt.replace(' ', 'T'))
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Column definitions ───────────────────────────────────────────────────────

const columns: Column<AttendanceRecord>[] = [
  {
    key: 'employee_id',
    label: 'Employee',
    render: (_val, row) => row.employee_id[1],
  },
  {
    key: 'department_id',
    label: 'Department',
    render: (_val, row) =>
      row.department_id ? row.department_id[1] : <span className="text-muted-foreground">—</span>,
  },
  {
    key: 'check_in',
    label: 'Check In',
    render: (_val, row) => fmtDatetime(row.check_in),
  },
  {
    key: 'check_out',
    label: 'Check Out',
    render: (_val, row) =>
      row.check_out ? (
        fmtDatetime(row.check_out)
      ) : (
        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400 rounded-full text-xs font-medium border">
          Still working
        </Badge>
      ),
  },
  {
    key: 'worked_hours',
    label: 'Worked Hours',
    render: (_val, row) => fmtHours(row.worked_hours),
  },
  {
    key: 'overtime_hours',
    label: 'Overtime',
    render: (_val, row) =>
      row.overtime_hours > 0 ? (
        <span className="text-amber-500 font-medium">{fmtHours(row.overtime_hours)}</span>
      ) : null,
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 40

export default function AttendanceList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const { data, isLoading } = useQuery({
    queryKey: ['hr-attendance', search, page],
    queryFn: () =>
      erpClient.raw
        .post('/hr/attendance', {
          search: search || undefined,
          offset: page * PAGE_SIZE,
          limit: PAGE_SIZE,
          order: 'check_in desc',
        })
        .then((r) => r.data),
  })

  const records: AttendanceRecord[] = data?.records ?? []
  const total: number = data?.total ?? 0

  const handleSearch = (q: string) => {
    setSearch(q)
    setPage(0)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        subtitle={isLoading ? 'Loading…' : `${total} records`}
        onNew={() => navigate('/admin/model/hr.attendance/new')}
        newLabel="New Entry"
      />

      <SearchBar
        placeholder="Search employees..."
        onSearch={handleSearch}
      />

      <DataTable<AttendanceRecord>
        columns={columns}
        data={records}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        loading={isLoading}
        rowLink={row => `/admin/model/hr.attendance/${row.id}`}
        emptyMessage="No attendance records found"
        emptyIcon={<Clock className="size-6" />}
      />
    </div>
  )
}
