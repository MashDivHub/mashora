import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import { Users, DollarSign, Utensils } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

// ── types ─────────────────────────────────────────────────────────────────────

interface RestaurantTable {
  id: number
  name: string
  seats: number
  shape?: string // 'square' | 'round' | string
  position_h?: number
  position_v?: number
  width?: number
  height?: number
  color?: string
  floor_id?: [number, string] | false | null
  active?: boolean
}

interface RestaurantFloor {
  id: number
  name: string
  sequence?: number
}

interface PosOrderRow {
  id: number
  table_id: [number, string] | false
  amount_total: number
  state: string
  partner_id?: [number, string] | false
}

type TableStatus = 'available' | 'occupied'

// ── helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return '$' + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const STATUS_STYLES: Record<TableStatus, string> = {
  available: 'border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20',
  occupied:  'border-amber-500/50  bg-amber-500/10 hover:bg-amber-500/20',
}

const STATUS_LABEL: Record<TableStatus, string> = {
  available: 'Available',
  occupied:  'Occupied',
}

const STATUS_DOT: Record<TableStatus, string> = {
  available: 'bg-emerald-500',
  occupied:  'bg-amber-500',
}

// ── table card ────────────────────────────────────────────────────────────────

interface TableCardProps {
  table: RestaurantTable
  status: TableStatus
  orderTotal?: number
  onClick: () => void
}

function TableCard({ table, status, orderTotal, onClick }: TableCardProps) {
  const isRound = (table.shape || '').toLowerCase() === 'round'
  const style = STATUS_STYLES[status]
  const isOccupied = status === 'occupied'

  return (
    <button
      onClick={onClick}
      className={[
        'w-24 h-24 border-2 flex flex-col items-center justify-center cursor-pointer transition-all gap-1 p-2',
        isRound ? 'rounded-full' : 'rounded-2xl',
        style,
      ].join(' ')}
      style={table.color ? { borderColor: table.color } : undefined}
    >
      <div className="flex items-center gap-1">
        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[status]}`} />
        <span className="text-xs font-semibold truncate max-w-[72px]">{table.name}</span>
      </div>

      {isOccupied && orderTotal != null && (
        <div className="flex items-center gap-0.5 text-amber-400">
          <DollarSign className="h-3 w-3" />
          <span className="text-[10px] font-semibold">{formatCurrency(orderTotal)}</span>
        </div>
      )}

      <div className="flex items-center gap-0.5 text-muted-foreground">
        <Users className="h-3 w-3" />
        <span className="text-[10px]">{table.seats}</span>
      </div>

      {!isOccupied && (
        <span className="text-[10px] text-muted-foreground">{STATUS_LABEL[status]}</span>
      )}
    </button>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function PosRestaurant() {
  const navigate = useNavigate()
  const [selectedFloorId, setSelectedFloorId] = useState<number | null>(null)

  // Fetch tables (real)
  const { data: tables, isLoading, isError } = useQuery<RestaurantTable[]>({
    queryKey: ['restaurant-tables'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/restaurant.table', {
        domain: [['active', '=', true]],
        fields: ['id', 'name', 'seats', 'shape', 'position_h', 'position_v', 'width', 'height', 'color', 'floor_id'],
        limit: 200,
      })
      return data?.records || []
    },
    retry: false,
  })

  // Fetch floors (optional)
  const { data: floors } = useQuery<RestaurantFloor[]>({
    queryKey: ['restaurant-floors'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/restaurant.floor', {
        fields: ['id', 'name', 'sequence'],
        order: 'sequence asc, id asc',
        limit: 50,
      })
      return data?.records || []
    },
    retry: false,
  })

  // Fetch active draft orders to compute occupancy
  const { data: activeOrders } = useQuery<PosOrderRow[]>({
    queryKey: ['pos-orders-draft'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/pos.order', {
        domain: [['state', '=', 'draft']],
        fields: ['id', 'table_id', 'amount_total', 'state', 'partner_id'],
        limit: 500,
      })
      return data?.records || []
    },
    retry: false,
  })

  // Build occupancy map: table_id → { total }
  const occupancy = new Map<number, { total: number }>()
  for (const o of activeOrders ?? []) {
    if (Array.isArray(o.table_id)) {
      const tid = o.table_id[0]
      const existing = occupancy.get(tid)
      occupancy.set(tid, { total: (existing?.total ?? 0) + Number(o.amount_total || 0) })
    }
  }

  const allTables = tables ?? []
  const visibleTables = selectedFloorId == null
    ? allTables
    : allTables.filter(t => Array.isArray(t.floor_id) && t.floor_id[0] === selectedFloorId)

  function openTerminal(tableId: number) {
    // Note: configId 1 is a placeholder when no specific config is in context.
    navigate(`/admin/pos/terminal/1?table=${tableId}`)
  }

  // ── loading skeleton ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-24 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  // ── error / empty state ────────────────────────────────────────────────────

  if (isError || allTables.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Restaurant" backTo="/admin/pos" />
        <EmptyState
          icon={<Utensils className="h-12 w-12" />}
          title="No restaurant tables configured"
          description="Set up tables in POS → Configuration → Restaurant Floor Designer (coming soon)."
        />
      </div>
    )
  }

  // ── render ─────────────────────────────────────────────────────────────────

  const hasFloors = (floors?.length ?? 0) > 0

  return (
    <div className="space-y-6">
      <PageHeader title="Restaurant" backTo="/admin/pos" />

      {/* Floor selector */}
      {hasFloors && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedFloorId(null)}
            className={[
              'rounded-xl px-4 py-2 text-sm font-medium transition-all',
              selectedFloorId === null
                ? 'bg-primary text-primary-foreground'
                : 'border border-border/40 bg-muted/30 text-muted-foreground hover:bg-muted/60',
            ].join(' ')}
          >
            All Floors
          </button>
          {(floors ?? []).map(floor => (
            <button
              key={floor.id}
              onClick={() => setSelectedFloorId(floor.id)}
              className={[
                'rounded-xl px-4 py-2 text-sm font-medium transition-all',
                selectedFloorId === floor.id
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border/40 bg-muted/30 text-muted-foreground hover:bg-muted/60',
              ].join(' ')}
            >
              {floor.name}
            </button>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-5">
        {(Object.keys(STATUS_LABEL) as TableStatus[]).map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[s]}`} />
            <span className="text-xs text-muted-foreground">{STATUS_LABEL[s]}</span>
          </div>
        ))}
      </div>

      {/* Floor plan grid */}
      <div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {visibleTables.map(table => {
            const occ = occupancy.get(table.id)
            const status: TableStatus = occ ? 'occupied' : 'available'
            return (
              <TableCard
                key={table.id}
                table={table}
                status={status}
                orderTotal={occ?.total}
                onClick={() => openTerminal(table.id)}
              />
            )
          })}
        </div>
        {visibleTables.length === 0 && (
          <p className="text-sm text-muted-foreground italic mt-4 text-center">
            No tables on this floor.
          </p>
        )}
      </div>
    </div>
  )
}
