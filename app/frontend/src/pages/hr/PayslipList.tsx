import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { DataTable, PageHeader, SearchBar } from '@/components/shared'
import type { Column } from '@/components/shared/DataTable'
import { Badge } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { FileText } from 'lucide-react'

interface PayslipRecord {
  id: number
  name: string
  number: string | false
  employee_id: [number, string] | false
  contract_id: [number, string] | false
  date_from: string | false
  date_to: string | false
  state: string
  basic_wage: number | false
  gross_wage: number | false
  net_wage: number | false
}

type FilterKey = 'all' | 'draft' | 'verify' | 'done' | 'cancel'

const STATE_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20' },
  verify: { label: 'Waiting', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400' },
  done: { label: 'Done', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400' },
  cancel: { label: 'Cancelled', className: 'bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400' },
}

const FILTERS = [
  { key: 'all', label: 'All', domain: [] },
  { key: 'draft', label: 'Draft', domain: [['state', '=', 'draft']] },
  { key: 'verify', label: 'Waiting', domain: [['state', '=', 'verify']] },
  { key: 'done', label: 'Done', domain: [['state', '=', 'done']] },
  { key: 'cancel', label: 'Cancelled', domain: [['state', '=', 'cancel']] },
]

const DOMAINS: Record<FilterKey, any[]> = {
  all: [], draft: [['state', '=', 'draft']], verify: [['state', '=', 'verify']],
  done: [['state', '=', 'done']], cancel: [['state', '=', 'cancel']],
}

function fmtDate(v: string | false): string {
  if (!v) return '—'
  return v.split(' ')[0]
}

function fmtAmount(v: number | false): string {
  if (typeof v !== 'number') return '—'
  return `$${v.toFixed(2)}`
}

const PAGE_SIZE = 40

export default function PayslipList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState<FilterKey>('all')

  const domain = DOMAINS[filter]

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['hr-payslips', search, page, filter],
    queryFn: () =>
      erpClient.raw
        .post('/model/hr.payslip', {
          domain: search ? [...domain, ['name', 'ilike', search]] : domain,
          fields: ['id', 'name', 'number', 'employee_id', 'contract_id', 'date_from', 'date_to', 'state', 'basic_wage', 'gross_wage', 'net_wage'],
          offset: page * PAGE_SIZE,
          limit: PAGE_SIZE,
          order: 'date_from desc',
        })
        .then((r) => r.data),
  })

  const records: PayslipRecord[] = data?.records ?? []
  const total: number = data?.total ?? 0

  const columns: Column<PayslipRecord>[] = [
    { key: 'number', label: 'Reference', render: (_v, row) => <span className="font-medium">{row.number || row.name}</span> },
    { key: 'employee_id', label: 'Employee', render: (v) => (Array.isArray(v) ? v[1] : '—') },
    { key: 'date_from', label: 'From', render: (v) => fmtDate(v) },
    { key: 'date_to', label: 'To', render: (v) => fmtDate(v) },
    { key: 'gross_wage', label: 'Gross', align: 'right' as const, render: (v) => <span className="font-mono tabular-nums">{fmtAmount(v)}</span> },
    { key: 'net_wage', label: 'Net', align: 'right' as const, render: (v) => <span className="font-mono tabular-nums">{fmtAmount(v)}</span> },
    {
      key: 'state', label: 'Status', render: (v: string) => {
        const cfg = STATE_CONFIG[v] ?? STATE_CONFIG.draft
        return <Badge className={`rounded-full border text-xs font-medium ${cfg.className}`}>{cfg.label}</Badge>
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payslips"
        subtitle={isLoading ? 'Loading…' : `${total} payslip${total !== 1 ? 's' : ''}`}
        onNew={() => navigate('/admin/hr/payslips/new')}
      />

      <SearchBar
        placeholder="Search payslips..."
        onSearch={(q) => { setSearch(q); setPage(0) }}
        filters={FILTERS}
        activeFilters={filter !== 'all' ? [filter] : []}
        onFilterToggle={(k) => { setFilter(k as FilterKey); setPage(0) }}
      />

      <DataTable<PayslipRecord>
        columns={columns}
        data={records}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        loading={isLoading}
        isError={isError} error={error} onRetry={() => refetch()}
        emptyMessage="No payslips found"
        emptyIcon={<FileText className="size-6" />}
        onRowClick={(row) => navigate(`/admin/hr/payslips/${row.id}`)}
      />
    </div>
  )
}
