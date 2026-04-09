import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DataTable, PageHeader, SearchBar } from '@/components/shared'
import type { Column } from '@/components/shared/DataTable'
import { Badge } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { Clock } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type WorkEntryState = 'draft' | 'validated' | 'conflict' | 'cancelled'

interface WorkEntryRecord {
  id: number
  name: string | false
  employee_id: [number, string] | false
  work_entry_type_id: [number, string] | false
  date_start: string | false
  date_stop: string | false
  duration: number
  state: WorkEntryState
}

// ─── State config ─────────────────────────────────────────────────────────────

type BadgeVariant = 'secondary' | 'warning' | 'info' | 'success' | 'destructive'

const STATE_CONFIG: Record<WorkEntryState, { label: string; variant: BadgeVariant }> = {
  draft:     { label: 'Draft',     variant: 'secondary'   },
  validated: { label: 'Validated', variant: 'success'     },
  conflict:  { label: 'Conflict',  variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'warning'     },
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtDate(value: string | false): string {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return String(value).split(' ')[0]
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtHours(duration: number): string {
  if (!duration) return '0h'
  const h = Math.floor(duration)
  const m = Math.round((duration - h) * 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 40

export default function WorkEntries() {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const order = sortField ? `${sortField} ${sortDir}` : 'date_start desc'

  const params: Record<string, unknown> = {
    fields: ['id', 'name', 'employee_id', 'work_entry_type_id', 'date_start', 'date_stop', 'duration', 'state'],
    order,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }
  if (search) params.search = search

  const { data, isLoading } = useQuery({
    queryKey: ['work-entries', search, page, order],
    queryFn: () =>
      erpClient.raw.post('/model/hr.work.entry', params).then(r => r.data),
  })

  const records: WorkEntryRecord[] = data?.records ?? []
  const total: number = data?.total ?? 0

  const columns: Column<WorkEntryRecord>[] = [
    {
      key: 'employee_id',
      label: 'Employee',
      sortable: true,
      render: (v) => (Array.isArray(v) ? v[1] : '—'),
    },
    {
      key: 'work_entry_type_id',
      label: 'Type',
      render: (v) => (Array.isArray(v) ? v[1] : '—'),
    },
    {
      key: 'date_start',
      label: 'Start',
      sortable: true,
      render: (v) => fmtDate(v),
    },
    {
      key: 'date_stop',
      label: 'End',
      render: (v) => fmtDate(v),
    },
    {
      key: 'duration',
      label: 'Duration',
      render: (v) => fmtHours(v as number),
    },
    {
      key: 'state',
      label: 'Status',
      render: (v: WorkEntryState) => {
        const cfg = STATE_CONFIG[v] ?? STATE_CONFIG.draft
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>
      },
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Work Entries"
        subtitle={isLoading ? undefined : `${total} entr${total !== 1 ? 'ies' : 'y'}`}
      />

      <SearchBar
        placeholder="Search work entries..."
        onSearch={v => { setSearch(v); setPage(0) }}
      />

      <DataTable
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
        emptyMessage="No work entries found"
        emptyIcon={<Clock className="h-10 w-10" />}
      />
    </div>
  )
}
