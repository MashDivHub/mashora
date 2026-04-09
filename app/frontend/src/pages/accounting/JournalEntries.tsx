import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@mashora/design-system'
import { BookOpen } from 'lucide-react'
import { DataTable, PageHeader, SearchBar, type Column, type FilterOption } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface JournalEntry {
  id: number
  name: string
  ref: string | false
  date: string
  journal_id: [number, string]
  state: string
  amount_total: number
  partner_id: [number, string] | false
}

const STATE_BADGE: Record<string, { label: string; variant: string }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  posted: { label: 'Posted', variant: 'success' },
}

const FILTERS: FilterOption[] = [
  { key: 'draft', label: 'Draft', domain: [['state', '=', 'draft']] },
  { key: 'posted', label: 'Posted', domain: [['state', '=', 'posted']] },
]

export default function JournalEntries() {
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const pageSize = 40

  const domain: any[] = []
  if (search) domain.push('|', ['name', 'ilike', search], ['ref', 'ilike', search])
  for (const key of activeFilters) {
    const f = FILTERS.find((fl) => fl.key === key)
    if (f?.domain) domain.push(...f.domain)
  }

  const order = sortField ? `${sortField} ${sortDir}` : 'date desc'

  const { data, isLoading } = useQuery({
    queryKey: ['journal-entries', domain, page, order],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/accounting/journal-entries', domain.length ? { domain } : null, {
        params: { offset: page * pageSize, limit: pageSize, order },
      })
      return data
    },
  })

  const columns: Column[] = [
    {
      key: 'name',
      label: 'Number',
      render: (_, row: JournalEntry) => (
        <span className="font-mono text-sm">{row.name || 'Draft'}</span>
      ),
    },
    {
      key: 'ref',
      label: 'Reference',
      format: (v) => (v ? String(v) : ''),
    },
    {
      key: 'date',
      label: 'Date',
      format: (v) => (v ? new Date(v).toLocaleDateString() : ''),
    },
    {
      key: 'journal_id',
      label: 'Journal',
      format: (v) => (Array.isArray(v) ? v[1] : ''),
    },
    {
      key: 'partner_id',
      label: 'Partner',
      render: (v) => (
        <span className="text-sm">
          {Array.isArray(v) ? v[1] : <span className="text-muted-foreground">&mdash;</span>}
        </span>
      ),
    },
    {
      key: 'amount_total',
      label: 'Amount',
      align: 'right' as const,
      format: (v) =>
        v != null
          ? `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
          : '',
    },
    {
      key: 'state',
      label: 'Status',
      render: (v) => {
        const s = STATE_BADGE[v] ?? { label: v, variant: 'secondary' }
        return (
          <Badge variant={s.variant as any} className="rounded-full text-xs">
            {s.label}
          </Badge>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Journal Entries" subtitle="accounting" />
      <SearchBar
        placeholder="Search entries..."
        onSearch={(v) => { setSearch(v); setPage(0) }}
        filters={FILTERS}
        activeFilters={activeFilters}
        onFilterToggle={(k) => {
          setActiveFilters((p) =>
            p.includes(k) ? p.filter((x) => x !== k) : [...p, k],
          )
          setPage(0)
        }}
      />
      <DataTable
        columns={columns}
        data={data?.records ?? []}
        total={data?.total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        sortField={sortField}
        sortDir={sortDir}
        onSort={(f, d) => { setSortField(f); setSortDir(d) }}
        loading={isLoading}
        emptyMessage="No journal entries found"
        emptyIcon={<BookOpen className="h-10 w-10" />}
      />
    </div>
  )
}
