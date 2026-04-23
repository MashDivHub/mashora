import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button, type BadgeVariant } from '@mashora/design-system'
import { RefreshCcw, Plus, FileText } from 'lucide-react'
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

  const { data: templateData } = useQuery({
    queryKey: ['subscription-template-count'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/sale.subscription.template', {
        fields: ['id'],
        limit: 1,
      })
      return data
    },
    staleTime: 60_000,
  })
  const templateCount: number = templateData?.total ?? (templateData?.records?.length ?? 0)

  const records: SubRow[] = data?.records || []
  const hasFilters = !!search || activeFilters.length > 0 || !!partnerFilter
  const showEmptyCta = !isLoading && !isError && records.length === 0 && page === 0 && !hasFilters

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
      {showEmptyCta ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-12 text-center space-y-4">
          <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-primary">
            {templateCount === 0 ? <FileText className="h-6 w-6" /> : <RefreshCcw className="h-6 w-6" />}
          </div>
          <div>
            {templateCount === 0 ? (
              <>
                <p className="text-sm font-semibold">Create a subscription template first</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Subscriptions need a recurring plan template before they can be issued.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold">No subscriptions yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Start a new recurring subscription for a customer.
                </p>
              </>
            )}
          </div>
          <Button
            onClick={() => navigate(templateCount === 0 ? '/admin/sales/subscription-templates' : '/admin/sales/subscriptions/new')}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            {templateCount === 0 ? 'Create First Template' : 'New Subscription'}
          </Button>
        </div>
      ) : (
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
      )}
    </div>
  )
}
