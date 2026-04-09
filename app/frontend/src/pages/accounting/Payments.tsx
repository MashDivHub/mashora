import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, cn } from '@mashora/design-system'
import { CreditCard } from 'lucide-react'
import { DataTable, PageHeader, SearchBar, type Column, type FilterOption } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

const LIST_FIELDS = [
  'id', 'name', 'partner_id', 'amount', 'date', 'state', 'payment_type',
  'partner_type', 'journal_id', 'currency_id', 'payment_method_line_id',
]

const STATE_BADGE: Record<string, { label: string; variant: string }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  posted: { label: 'Posted', variant: 'success' },
  cancel: { label: 'Cancelled', variant: 'destructive' },
}

const FILTERS: FilterOption[] = [
  { key: 'inbound', label: 'Received', domain: [['payment_type', '=', 'inbound']] },
  { key: 'outbound', label: 'Sent', domain: [['payment_type', '=', 'outbound']] },
  { key: 'draft', label: 'Draft', domain: [['state', '=', 'draft']] },
  { key: 'posted', label: 'Posted', domain: [['state', '=', 'posted']] },
]

export default function Payments() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const pageSize = 40

  const domain: any[] = []
  if (search) domain.push('|', ['name', 'ilike', search], ['partner_id', 'ilike', search])
  for (const key of activeFilters) {
    const f = FILTERS.find(fl => fl.key === key)
    if (f) domain.push(...f.domain)
  }

  const order = sortField ? `${sortField} ${sortDir}` : 'date desc'

  const { data, isLoading } = useQuery({
    queryKey: ['payments', domain, page, order],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/account.payment', {
        domain: domain.length ? domain : undefined,
        fields: LIST_FIELDS, offset: page * pageSize, limit: pageSize, order,
      })
      return data
    },
  })

  const columns: Column[] = [
    { key: 'name', label: 'Number', render: (_, row) => <span className="font-mono text-sm">{row.name || 'Draft'}</span> },
    { key: 'partner_id', label: 'Partner', format: v => Array.isArray(v) ? v[1] : '' },
    { key: 'date', label: 'Date', format: v => v ? new Date(v).toLocaleDateString() : '' },
    { key: 'journal_id', label: 'Journal', format: v => Array.isArray(v) ? v[1] : '' },
    { key: 'payment_type', label: 'Type', render: v => (
      <Badge variant={v === 'inbound' ? 'default' : 'secondary'} className="rounded-full text-xs">
        {v === 'inbound' ? 'Received' : 'Sent'}
      </Badge>
    )},
    { key: 'state', label: 'Status', render: v => {
      const s = STATE_BADGE[v] || { label: v, variant: 'secondary' }
      return <Badge variant={s.variant as any} className="rounded-full text-xs">{s.label}</Badge>
    }},
    { key: 'amount', label: 'Amount', align: 'right' as const, format: v => v ? `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '' },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Payments" subtitle="invoicing" />
      <SearchBar placeholder="Search payments..." onSearch={v => { setSearch(v); setPage(0) }}
        filters={FILTERS} activeFilters={activeFilters}
        onFilterToggle={k => { setActiveFilters(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]); setPage(0) }} />
      <DataTable columns={columns} data={data?.records || []} total={data?.total} page={page} pageSize={pageSize}
        onPageChange={setPage} sortField={sortField} sortDir={sortDir}
        onSort={(f, d) => { setSortField(f); setSortDir(d) }} loading={isLoading}
        emptyMessage="No payments found" emptyIcon={<CreditCard className="h-10 w-10" />} />
    </div>
  )
}
