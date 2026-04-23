import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, type BadgeVariant } from '@mashora/design-system'
import { Factory } from 'lucide-react'
import {
  DataTable, PageHeader, SearchBar, KanbanBoard, ViewToggle, GanttChart,
  type Column, type FilterOption, type ViewMode, type KanbanColumn, type KanbanCardData,
} from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface ProductionRecord {
  id: number
  name: string
  state?: string
  product_id?: [number, string] | false
  product_uom_id?: [number, string] | false
  product_qty?: number
  date_start?: string | false
  date_finished?: string | false
  bom_id?: [number, string] | false
  [key: string]: unknown
}

const STATE_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  draft:     { label: 'Draft',       variant: 'secondary' },
  confirmed: { label: 'Confirmed',   variant: 'info' },
  progress:  { label: 'In Progress', variant: 'warning' },
  to_close:  { label: 'To Close',   variant: 'warning' },
  done:      { label: 'Done',        variant: 'success' },
  cancel:    { label: 'Cancelled',   variant: 'destructive' },
}

const KANBAN_STATES: { id: string; title: string }[] = [
  { id: 'draft',     title: 'Draft' },
  { id: 'confirmed', title: 'Confirmed' },
  { id: 'progress',  title: 'In Progress' },
  { id: 'to_close',  title: 'To Close' },
  { id: 'done',      title: 'Done' },
  { id: 'cancel',    title: 'Cancelled' },
]

const FILTERS: FilterOption[] = [
  { key: 'draft',     label: 'Draft',       domain: [['state', '=', 'draft']] },
  { key: 'confirmed', label: 'Confirmed',   domain: [['state', '=', 'confirmed']] },
  { key: 'progress',  label: 'In Progress', domain: [['state', '=', 'progress']] },
  { key: 'done',      label: 'Done',        domain: [['state', '=', 'done']] },
]

const columns: Column[] = [
  {
    key: 'name',
    label: 'Reference',
    render: (_, row) => <span className="font-mono text-sm">{row.name}</span>,
  },
  {
    key: 'product_id',
    label: 'Product',
    format: v => Array.isArray(v) ? v[1] : '',
  },
  {
    key: 'product_qty',
    label: 'Qty',
    align: 'right',
    render: (v, row) => (
      <span className="tabular-nums text-sm">
        {Number(v || 0).toFixed(2)}
        {Array.isArray(row.product_uom_id) ? ` ${row.product_uom_id[1]}` : ''}
      </span>
    ),
  },
  {
    key: 'bom_id',
    label: 'BoM',
    format: v => Array.isArray(v) ? v[1] : '',
  },
  {
    key: 'date_start',
    label: 'Start Date',
    format: v => v ? new Date(v).toLocaleDateString() : '',
  },
  {
    key: 'date_finished',
    label: 'End Date',
    format: v => v ? new Date(v).toLocaleDateString() : '',
  },
  {
    key: 'state',
    label: 'Status',
    sortable: false,
    render: v => {
      const s = STATE_BADGE[v] || { label: v, variant: 'secondary' as BadgeVariant }
      return <Badge variant={s.variant} className="rounded-full text-xs">{s.label}</Badge>
    },
  },
]

export default function ProductionList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>('date_start')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const pageSize = 40

  const stateFilter = activeFilters.length > 0 ? activeFilters : undefined
  const order = sortField ? `${sortField} ${sortDir}` : 'date_start desc'

  const isKanban = viewMode === 'kanban'

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['productions', stateFilter, search, isKanban ? 'kanban' : page, order],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/manufacturing/productions', {
        state: stateFilter,
        search: search || undefined,
        offset: isKanban ? 0 : page * pageSize,
        limit: isKanban ? 200 : pageSize,
        order,
      })
      return data
    },
  })

  const handleFilterToggle = (key: string) => {
    setActiveFilters(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key])
    setPage(0)
  }

  const productions = data?.records || []

  const kanbanColumns: KanbanColumn[] = KANBAN_STATES
  const kanbanCards: KanbanCardData[] = (productions as ProductionRecord[]).map((p): KanbanCardData => {
    const productName = Array.isArray(p.product_id) ? p.product_id[1] : ''
    const uom = Array.isArray(p.product_uom_id) ? p.product_uom_id[1] : ''
    const qtyLabel = `${Number(p.product_qty || 0).toFixed(2)}${uom ? ` ${uom}` : ''}`
    const badges: { label: string; variant?: BadgeVariant }[] = [{ label: qtyLabel, variant: 'secondary' }]
    if (p.date_start) badges.push({ label: new Date(p.date_start).toLocaleDateString(), variant: 'outline' })
    return {
      id: p.id,
      columnId: p.state || 'draft',
      title: p.name,
      subtitle: productName || undefined,
      badges,
      onClick: () => navigate(`/admin/manufacturing/orders/${p.id}`),
    }
  })

  return (
    <div className="space-y-4">
      <PageHeader
        title="Production Orders"
        subtitle="manufacturing"
        onNew={() => navigate('/admin/manufacturing/orders/new')}
      />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <SearchBar
            placeholder="Search production orders..."
            onSearch={v => { setSearch(v); setPage(0) }}
            filters={FILTERS}
            activeFilters={activeFilters}
            onFilterToggle={handleFilterToggle}
          />
        </div>
        <ViewToggle value={viewMode} onChange={setViewMode} available={['list', 'kanban', 'gantt']} />
      </div>
      {viewMode === 'kanban' ? (
        // No drag-and-drop: state transitions require business logic (confirm, plan, produce, close).
        <KanbanBoard columns={kanbanColumns} cards={kanbanCards} />
      ) : viewMode === 'gantt' ? (
        <GanttChart
          items={(productions as ProductionRecord[])
            .filter((p) => !!p.date_start && !!p.date_finished)
            .map((p) => ({
              id: p.id,
              title: p.name,
              start: new Date(p.date_start as string),
              end: new Date(p.date_finished as string),
              group: Array.isArray(p.product_id) ? String(p.product_id[1]) : undefined,
              onClick: () => navigate(`/admin/manufacturing/orders/${p.id}`),
            }))}
          groupBy="group"
        />
      ) : (
        <DataTable
          columns={columns}
          data={productions}
          total={data?.total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          sortField={sortField}
          sortDir={sortDir}
          onSort={(f, d) => { setSortField(f); setSortDir(d) }}
          loading={isLoading}
          isError={isError} error={error} onRetry={() => refetch()}
          rowLink={row => `/admin/manufacturing/orders/${row.id}`}
          emptyMessage="No production orders yet. Production orders require a BoM, workcenters, and an mrp_operation picking type."
          emptyIcon={<Factory className="h-10 w-10" />}
        />
      )}
    </div>
  )
}
