import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { PageHeader, StatCards } from '@/components/shared'
import { Card, CardContent, Button, Badge, Skeleton, cn } from '@mashora/design-system'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { erpClient } from '@/lib/erp-api'
import {
  Factory, ClipboardList, Layers, Wrench, AlertTriangle, CheckCircle, PlayCircle,
  ChevronRight, MoreHorizontal, Plus, Package, Activity, RotateCcw,
} from 'lucide-react'

interface DashboardData {
  draft: number
  confirmed: number
  in_progress: number
  done: number
  late: number
  bom_count: number
  workcenter_count: number
}

interface PickingType {
  id: number
  name: string
  code: string
  color?: number
  count_picking_ready?: number
  count_picking_waiting?: number
  count_picking_late?: number
}

interface Workcenter {
  id: number
  name: string
  oee?: number
  oee_target?: number
}

const TYPE_ACCENT: Record<string, string> = {
  mrp_operation: 'bg-amber-500',
  repair_operation: 'bg-violet-500',
  maintenance: 'bg-blue-500',
}

const TYPE_LABEL: Record<string, string> = {
  mrp_operation: 'Manufacturing',
  repair_operation: 'Repair',
  maintenance: 'Maintenance',
}

export default function MrpDashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['manufacturing', 'dashboard'],
    queryFn: () =>
      erpClient.raw.get('/manufacturing/dashboard').then((r) => r.data).catch(() => ({
        draft: 0, confirmed: 0, in_progress: 0, done: 0, late: 0, bom_count: 0, workcenter_count: 0,
      })),
  })

  const { data: pickingTypes, isLoading: typesLoading } = useQuery({
    queryKey: ['manufacturing', 'picking-types'],
    queryFn: async (): Promise<PickingType[]> => {
      try {
        const { data } = await erpClient.raw.post('/model/stock.picking.type', {
          domain: [['code', 'in', ['mrp_operation', 'repair_operation', 'maintenance']]],
          fields: [
            'id', 'name', 'code', 'color',
            'count_picking_ready', 'count_picking_waiting', 'count_picking_late',
          ],
          limit: 50,
        })
        return data?.records || []
      } catch {
        return []
      }
    },
    staleTime: 60_000,
  })

  const { data: workcenters, isLoading: wcLoading } = useQuery({
    queryKey: ['manufacturing', 'workcenters-oee'],
    queryFn: async (): Promise<Workcenter[]> => {
      try {
        const { data } = await erpClient.raw.post('/model/mrp.workcenter', {
          domain: [['active', '=', true]],
          fields: ['id', 'name', 'oee', 'oee_target'],
          limit: 10,
          order: 'oee desc',
        })
        return data?.records || []
      } catch {
        return []
      }
    },
    staleTime: 60_000,
  })

  const statCards = isLoading
    ? null
    : [
        { label: 'Draft Orders', value: data?.draft ?? 0, icon: <ClipboardList className="h-4 w-4" />, color: 'default' as const },
        { label: 'Confirmed', value: data?.confirmed ?? 0, icon: <CheckCircle className="h-4 w-4" />, color: 'info' as const },
        { label: 'In Progress', value: data?.in_progress ?? 0, icon: <PlayCircle className="h-4 w-4" />, color: 'success' as const },
        {
          label: 'Late', value: data?.late ?? 0,
          icon: <AlertTriangle className="h-4 w-4" />,
          color: ((data?.late ?? 0) > 0 ? 'danger' : 'default') as 'danger' | 'default',
        },
      ]

  const quickActions = [
    { label: 'Bills of Materials', icon: <Layers className="h-5 w-5" />, route: '/admin/manufacturing/bom' },
    { label: 'Work Centers', icon: <Wrench className="h-5 w-5" />, route: '/admin/manufacturing/workcenters' },
    { label: 'Work Orders', icon: <ClipboardList className="h-5 w-5" />, route: '/admin/manufacturing/workorders' },
    { label: 'Subcontracting', icon: <Package className="h-5 w-5" />, route: '/admin/manufacturing/subcontracting' },
    { label: 'Scrap', icon: <RotateCcw className="h-5 w-5" />, route: '/admin/inventory/scrap' },
  ]

  // Build OEE chart data
  const oeeData = (workcenters || [])
    .map((wc) => ({
      name: wc.name,
      oee: Math.round((wc.oee || 0) * 10) / 10,
      target: Math.round((wc.oee_target || 0) * 10) / 10,
    }))
    .slice(0, 10)

  return (
    <div className="space-y-6">
      <PageHeader title="Manufacturing" subtitle="Today's overview" />

      {/* Per-operation Kanban cards */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Factory className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Operations
          </p>
          {(pickingTypes?.length ?? 0) > 0 && (
            <Badge variant="secondary" className="text-[10px]">{pickingTypes!.length}</Badge>
          )}
        </div>
        {typesLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
          </div>
        ) : (pickingTypes?.length ?? 0) === 0 ? (
          <Card className="rounded-2xl">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No manufacturing operations configured —
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pickingTypes!.map(pt => (
              <OperationCard key={pt.id} type={pt} onNavigate={navigate} />
            ))}
          </div>
        )}
      </section>

      {/* Stats row */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">
          Production Orders
        </p>
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        ) : (
          <StatCards stats={statCards!} columns={4} />
        )}
      </div>

      {/* OEE chart */}
      <Card className="rounded-2xl hover:shadow-md transition-shadow">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">OEE by Workcenter</h3>
            </div>
            <span className="text-xs text-muted-foreground">top 10</span>
          </div>
          {wcLoading ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : oeeData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
              No workcenter data —
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, oeeData.length * 32)}>
              <BarChart data={oeeData} layout="vertical" margin={{ left: 12, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                  formatter={(v: unknown) => `${Number(v) || 0}%`}
                />
                <Bar dataKey="oee" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">
          Quick Actions
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.route}
              onClick={() => navigate(action.route)}
              className="rounded-2xl border border-border/50 bg-card p-4 text-left transition-all hover:bg-muted/20 hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary shrink-0">
                  {action.icon}
                </div>
                <p className="font-semibold text-sm">{action.label}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function OperationCard({
  type, onNavigate,
}: {
  type: PickingType
  onNavigate: (path: string) => void
}) {
  const accent = TYPE_ACCENT[type.code] || 'bg-slate-500'
  const label = TYPE_LABEL[type.code] || type.code
  const ready = type.count_picking_ready || 0
  const waiting = type.count_picking_waiting || 0
  const late = type.count_picking_late || 0

  const isMrp = type.code === 'mrp_operation'
  const isRepair = type.code === 'repair_operation'
  const newPath = isRepair
    ? '/admin/repairs/new'
    : isMrp
      ? `/admin/manufacturing/orders/new?picking_type_id=${type.id}`
      : `/admin/manufacturing/orders/new?picking_type_id=${type.id}`
  const newLabel = isRepair ? 'New Repair' : 'New Manufacturing Order'
  const listBase = isRepair ? '/admin/repairs' : '/admin/manufacturing/orders'

  return (
    <Card className="rounded-2xl overflow-hidden hover:shadow-md transition-shadow border-border/50">
      <CardContent className="p-0">
        <div className={cn('h-1.5 w-full', accent)} />
        <div className="p-4 flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0">
            <div className="rounded-xl p-2.5 bg-muted/50 text-foreground shrink-0">
              <Factory className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <button
                onClick={() => onNavigate(`${listBase}?picking_type_id=${type.id}`)}
                className="text-sm font-semibold truncate hover:underline text-left block max-w-full"
                title={type.name}
              >
                {type.name}
              </button>
              <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
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

        <div className="px-4 pb-3 space-y-1.5">
          <MetricRow
            label="Ready"
            value={ready}
            color="text-emerald-600"
            onClick={() => onNavigate(`${listBase}?picking_type_id=${type.id}&state=assigned`)}
          />
          <MetricRow
            label="Waiting"
            value={waiting}
            color="text-amber-600"
            onClick={() => onNavigate(`${listBase}?picking_type_id=${type.id}&state=waiting`)}
          />
          <MetricRow
            label="Late"
            value={late}
            color={late > 0 ? 'text-red-600 font-bold' : 'text-muted-foreground'}
            highlight={late > 0}
            onClick={() => onNavigate(`${listBase}?picking_type_id=${type.id}&late=true`)}
          />
        </div>

        <div className="px-4 pb-4 pt-1">
          <Button
            size="sm"
            variant="default"
            className="w-full h-8 text-xs"
            onClick={() => onNavigate(newPath)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            {newLabel}
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
