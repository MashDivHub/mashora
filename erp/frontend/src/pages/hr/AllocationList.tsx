import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DataTable, PageHeader, SearchBar } from '@/components/shared'
import type { Column } from '@/components/shared/DataTable'
import { Badge } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { CalendarCheck } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type AllocationState = 'draft' | 'confirm' | 'validate1' | 'validate' | 'refuse'

interface AllocationRecord {
  id: number
  employee_id: [number, string] | false
  holiday_status_id: [number, string] | false
  number_of_days: number
  state: AllocationState
  date_from: string | false
  date_to: string | false
  notes: string | false
}

// ─── State config ─────────────────────────────────────────────────────────────

type BadgeVariant = 'secondary' | 'warning' | 'info' | 'success' | 'destructive'

const STATE_CONFIG: Record<AllocationState, { label: string; variant: BadgeVariant }> = {
  draft:     { label: 'Draft',           variant: 'secondary'   },
  confirm:   { label: 'To Approve',      variant: 'warning'     },
  validate1: { label: 'Second Approval', variant: 'info'        },
  validate:  { label: 'Approved',        variant: 'success'     },
  refuse:    { label: 'Refused',         variant: 'destructive' },
}

// ─── Tab filters ──────────────────────────────────────────────────────────────

type TabKey = 'all' | 'confirm' | 'validate'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all',      label: 'All'        },
  { key: 'confirm',  label: 'To Approve' },
  { key: 'validate', label: 'Approved'   },
]

// ─── Date formatter ───────────────────────────────────────────────────────────

function fmtDate(value: string | false): string {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return value.split(' ')[0]
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 40

export default function AllocationList() {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<TabKey>('all')
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const order = sortField ? `${sortField} ${sortDir}` : 'create_date desc'

  const domain: any[] = []
  if (search) domain.push(['employee_id.name', 'ilike', search])
  if (tab !== 'all') domain.push(['state', '=', tab])

  const { data, isLoading } = useQuery({
    queryKey: ['allocation-list', tab, search, page, order],
    queryFn: () =>
      erpClient.raw
        .post('/hr/allocations', {
          domain,
          offset: page * PAGE_SIZE,
          limit: PAGE_SIZE,
          order,
        })
        .then(r => r.data),
  })

  const records: AllocationRecord[] = data?.records ?? []
  const total: number = data?.total ?? 0

  const columns: Column<AllocationRecord>[] = [
    {
      key: 'employee_id',
      label: 'Employee',
      render: (v) => (Array.isArray(v) ? v[1] : '—'),
    },
    {
      key: 'holiday_status_id',
      label: 'Leave Type',
      render: (v) => (Array.isArray(v) ? v[1] : '—'),
    },
    {
      key: 'number_of_days',
      label: 'Days',
      align: 'right' as const,
      render: (v: number) => (
        <span className="tabular-nums">{typeof v === 'number' ? v : '—'}</span>
      ),
    },
    {
      key: 'date_from',
      label: 'Valid From',
      render: (v) => fmtDate(v),
    },
    {
      key: 'date_to',
      label: 'Valid To',
      render: (v) => fmtDate(v),
    },
    {
      key: 'state',
      label: 'Status',
      render: (v: AllocationState) => {
        const cfg = STATE_CONFIG[v] ?? STATE_CONFIG.draft
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>
      },
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Leave Allocations"
        subtitle={isLoading ? undefined : `${total} record${total !== 1 ? 's' : ''}`}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <SearchBar
            placeholder="Search allocations..."
            onSearch={v => { setSearch(v); setPage(0) }}
          />
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-muted/40 p-1 shrink-0">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setPage(0) }}
              className={[
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150',
                tab === t.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

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
        rowLink={row => `/hr/allocations/${row.id}`}
        emptyMessage="No allocations found"
        emptyIcon={<CalendarCheck className="h-10 w-10" />}
      />
    </div>
  )
}
