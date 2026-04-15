import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { DataTable, PageHeader, SearchBar } from '@/components/shared'
import type { Column } from '@/components/shared/DataTable'
import { Badge } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { Receipt } from 'lucide-react'

/* ── Types ── */
type OrderState = 'draft' | 'paid' | 'done' | 'cancel'

interface PosOrder {
  id: number
  name: string
  state: OrderState
  session_id: [number, string]
  partner_id: [number, string] | false
  date_order: string
  amount_total: number
  amount_tax: number
  amount_paid: number
  amount_return: number
  pos_reference: string
  employee_id: [number, string] | false
}

interface PosOrdersResponse {
  records: PosOrder[]
  total: number
}

/* ── Helpers ── */
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

function formatDate(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value)
}

/* ── Columns ── */
const columns: Column<PosOrder>[] = [
  {
    key: 'name',
    label: 'Order',
    className: 'font-mono',
  },
  {
    key: 'pos_reference',
    label: 'Reference',
    render: (val: string) => val || <span className="text-muted-foreground/50">—</span>,
  },
  {
    key: 'partner_id',
    label: 'Customer',
    render: (val: [number, string] | false) =>
      val ? val[1] : <span className="text-muted-foreground/60">Walk-in</span>,
  },
  {
    key: 'employee_id',
    label: 'Cashier',
    render: (val: [number, string] | false) =>
      val ? val[1] : <span className="text-muted-foreground/50">—</span>,
  },
  {
    key: 'date_order',
    label: 'Date',
    format: (val: string) => formatDate(val),
  },
  {
    key: 'amount_total',
    label: 'Total',
    align: 'right',
    className: 'font-mono',
    render: (val: number) => (
      <span className="tabular-nums">{formatCurrency(val)}</span>
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

/* ── Component ── */
export default function PosOrderList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [tab, setTab] = useState<string>('all')
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>('date_order')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  /* debounce search */
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(0)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [search])

  /* reset page on filter/tab change */
  const handleTabToggle = (key: string) => {
    setTab(prev => (prev === key ? 'all' : key))
    setPage(0)
  }

  const stateFilter = tab !== 'all' ? [tab] : []

  const { data, isLoading } = useQuery<PosOrdersResponse>({
    queryKey: ['pos-orders', tab, debouncedSearch, page, sortField, sortDir],
    queryFn: () =>
      erpClient.raw
        .post('/pos/orders', {
          state: stateFilter,
          search: debouncedSearch,
          offset: page * 40,
          limit: 40,
        })
        .then(r => r.data),
    staleTime: 30_000,
  })

  const records = data?.records ?? []
  const total = data?.total ?? 0

  const handleSort = (field: string, dir: 'asc' | 'desc') => {
    setSortField(field)
    setSortDir(dir)
    setPage(0)
  }

  const subtitleText = isLoading ? 'loading…' : `${total.toLocaleString()} order${total !== 1 ? 's' : ''}`

  return (
    <div className="space-y-4">
      <PageHeader title="POS Orders" subtitle={subtitleText} />

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
        emptyMessage="No orders found"
        onRowClick={(row) => navigate(`/admin/pos/orders/${row.id}`)}
      />
    </div>
  )
}
