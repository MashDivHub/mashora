import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, type BadgeVariant } from '@mashora/design-system'
import { RefreshCcw } from 'lucide-react'
import {
  DataTable, PageHeader, SearchBar,
  type Column, type FilterOption,
} from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface SubRow {
  id: number
  name: string
  code: string | false
  partner_id: [number, string] | false
  template_id: [number, string] | false
  recurring_interval: number
  recurring_rule_type: string
  next_invoice_date: string | false
  state: string
  recurring_total: number | false
}

const STATE_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  in_progress: { label: 'In Progress', variant: 'success' },
  paused: { label: 'Paused', variant: 'warning' },
  closed: { label: 'Closed', variant: 'default' },
  cancel: { label: 'Cancelled', variant: 'destructive' },
}

const FILTERS: FilterOption[] = [
  { key: 'draft', label: 'Draft', domain: [['state', '=', 'draft']] },
  { key: 'in_progress', label: 'In Progress', domain: [['state', '=', 'in_progress']] },
  { key: 'paused', label: 'Paused', domain: [['state', '=', 'paused']] },
  { key: 'closed', label: 'Closed', domain: [['state', '=', 'closed']] },
]

const RULE_LABEL: Record<string, string> = {
  day: 'day(s)', week: 'week(s)', month: 'month(s)', year: 'year(s)',
}

export default function SubscriptionList() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const partnerFilter = searchParams.get('partner')
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>('date_start')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const pageSize = 40

  const domain: unknown[] = []
  if (partnerFilter) domain.push(['partner_id', '=', parseInt(partnerFilter)])
  if (search) domain.push('|', ['name', 'ilike', search], ['partner_id.name', 'ilike', search])
  for (const key of activeFilters) {
    const f = FILTERS.find(fl => fl.key === key)
    if (f?.domain) domain.push(...f.domain)
  }

  const order = sortField ? `${sortField} ${sortDir}` : 'date_start desc'

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['subscriptions', domain, page, order],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/sale.subscription', {
        domain: domain.length ? domain : undefined,
        fields: ['id', 'name', 'code', 'partner_id', 'template_id', 'recurring_interval', 'recurring_rule_type', 'next_invoice_date', 'state', 'recurring_total'],
        offset: page * pageSize,
        limit: pageSize,
        order,
      })
      return data
    },
  })

  const records: SubRow[] = data?.records || []

  const columns: Column<SubRow>[] = [
    {
      key: 'code', label: 'Code',
      render: (v, row) => <span className="font-mono text-sm">{v || row.name}</span>,
    },
    {
      key: 'partner_id', label: 'Customer',
      format: (v) => Array.isArray(v) ? v[1] : '—',
    },
    {
      key: 'template_id', label: 'Template',
      format: (v) => Array.isArray(v) ? v[1] : '—',
    },
    {
      key: 'recurring_interval', label: 'Recurrence', align: 'center',
      render: (_v, row) => (
        <span className="text-sm">
          Every {row.recurring_interval} {RULE_LABEL[row.recurring_rule_type] || row.recurring_rule_type}
        </span>
      ),
    },
    {
      key: 'next_invoice_date', label: 'Next Invoice', sortable: true,
      format: (v) => v ? new Date(v as string).toLocaleDateString() : '—',
    },
    {
      key: 'state', label: 'Status',
      render: (v) => {
        const s = STATE_BADGE[v as string] || { label: v as string, variant: 'secondary' as BadgeVariant }
        return <Badge variant={s.variant} className="rounded-full text-xs">{s.label}</Badge>
      },
    },
    {
      key: 'recurring_total', label: 'Total', align: 'right',
      format: (v) => v != null && v !== false ? `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—',
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Subscriptions"
        subtitle={partnerFilter ? 'filtered by partner' : 'recurring sales'}
        onNew={() => navigate('/admin/sales/subscriptions/new')}
      />
      <SearchBar
        placeholder="Search subscriptions..."
        onSearch={(v) => { setSearch(v); setPage(0) }}
        filters={FILTERS}
        activeFilters={activeFilters}
        onFilterToggle={k => { setActiveFilters(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]); setPage(0) }}
      />
      <DataTable
        columns={columns}
        data={records}
        total={data?.total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        sortField={sortField}
        sortDir={sortDir}
        onSort={(f, d) => { setSortField(f); setSortDir(d) }}
        loading={isLoading}
        isError={isError} error={error} onRetry={() => refetch()}
        rowLink={(row) => `/admin/sales/subscriptions/${row.id}`}
        emptyMessage="No subscriptions found"
        emptyIcon={<RefreshCcw className="h-10 w-10" />}
      />
    </div>
  )
}
