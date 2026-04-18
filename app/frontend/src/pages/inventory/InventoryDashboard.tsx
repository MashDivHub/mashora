import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, Button, Badge, Skeleton, cn } from '@mashora/design-system'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Package, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight,
  ScanBarcode, Warehouse, RotateCcw, ClipboardCheck, RefreshCw,
  ChevronRight, MoreHorizontal, Activity, Truck,
} from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

interface PickingType {
  id: number
  name: string
  code: string  // 'incoming' | 'outgoing' | 'internal' | 'mrp_operation'
  color?: number
  count_picking_ready?: number
  count_picking_waiting?: number
  count_picking_late?: number
  warehouse_id?: [number, string] | false
}

const TYPE_ICON: Record<string, typeof Package> = {
  incoming: ArrowDownToLine,
  outgoing: ArrowUpFromLine,
  internal: ArrowLeftRight,
  mrp_operation: Package,
}

const TYPE_LABEL: Record<string, string> = {
  incoming: 'Receipts',
  outgoing: 'Deliveries',
  internal: 'Internal',
  mrp_operation: 'Manufacturing',
}

const TYPE_ACCENT: Record<string, string> = {
  incoming: 'bg-blue-500',
  outgoing: 'bg-emerald-500',
  internal: 'bg-violet-500',
  mrp_operation: 'bg-amber-500',
}

