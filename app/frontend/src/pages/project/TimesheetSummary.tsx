import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, Users, FolderKanban } from 'lucide-react'
import { PageHeader, LoadingState } from '@/components/shared'
import { Button } from '@mashora/design-system'
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

interface GroupRow {
  label: string
  hours: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtHours(n: number): string {
  return n.toFixed(1) + 'h'
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function firstOfMonth(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

function groupBy(records: TimesheetRecord[]): {
  byProject: GroupRow[]
  byEmployee: GroupRow[]
} {
  const projectMap = new Map<string, number>()
  const employeeMap = new Map<string, number>()

  records.forEach((r) => {
    const proj = r.project_id?.[1] || 'No Project'
    projectMap.set(proj, (projectMap.get(proj) || 0) + r.unit_amount)

    const emp = r.employee_id?.[1] || 'Unknown'
    employeeMap.set(emp, (employeeMap.get(emp) || 0) + r.unit_amount)
  })

  const toSorted = (m: Map<string, number>): GroupRow[] =>
    Array.from(m.entries())
      .map(([label, hours]) => ({ label, hours }))
      .sort((a, b) => b.hours - a.hours)

  return { byProject: toSorted(projectMap), byEmployee: toSorted(employeeMap) }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GroupTable({ rows, emptyText }: { rows: GroupRow[]; emptyText: string }) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
    )
  }
  return (
    <div className="divide-y divide-border/30">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between py-2.5">
          <span className="text-sm truncate pr-4">{row.label}</span>
          <span className="font-mono text-sm font-medium shrink-0">
            {fmtHours(row.hours)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TimesheetSummary() {
  const [dateFrom, setDateFrom] = useState(firstOfMonth())
  const [dateTo, setDateTo] = useState(today())
  const [committed, setCommitted] = useState<{ from: string; to: string }>({
    from: firstOfMonth(),
    to: today(),
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['timesheet-summary', committed.from, committed.to],
    queryFn: () =>
      erpClient.raw
        .post('/projects/timesheets', {
          date_from: committed.from || undefined,
          date_to: committed.to || undefined,
          limit: 10000,
          order: 'date asc',
        })
        .then((r) => r.data),
  })

  const records: TimesheetRecord[] = data?.records ?? []
  const totalHours = records.reduce((sum, r) => sum + (r.unit_amount || 0), 0)
  const { byProject, byEmployee } = groupBy(records)

  const loading = isLoading || isFetching

  return (
    <div className="space-y-6">
      <PageHeader title="Timesheet Summary" />

      {/* Date range filter */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/30 bg-card/50 p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 rounded-lg border border-border/60 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            To
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 rounded-lg border border-border/60 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <Button
          onClick={() => setCommitted({ from: dateFrom, to: dateTo })}
          disabled={loading}
          className="h-9"
        >
          {loading ? 'Loading…' : 'Generate'}
        </Button>
      </div>

      {/* Total hours card */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
        <div className="flex items-center gap-3 mb-1">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Total Hours</span>
        </div>
        <p className="text-4xl font-bold tracking-tight">
          {loading ? '…' : fmtHours(totalHours)}
        </p>
        {!loading && (
          <p className="mt-1 text-xs text-muted-foreground">
            {records.length} {records.length === 1 ? 'entry' : 'entries'} —{' '}
            {committed.from} to {committed.to}
          </p>
        )}
      </div>

      {/* Grouped tables */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* By Project */}
        <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
          <div className="flex items-center gap-2 mb-4">
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">By Project</h3>
          </div>
          {loading ? (
            <LoadingState className="py-6" />
          ) : (
            <GroupTable rows={byProject} emptyText="No data for this period" />
          )}
        </div>

        {/* By Employee */}
        <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">By Employee</h3>
          </div>
          {loading ? (
            <LoadingState className="py-6" />
          ) : (
            <GroupTable rows={byEmployee} emptyText="No data for this period" />
          )}
        </div>
      </div>
    </div>
  )
}
