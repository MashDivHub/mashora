import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { DataTable, PageHeader, SearchBar } from '@/components/shared'
import type { Column } from '@/components/shared/DataTable'
import { Badge, Button } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { Receipt, Monitor } from 'lucide-react'
import { fmtMoney, fmtRelativeTime } from './utils'

type OrderState = 'draft' | 'paid' | 'done' | 'cancel'

interface PosOrder {
  id: number
  name: string
  state: OrderState
  session_id: [number, string] | number | false
  partner_id: [number, string] | number | false | null
  date_order: string
  amount_total: number
  amount_tax: number
  amount_paid: number
  amount_return: number
  pos_reference: string
  user_id?: [number, string] | number | false
}

interface PosOrdersResponse {
  records: PosOrder[]
  total: number
}

const STATE_LABELS: Record<OrderState, string> = {
  draft: 'New',
  paid: 'Paid',
  done: 'Posted',
  cancel: 'Cancelled',
}

const STATE_VARIANTS: Record<OrderState, 'success' | 'default' | 'secondary' | 'destructive'> = {
  paid: 'success',
  done: 'default',
  draft: 'secondary',
  cancel: 'destructive',
}

const columns: Column<PosOrder>[] = [
  {
    key: 'name',
    label: 'Order',
    className: 'font-mono',
    render: (val: string) => <span className="font-mono font-medium text-sm">{val}</span>,
  },
  {
    key: 'pos_reference',
    label: 'Reference',
    render: (val: string) => val
      ? <span className="text-xs font-mono text-muted-foreground">{val}</span>
      : <span className="text-muted-foreground/50">—</span>,
  },
  {
    key: 'session_id',
    label: 'Session',
    render: (val: [number, string] | number | false) =>
      Array.isArray(val)
        ? <span className="text-sm">{val[1]}</span>
        : val
          ? <span className="text-sm">#{val}</span>
          : <span className="text-muted-foreground/50">—</span>,
  },
  {
    key: 'partner_id',
    label: 'Customer',
    render: (val: [number, string] | number | false | null) =>
      Array.isArray(val)
        ? val[1]
        : val
          ? `#${val}`
          : <span className="text-muted-foreground/60">Walk-in</span>,
  },
  {
    key: 'date_order',
    label: 'Date',
    render: (val: string) => (
      <span title={val ? new Date(val).toLocaleString() : ''} className="text-sm text-muted-foreground">
        {fmtRelativeTime(val)}
      </span>
    ),
  },
  {
    key: 'amount_total',
    label: 'Total',
    align: 'right',
    className: 'tabular-nums font-medium',
    render: (val: number) => (
      <span className="tabular-nums">{fmtMoney(val)}</span>
    ),
  },
  {
    key: 'state',
    label: 'Status',
    render: (val: OrderState) => (
      <Badge variant={STATE_VARIANTS[val] ?? 'secondary'}>
        {STATE_LABELS[val] ?? val}
      </Badge>
    ),
  },
]

export default function PosOrderList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [tab, setTab] = useState<string>('all')
  const [sessionFilter, setSessionFilter] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>('date_order')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(0)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [search])

  const handleTabToggle = (key: string) => {
    setTab(prev => (prev === key ? 'all' : key))
    setPage(0)
  }

  const stateFilter = tab !== 'all' ? [tab] : []

  const { data: sessionsData } = useQuery<{ records?: { id: number; name: string }[] }>({
    queryKey: ['pos-sessions', 'for-filter'],
    queryFn: async () => {
      const { data } = await erpClient.raw.get('/pos/sessions', { params: { limit: 100 } })
      return data
    },
    staleTime: 60_000,
  })
  const sessions = sessionsData?.records ?? []

  const { data, isLoading } = useQuery<PosOrdersResponse>({
    queryKey: ['pos-orders', tab, debouncedSearch, page, sortField, sortDir, sessionFilter],
    queryFn: () =>
      erpClient.raw
        .get('/pos/orders', {
          params: {
            ...(stateFilter.length === 1 ? { state: stateFilter[0] } : {}),
            ...(sessionFilter ? { session_id: sessionFilter } : {}),
            offset: page * 40,
            limit: 40,
          },
        })
        .then(r => {
          const records = (r.data?.records ?? []) as PosOrder[]
          const q = debouncedSearch.trim().toLowerCase()
          const filtered = q
            ? records.filter(o =>
                (o.name || '').toLowerCase().includes(q) ||
                (o.pos_reference || '').toLowerCase().includes(q)
              )
            : records
          return { records: filtered, total: q ? filtered.length : (r.data?.total ?? 0) }
        }),
    staleTime: 30_000,
  })

  const records = data?.records ?? []
  const total = data?.total ?? 0

  const handleSort = (field: string, dir: 'asc' | 'desc') => {
    setSortField(field)
    setSortDir(dir)
    setPage(0)
  }

  const subtitleText = isLoading ? 'Loading…' : `${total.toLocaleString()} order${total !== 1 ? 's' : ''}`

  const showGuidedEmpty = !isLoading && total === 0 && tab === 'all' && !debouncedSearch && !sessionFilter

  return (
    <div className="space-y-6">
      <PageHeader title="POS Orders" subtitle={subtitleText} />

      {/* Filter card */}
      <div className="rounded-2xl border border-border/40 bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[240px]">
            <SearchBar
              placeholder="Search orders..."
              onSearch={(q) => { setSearch(q); setPage(0) }}
              filters={[
                { key: 'paid', label: 'Paid', domain: [['state', '=', 'paid']] },
                { key: 'done', label: 'Posted', domain: [['state', '=', 'done']] },
                { key: 'draft', label: 'Draft', domain: [['state', '=', 'draft']] },
              ]}
              activeFilters={tab !== 'all' ? [tab] : []}
              onFilterToggle={handleTabToggle}
            />
          </div>
          <select
            value={sessionFilter ?? ''}
            onChange={e => { setSessionFilter(e.target.value ? Number(e.target.value) : null); setPage(0) }}
            className="h-9 rounded-xl border border-border/40 bg-background px-3 text-sm transition-colors hover:bg-muted/30"
          >
            <option value="">All sessions</option>
            {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {showGuidedEmpty ? (
        <div className="rounded-3xl border border-dashed border-border/40 bg-gradient-to-br from-primary/5 via-background to-emerald-500/5 p-12 text-center space-y-5">
          <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-primary">
            <Receipt className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-bold tracking-tight">No POS orders yet</p>
            <p className="text-sm text-muted-foreground">
              Orders appear here after being rung up on a register.
            </p>
          </div>
          <Button onClick={() => navigate('/admin/pos')} className="gap-2 rounded-xl">
            <Monitor className="h-4 w-4" />
            Go to POS Dashboard
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={records}
          total={total}
          page={page}
          pageSize={40}
          onPageChange={setPage}
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
          loading={isLoading}
          emptyIcon={<Receipt className="h-8 w-8 text-muted-foreground/40" />}
          emptyMessage="No orders match the current filter"
          onRowClick={(row) => navigate(`/admin/pos/orders/${row.id}`)}
        />
      )}
    </div>
  )
}
