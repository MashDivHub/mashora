import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge, Button, type BadgeVariant } from '@mashora/design-system'
import { BookOpen, Plus } from 'lucide-react'
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

const STATE_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  posted: { label: 'Posted', variant: 'success' },
}

const FILTERS: FilterOption[] = [
  { key: 'draft', label: 'Draft', domain: [['state', '=', 'draft']] },
  { key: 'posted', label: 'Posted', domain: [['state', '=', 'posted']] },
]

export default function JournalEntries() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const journalParam = searchParams.get('journal')
  const journalFilterId = journalParam ? Number(journalParam) : null

  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const pageSize = 40

  const domain: unknown[] = []
  if (journalFilterId && !Number.isNaN(journalFilterId)) {
    domain.push(['journal_id', '=', journalFilterId])
  }
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

  const columns: Column<JournalEntry>[] = [
    {
      key: 'name',
      label: 'Number',
      render: (_, row) => (
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
        const s = STATE_BADGE[v] ?? { label: v, variant: 'secondary' as BadgeVariant }
        return (
          <Badge variant={s.variant} className="rounded-full text-xs">
            {s.label}
          </Badge>
        )
      },
    },
  ]

  const records = data?.records ?? []
  const hasFilters = !!search || activeFilters.length > 0 || !!journalFilterId
  const showEmptyCta = !isLoading && records.length === 0 && page === 0 && !hasFilters
  const createPath = journalFilterId
    ? `/admin/model/account.move/new?journal_id=${journalFilterId}`
    : '/admin/model/account.move/new'
  const handleCreate = () => navigate(createPath)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Journal Entries"
        subtitle="accounting"
        actions={
          <Button size="sm" className="rounded-xl gap-1.5" onClick={handleCreate}>
            <Plus className="h-3.5 w-3.5" /> New Entry
          </Button>
        }
      />
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
      {showEmptyCta ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-12 text-center space-y-4">
          <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-primary">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">No journal entries yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Record your first journal entry to start your accounting ledger.
            </p>
          </div>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Create First Entry
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
          rowLink={row => `/admin/model/account.move/${row.id}`}
          emptyMessage="No journal entries found"
          emptyIcon={<BookOpen className="h-10 w-10" />}
        />
      )}
    </div>
  )
}
