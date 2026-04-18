import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { DataTable, PageHeader, SearchBar } from '@/components/shared'
import type { Column } from '@/components/shared/DataTable'
import { Badge } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { FileSignature } from 'lucide-react'

interface ContractRecord {
  id: number
  name: string
  employee_id: [number, string] | false
  department_id: [number, string] | false
  job_id: [number, string] | false
  date_start: string | false
  date_end: string | false
  state: string
  wage: number | false
  contract_type: string | false
}

type FilterKey = 'all' | 'draft' | 'open' | 'close' | 'cancel'

const STATE_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20' },
  open: { label: 'Running', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400' },
  close: { label: 'Expired', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400' },
  cancel: { label: 'Cancelled', className: 'bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400' },
}

const FILTERS = [
  { key: 'all', label: 'All', domain: [] },
  { key: 'draft', label: 'Draft', domain: [['state', '=', 'draft']] },
  { key: 'open', label: 'Running', domain: [['state', '=', 'open']] },
  { key: 'close', label: 'Expired', domain: [['state', '=', 'close']] },
  { key: 'cancel', label: 'Cancelled', domain: [['state', '=', 'cancel']] },
]

const FILTER_DOMAINS: Record<FilterKey, any[]> = {
  all: [],
  draft: [['state', '=', 'draft']],
  open: [['state', '=', 'open']],
  close: [['state', '=', 'close']],
  cancel: [['state', '=', 'cancel']],
}

function fmtDate(v: string | false): string {
  if (!v) return '—'
  return v.split(' ')[0]
}

function fmtAmount(v: number | false): string {
  if (typeof v !== 'number') return '—'
  return `$${v.toFixed(2)}`
}

const columns: Column<ContractRecord>[] = [
  {
    key: 'name',
    label: 'Reference',
    render: (_v, row) => <span className="font-medium">{row.name}</span>,
  },
  {
    key: 'employee_id',
    label: 'Employee',
    render: (v) => (Array.isArray(v) ? v[1] : '—'),
  },
  {
    key: 'job_id',
    label: 'Job Position',
    render: (v) => (Array.isArray(v) ? v[1] : '—'),
  },
  {
    key: 'date_start',
    label: 'Start Date',
    render: (v) => fmtDate(v),
  },
  {
    key: 'date_end',
    label: 'End Date',
    render: (v) => fmtDate(v),
  },
  {
    key: 'wage',
    label: 'Wage',
    align: 'right' as const,
    render: (v) => <span className="font-mono tabular-nums">{fmtAmount(v)}</span>,
  },
  {
    key: 'state',
    label: 'Status',
    render: (v: string) => {
      const cfg = STATE_CONFIG[v] ?? STATE_CONFIG.draft
      return <Badge className={`rounded-full border text-xs font-medium ${cfg.className}`}>{cfg.label}</Badge>
    },
  },
]

const PAGE_SIZE = 40

export default function ContractList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')

  const domain = FILTER_DOMAINS[activeFilter]

  const { data, isLoading } = useQuery({
    queryKey: ['hr-contracts', search, page, activeFilter],
    queryFn: () =>
      erpClient.raw
        .post('/model/hr.contract', {
          domain: search ? [...domain, ['name', 'ilike', search]] : domain,
          fields: ['id', 'name', 'employee_id', 'department_id', 'job_id', 'date_start', 'date_end', 'state', 'wage', 'contract_type'],
          offset: page * PAGE_SIZE,
          limit: PAGE_SIZE,
          order: 'date_start desc',
        })
        .then((r) => r.data),
  })

  const records: ContractRecord[] = data?.records ?? []
  const total: number = data?.total ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contracts"
        subtitle={isLoading ? 'Loading…' : `${total} contract${total !== 1 ? 's' : ''}`}
        onNew={() => navigate('/admin/hr/contracts/new')}
      />

      <SearchBar
        placeholder="Search contracts..."
        onSearch={(q) => { setSearch(q); setPage(0) }}
        filters={FILTERS}
        activeFilters={activeFilter !== 'all' ? [activeFilter] : []}
        onFilterToggle={(k) => { setActiveFilter(k as FilterKey); setPage(0) }}
      />

      <DataTable<ContractRecord>
        columns={columns}
        data={records}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        loading={isLoading}
        emptyMessage="No contracts found"
        emptyIcon={<FileSignature className="size-6" />}
        onRowClick={(row) => navigate(`/admin/hr/contracts/${row.id}`)}
      />
    </div>
  )
}
