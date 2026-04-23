import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { DataTable, PageHeader, SearchBar } from '@/components/shared'
import type { Column } from '@/components/shared/DataTable'
import { Badge } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { Briefcase } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExpenseSheetRecord {
  id: number
  name: string
  employee_id: [number, string]
  expense_line_ids: number[]
  total_amount: number
  state: string
  payment_state: string
  company_id: [number, string]
}

type FilterKey = 'all' | 'submit' | 'approve' | 'done'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATE_CONFIG: Record<string, { label: string; className: string }> = {
  draft: {
    label: 'Draft',
    className: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
  },
  submit: {
    label: 'Submitted',
    className: 'bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400',
  },
  approve: {
    label: 'Approved',
    className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
  },
  done: {
    label: 'Done',
    className: 'bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400',
  },
  cancel: {
    label: 'Cancelled',
    className: 'bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400',
  },
}

const FILTER_DOMAINS: Record<FilterKey, any[]> = {
  all: [],
  submit: [['state', '=', 'submit']],
  approve: [['state', '=', 'approve']],
  done: [['state', '=', 'done']],
}

const FILTERS = [
  { key: 'all', label: 'All', domain: [] },
  { key: 'submit', label: 'Submitted', domain: [['state', '=', 'submit']] },
  { key: 'approve', label: 'Approved', domain: [['state', '=', 'approve']] },
  { key: 'done', label: 'Done', domain: [['state', '=', 'done']] },
]

function fmtAmount(amount: number): string {
  return `$${amount.toFixed(2)}`
}

// ─── Column definitions ───────────────────────────────────────────────────────

const columns: Column<ExpenseSheetRecord>[] = [
  {
    key: 'name',
    label: 'Report',
    render: (_val, row) => <span className="font-medium">{row.name}</span>,
  },
  {
    key: 'employee_id',
    label: 'Employee',
    render: (_val, row) => row.employee_id[1],
  },
  {
    key: 'expense_line_ids',
    label: 'Expenses',
    render: (_val, row) => row.expense_line_ids.length,
  },
  {
    key: 'total_amount',
    label: 'Total',
    render: (_val, row) => (
      <span className="font-mono">{fmtAmount(row.total_amount)}</span>
    ),
  },
  {
    key: 'payment_state',
    label: 'Payment Status',
    render: (_val, row) => row.payment_state,
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

export default function ExpenseSheetList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')

  const domain = FILTER_DOMAINS[activeFilter]

  const { data, isLoading } = useQuery({
    queryKey: ['hr-expense-sheets', search, page, activeFilter],
    queryFn: () =>
      erpClient.raw
        .post('/hr/expense-sheets', {
          domain: search
            ? [...domain, ['name', 'ilike', search]]
            : domain,
          offset: page * PAGE_SIZE,
          limit: PAGE_SIZE,
          order: 'create_date desc',
        })
        .then((r) => r.data),
  })

  const records: ExpenseSheetRecord[] = data?.records ?? []
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
        title="Expense Reports"
        subtitle={isLoading ? 'Loading…' : `${total} report${total !== 1 ? 's' : ''}`}
        onNew={() => navigate('/admin/hr/expense-sheets/new')}
        newLabel="New Report"
      />

      <SearchBar
        placeholder="Search reports..."
        onSearch={handleSearch}
        filters={FILTERS}
        activeFilters={activeFilter !== 'all' ? [activeFilter] : []}
        onFilterToggle={handleFilterToggle}
      />

      <DataTable<ExpenseSheetRecord>
        columns={columns}
        data={records}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        loading={isLoading}
        rowLink={row => `/admin/hr/expense-sheets/${row.id}`}
        emptyMessage="No expense reports found"
        emptyIcon={<Briefcase className="size-6" />}
      />
    </div>
  )
}
