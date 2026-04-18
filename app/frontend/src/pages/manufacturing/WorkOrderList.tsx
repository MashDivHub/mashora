import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge, cn, type BadgeVariant } from '@mashora/design-system'
import { ClipboardList } from 'lucide-react'
import { DataTable, PageHeader, SearchBar, type Column, type FilterOption } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface WorkOrder {
  id: number
  name: string
  state: string
  production_id: [number, string]
  workcenter_id: [number, string]
  product_id: [number, string]
  qty_producing: number
  qty_produced: number
  qty_remaining: number
  date_start: string | false
  date_finished: string | false
  duration_expected: number
  duration: number
}

interface WorkOrderListResponse {
  records: WorkOrder[]
  total: number
}

const STATE_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  pending:  { label: 'Pending',     variant: 'secondary' },
  waiting:  { label: 'Waiting',     variant: 'info' },
  ready:    { label: 'Ready',       variant: 'warning' },
  progress: { label: 'In Progress', variant: 'success' },
  done:     { label: 'Done',        variant: 'default' },
  cancel:   { label: 'Cancelled',   variant: 'destructive' },
}

const FILTERS: FilterOption[] = [
  { key: 'ready',    label: 'Ready',       domain: [['state', '=', 'ready']] },
  { key: 'progress', label: 'In Progress', domain: [['state', '=', 'progress']] },
  { key: 'done',     label: 'Done',        domain: [['state', '=', 'done']] },
]

function formatDuration(minutes: number): string {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export default function WorkOrderList() {
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const pageSize = 40

  const stateFilter = activeFilters.length
    ? activeFilters.map(k => k === 'progress' ? 'progress' : k)
    : undefined

  const { data, isLoading } = useQuery<WorkOrderListResponse>({
    queryKey: ['manufacturing', 'workorders', search, activeFilters, page],
    queryFn: () =>
      erpClient.raw.post('/manufacturing/workorders', {
        state: stateFilter,
        search: search || undefined,
        offset: page * pageSize,
        limit: pageSize,
      }).then((r) => r.data).catch(() => ({ records: [], total: 0 })),
  })

  const columns: Column<WorkOrder>[] = [
    {
      key: 'name',
      label: 'Operation',
      render: (_, row) => <span className="font-medium text-sm">{row.name}</span>,
    },
    {
      key: 'production_id',
      label: 'Production',
      format: (v) => Array.isArray(v) ? v[1] : '',
    },
    {
      key: 'workcenter_id',
      label: 'Work Center',
      format: (v) => Array.isArray(v) ? v[1] : '',
    },
    {
      key: 'product_id',
      label: 'Product',
      format: (v) => Array.isArray(v) ? v[1] : '',
    },
    {
      key: 'qty_produced',
      label: 'Progress',
      align: 'center',
      render: (_, row) => (
        <span className="tabular-nums text-sm">
          {row.qty_produced}/{row.qty_producing}
        </span>
      ),
    },
    {
      key: 'duration',
      label: 'Duration',
      align: 'right',
      render: (_, row) => (
        <span className="tabular-nums text-sm">
          {formatDuration(row.duration || row.duration_expected)}
        </span>
      ),
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

  return (
    <div className="space-y-4">
      <PageHeader title="Work Orders" subtitle="manufacturing" />
      <SearchBar
        placeholder="Search work orders..."
        onSearch={(v) => { setSearch(v); setPage(0) }}
        filters={FILTERS}
        activeFilters={activeFilters}
        onFilterToggle={(k) => {
          setActiveFilters((prev) =>
            prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]
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
        loading={isLoading}
        emptyMessage="No work orders found"
        emptyIcon={<ClipboardList className="h-10 w-10" />}
      />
    </div>
  )
}
