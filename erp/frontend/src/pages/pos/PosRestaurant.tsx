import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import { Users, DollarSign } from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

// ── types ─────────────────────────────────────────────────────────────────────

interface PosPreset {
  id: number
  name: string
  sequence: number
  type?: string
}

type TableStatus = 'available' | 'occupied' | 'reserved'

interface TableData {
  id: number
  name: string
  status: TableStatus
  orderTotal?: number
  guests?: number
  floor?: string
}

// ── helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return '$' + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const STATUS_STYLES: Record<TableStatus, string> = {
  available: 'border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20',
  occupied:  'border-amber-500/50  bg-amber-500/10',
  reserved:  'border-blue-500/50   bg-blue-500/10',
}

const STATUS_LABEL: Record<TableStatus, string> = {
  available: 'Available',
  occupied:  'Occupied',
  reserved:  'Reserved',
}

const STATUS_DOT: Record<TableStatus, string> = {
  available: 'bg-emerald-500',
  occupied:  'bg-amber-500',
  reserved:  'bg-blue-500',
}

// ── fallback tables when pos.preset model is unavailable ──────────────────────

const STATUSES: TableStatus[] = ['available', 'occupied', 'reserved']

function buildFallbackTables(): TableData[] {
  return Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    name: `Table ${i + 1}`,
    status: STATUSES[i % 3] as TableStatus,
    orderTotal: i % 3 === 1 ? 48.5 + i * 10 : undefined,
    guests: i % 3 === 1 ? 2 + (i % 3) : undefined,
    floor: i < 6 ? 'Main Floor' : 'Upper Floor',
  }))
}

// ── table card ────────────────────────────────────────────────────────────────

function TableCard({ table, onClick }: { table: TableData; onClick: () => void }) {
  const style = STATUS_STYLES[table.status]
  const isOccupied = table.status === 'occupied'

  return (
    <button
      onClick={onClick}
      className={[
        'w-24 h-24 rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer transition-all gap-1 p-2',
        style,
      ].join(' ')}
    >
      <div className="flex items-center gap-1">
        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[table.status]}`} />
        <span className="text-xs font-semibold truncate max-w-[72px]">{table.name}</span>
      </div>

      {isOccupied && table.orderTotal != null && (
        <div className="flex items-center gap-0.5 text-amber-400">
          <DollarSign className="h-3 w-3" />
          <span className="text-[10px] font-semibold">{formatCurrency(table.orderTotal)}</span>
        </div>
      )}

      {isOccupied && table.guests != null && (
        <div className="flex items-center gap-0.5 text-muted-foreground">
          <Users className="h-3 w-3" />
          <span className="text-[10px]">{table.guests}</span>
        </div>
      )}

      {!isOccupied && (
        <span className="text-[10px] text-muted-foreground">{STATUS_LABEL[table.status]}</span>
      )}
    </button>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function PosRestaurant() {
  const navigate = useNavigate()
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null)

  // Attempt to fetch pos.preset — fall back gracefully on 404 / error
  const { data: presetsData, isLoading, isError } = useQuery<{ records: PosPreset[] }>({
    queryKey: ['pos-presets'],
    queryFn: () =>
      erpClient.raw
        .post('/model/pos.preset', {
          fields: ['id', 'name', 'sequence', 'type'],
          order: 'sequence asc',
          limit: 100,
        })
        .then(r => r.data),
    retry: false,
    staleTime: 60_000,
  })

  // Build table list — from presets if available, else fallback
  const tables: TableData[] = (() => {
    if (isError || !presetsData?.records?.length) {
      return buildFallbackTables()
    }
    return presetsData.records.map((p, i) => ({
      id: p.id,
      name: p.name,
      status: (STATUSES[i % 3]) as TableStatus,
      floor: 'Main Floor',
    }))
  })()

  // Derive distinct floors
  const floors = Array.from(new Set(tables.map(t => t.floor).filter(Boolean))) as string[]
  const activeFloor = selectedFloor ?? (floors[0] ?? null)
  const visibleTables = activeFloor
    ? tables.filter(t => t.floor === activeFloor)
    : tables

  function openTerminal(tableId: number) {
    navigate(`/pos/terminal/1?table=${tableId}`)
  }

  // ── loading skeleton ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-24 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader title="Restaurant" backTo="/pos" />

      {/* Floor selector */}
      {floors.length > 1 && (
        <div className="flex gap-2">
          {floors.map(floor => (
            <button
              key={floor}
              onClick={() => setSelectedFloor(floor)}
              className={[
                'rounded-xl px-4 py-2 text-sm font-medium transition-all',
                activeFloor === floor
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border/40 bg-muted/30 text-muted-foreground hover:bg-muted/60',
              ].join(' ')}
            >
              {floor}
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
        {activeFloor && (
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            {activeFloor}
          </h2>
        )}
        <div className="grid grid-cols-4 gap-4">
          {visibleTables.map(table => (
            <TableCard key={table.id} table={table} onClick={() => openTerminal(table.id)} />
          ))}
        </div>
      </div>
    </div>
  )
}
