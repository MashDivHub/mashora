import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { DataTable, PageHeader, SearchBar } from '@/components/shared'
import type { Column } from '@/components/shared/DataTable'
import { Badge } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { Receipt } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExpenseRecord {
  id: number
  name: string
  employee_id: [number, string]
  product_id: [number, string] | false
  unit_amount: number
  quantity: number
  total_amount: number
  date: string
  state: string
  payment_mode: string
  sheet_id: [number, string] | false
}

type FilterKey = 'all' | 'draft' | 'reported' | 'approved'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATE_CONFIG: Record<string, { label: string; className: string }> = {
  draft: {
    label: 'New',
    className: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
  },
  reported: {
    label: 'Reported',
    className: 'bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400',
  },
  approved: {
    label: 'Approved',
    className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
  },
  done: {
    label: 'Paid',
    className: 'bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400',
  },
  refused: {
    label: 'Refused',
    className: 'bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400',
  },
}

const FILTER_DOMAINS: Record<FilterKey, any[]> = {
  all: [],
  draft: [['state', '=', 'draft']],
  reported: [['state', '=', 'reported']],
  approved: [['state', '=', 'approved']],
}

const FILTERS = [
  { key: 'all', label: 'All', domain: [] },
  { key: 'draft', label: 'Draft', domain: [['state', '=', 'draft']] },
  { key: 'reported', label: 'Reported', domain: [['state', '=', 'reported']] },
  { key: 'approved', label: 'Approved', domain: [['state', '=', 'approved']] },
]

function fmtAmount(amount: number): string {
  return `$${amount.toFixed(2)}`
}

// ─── Column definitions ───────────────────────────────────────────────────────

const columns: Column<ExpenseRecord>[] = [
  {
    key: 'name',
    label: 'Description',
    render: (_val, row) => <span className="font-medium">{row.name}</span>,
  },
  {
    key: 'employee_id',
    label: 'Employee',
    render: (_val, row) => row.employee_id[1],
  },
  {
    key: 'date',
    label: 'Date',
    render: (_val, row) => row.date,
  },
  {
    key: 'total_amount',
    label: 'Amount',
    render: (_val, row) => (
      <span className="font-mono">{fmtAmount(row.total_amount)}</span>
    ),
  },
  {
    key: 'payment_mode',
    label: 'Payment Mode',
    render: (_val, row) => row.payment_mode,
  },
  {
    key: 'sheet_id',
    label: 'Report',
    render: (_val, row) =>
      row.sheet_id ? (
        row.sheet_id[1]
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    key: 'state',
    label: 'Status',
    render: (_val, row) => {
      const cfg = STATE_CONFIG[row.state] ?? STATE_CONFIG.draft
      return (
        <Badge
          className={`rounded-full border text-xs font-medium ${cfg.className}`}
        >
          {cfg.label}
        </Badge>
      )
    },
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 40

export default function ExpenseList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')

  const domain = FILTER_DOMAINS[activeFilter]

  const { data, isLoading } = useQuery({
    queryKey: ['hr-expenses', search, page, activeFilter],
    queryFn: () =>
      erpClient.raw
        .post('/hr/expenses', {
          domain: search
            ? [...domain, ['name', 'ilike', search]]
            : domain,
          offset: page * PAGE_SIZE,
          limit: PAGE_SIZE,
          order: 'date desc',
        })
        .then((r) => r.data),
  })

  const records: ExpenseRecord[] = data?.records ?? []
  const total: number = data?.total ?? 0

  const handleSearch = (q: string) => {
    setSearch(q)
    setPage(0)
  }

  const handleFilterToggle = (key: string) => {
    setActiveFilter(key as FilterKey)
    setPage(0)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        subtitle={isLoading ? 'Loading…' : `${total} expense${total !== 1 ? 's' : ''}`}
        onNew={() => navigate('/hr/expenses/new')}
      />

      <SearchBar
        placeholder="Search expenses..."
        onSearch={handleSearch}
        filters={FILTERS}
        activeFilters={activeFilter !== 'all' ? [activeFilter] : []}
        onFilterToggle={handleFilterToggle}
      />

      <DataTable<ExpenseRecord>
        columns={columns}
        data={records}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        loading={isLoading}
        emptyMessage="No expenses found"
        emptyIcon={<Receipt className="size-6" />}
        onRowClick={(row) => navigate(`/hr/expenses/${row.id}`)}
      />
    </div>
  )
}