export default function InventoryDashboard() {
  useDocumentTitle('Inventory')
  const navigate = useNavigate()

  const { data: pickingTypes, isLoading: typesLoading } = useQuery({
    queryKey: ['inventory-dashboard', 'picking-types'],
    queryFn: async (): Promise<PickingType[]> => {
      try {
        const { data } = await erpClient.raw.post('/model/stock.picking.type', {
          domain: [['active', '=', true]],
          fields: [
            'id', 'name', 'code', 'color',
            'count_picking_ready', 'count_picking_waiting', 'count_picking_late',
            'warehouse_id',
          ],
          limit: 100,
        })
        return data?.records || []
      } catch {
        return []
      }
    },
    staleTime: 60_000,
  })

  // Last 7 days throughput
  const { data: throughput, isLoading: throughputLoading } = useQuery({
    queryKey: ['inventory-dashboard', 'throughput'],
    queryFn: async () => {
      try {
        const since = new Date()
        since.setDate(since.getDate() - 7)
        const { data } = await erpClient.raw.post('/model/stock.picking/read_group', {
          domain: [
            ['state', '=', 'done'],
            ['date_done', '>=', since.toISOString().slice(0, 19).replace('T', ' ')],
          ],
          fields: ['date_done'],
          groupby: ['date_done:day'],
          orderby: 'date_done asc',
        })
        interface DoneGroup { date_done?: string | false; 'date_done:day'?: string; date_done_count?: number; __count?: number }
        return ((data?.groups || []) as DoneGroup[]).map((g) => {
          const label = g.date_done || g['date_done:day'] || '—'
          return {
            day: String(label).slice(0, 10),
            count: g.date_done_count || g.__count || 0,
          }
        })
      } catch {
        return []
      }
    },
    staleTime: 60_000,
  })

  // Group by warehouse
  const byWarehouse: Record<string, { warehouseName: string; types: PickingType[] }> = {}
  for (const pt of pickingTypes || []) {
    const wh = Array.isArray(pt.warehouse_id) ? pt.warehouse_id : null
    const key = wh ? String(wh[0]) : 'no-wh'
    if (!byWarehouse[key]) {
      byWarehouse[key] = { warehouseName: wh ? wh[1] : 'Other Operations', types: [] }
    }
    byWarehouse[key].types.push(pt)
  }

  const actions = [
    { label: 'Stock on Hand', icon: <Package className="h-5 w-5" />, path: '/admin/inventory/stock' },
    { label: 'Lots / Serials', icon: <ScanBarcode className="h-5 w-5" />, path: '/admin/inventory/lots' },
    { label: 'Adjustments', icon: <ClipboardCheck className="h-5 w-5" />, path: '/admin/inventory/adjustments' },
    { label: 'Scrap', icon: <RotateCcw className="h-5 w-5" />, path: '/admin/inventory/scrap' },
    { label: 'Warehouses', icon: <Warehouse className="h-5 w-5" />, path: '/admin/inventory/warehouses' },
    { label: 'Replenishment', icon: <RefreshCw className="h-5 w-5" />, path: '/admin/inventory/replenishment' },
    { label: 'All Transfers', icon: <Truck className="h-5 w-5" />, path: '/admin/inventory/transfers' },
  ]

  if (typesLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" subtitle="Today's overview" />

      {Object.entries(byWarehouse).map(([key, group]) => (
        <section key={key} className="space-y-3">
          <div className="flex items-center gap-2">
            <Warehouse className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {group.warehouseName}
            </p>
            <Badge variant="secondary" className="text-[10px]">{group.types.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.types.map(pt => (
              <PickingTypeCard key={pt.id} type={pt} onNavigate={navigate} />
            ))}
          </div>
        </section>
      ))}

      {(pickingTypes || []).length === 0 && (
        <Card className="rounded-2xl">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No picking types configured yet.
          </CardContent>
        </Card>
      )}

      {/* Throughput chart */}
      <Card className="rounded-2xl hover:shadow-md transition-shadow">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Throughput (last 7 days)</h3>
            </div>
            <span className="text-xs text-muted-foreground">completed transfers</span>
          </div>
          {throughputLoading ? (
            <Skeleton className="h-56 rounded-xl" />
          ) : (throughput?.length || 0) === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
              No throughput data —
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={throughput}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 4, fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">
          Quick Actions
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {actions.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="rounded-2xl border border-border/50 bg-card p-4 text-left transition-all hover:bg-muted/20 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">{item.icon}</div>
                <p className="text-sm font-semibold">{item.label}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function PickingTypeCard({
  type, onNavigate,
}: {
  type: PickingType
  onNavigate: (path: string) => void
}) {
  const Icon = TYPE_ICON[type.code] || Package
  const accent = TYPE_ACCENT[type.code] || 'bg-slate-500'
  const ready = type.count_picking_ready || 0
  const waiting = type.count_picking_waiting || 0
  const late = type.count_picking_late || 0

  const baseFilter = `?type=${type.id}`

  return (
    <Card className="rounded-2xl overflow-hidden hover:shadow-md transition-shadow border-border/50">
      <CardContent className="p-0">
        {/* Color stripe */}
        <div className={cn('h-1.5 w-full', accent)} />

        {/* Header */}
        <div className="p-4 flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0">
            <div className="rounded-xl p-2.5 bg-muted/50 text-foreground shrink-0">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <button
                onClick={() => onNavigate(`/admin/inventory/transfers${baseFilter}`)}
                className="text-sm font-semibold truncate hover:underline text-left block max-w-full"
                title={type.name}
              >
                {type.name}
              </button>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {TYPE_LABEL[type.code] || type.code}
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate(`/admin/model/stock.picking.type/${type.id}`)}
            className="rounded-lg p-1 hover:bg-muted/50 text-muted-foreground"
            aria-label="More"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>

        {/* Metrics */}
        <div className="px-4 pb-3 space-y-1.5">
          <MetricRow
            label="Ready"
            value={ready}
            color="text-emerald-600"
            onClick={() => onNavigate(`/admin/inventory/transfers${baseFilter}&state=assigned`)}
          />
          <MetricRow
            label="Waiting"
            value={waiting}
            color="text-amber-600"
            onClick={() => onNavigate(`/admin/inventory/transfers${baseFilter}&state=waiting`)}
          />
          <MetricRow
            label="Late"
            value={late}
            color={late > 0 ? 'text-red-600 font-bold' : 'text-muted-foreground'}
            highlight={late > 0}
            onClick={() => onNavigate(`/admin/inventory/transfers${baseFilter}&late=true`)}
          />
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 pt-1">
          <Button
            size="sm"
            variant="default"
            className="w-full h-8 text-xs"
            onClick={() => onNavigate(`/admin/inventory/transfers${baseFilter}&state=assigned`)}
          >
            Process
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function MetricRow({
  label, value, color, highlight, onClick,
}: {
  label: string
  value: number
  color: string
  highlight?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center justify-between w-full text-xs rounded-lg px-2 py-1.5 transition-colors',
        highlight ? 'bg-red-500/5 hover:bg-red-500/10' : 'bg-muted/30 hover:bg-muted/50',
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('flex items-center gap-1 tabular-nums', color)}>
        {value}
        <ChevronRight className="h-3 w-3" />
      </span>
    </button>
  )
}
