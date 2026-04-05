import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Input, Badge, cn, DataTable, type Column,
} from '@mashora/design-system'
import { Search, Package, Layers, AlertTriangle } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

interface StockQuant {
  id: number
  product_id: [number, string] | false
  location_id: [number, string] | false
  lot_id: [number, string] | false
  quantity: number
  reserved_quantity: number
  available_quantity: number
  warehouse_id: [number, string] | false
}

function formatQty(qty: number): string {
  return qty % 1 === 0 ? String(qty) : qty.toFixed(2)
}

const columns: Column<StockQuant>[] = [
  {
    key: 'product_id',
    header: 'Product',
    cell: (row) => (
      <span className="font-medium">{row.product_id ? row.product_id[1] : '—'}</span>
    ),
  },
  {
    key: 'location_id',
    header: 'Location',
    cell: (row) => (
      <span className="text-xs text-muted-foreground">
        {row.location_id ? row.location_id[1] : '—'}
      </span>
    ),
  },
  {
    key: 'lot_id',
    header: 'Lot / Serial',
    cell: (row) =>
      row.lot_id ? (
        <Badge variant="outline" className="font-mono text-xs">
          {row.lot_id[1]}
        </Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    key: 'quantity',
    header: 'On Hand',
    className: 'text-right',
    cell: (row) => (
      <span className="font-mono font-medium tabular-nums">{formatQty(row.quantity)}</span>
    ),
  },
  {
    key: 'reserved_quantity',
    header: 'Reserved',
    className: 'text-right',
    cell: (row) => (
      <span className={cn('font-mono tabular-nums', row.reserved_quantity > 0 ? 'text-warning' : 'text-muted-foreground')}>
        {formatQty(row.reserved_quantity)}
      </span>
    ),
  },
  {
    key: 'available_quantity',
    header: 'Available',
    className: 'text-right',
    cell: (row) => (
      <span
        className={cn(
          'font-mono font-semibold tabular-nums',
          row.available_quantity > 0 ? 'text-success' : 'text-destructive',
        )}
      >
        {formatQty(row.available_quantity)}
      </span>
    ),
  },
  {
    key: 'warehouse_id',
    header: 'Warehouse',
    cell: (row) => (
      <span className="text-sm">{row.warehouse_id ? row.warehouse_id[1] : '—'}</span>
    ),
  },
]

export default function StockLevels() {
  const [search, setSearch] = useState('')

  const params: Record<string, any> = { limit: 100, on_hand: true }
  if (search) params.search = search

  const { data, isLoading } = useQuery({
    queryKey: ['stock-quants', search],
    queryFn: () => erpClient.raw.post('/inventory/stock', params).then((r) => r.data),
  })

  const total = data?.total ?? 0
  const records: StockQuant[] = data?.records ?? []
  const zeroStock = records.filter((r) => r.available_quantity <= 0).length
  const lowReserved = records.filter((r) => r.reserved_quantity > 0).length

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Inventory
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Stock Levels</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Loading stock entries…' : `${total} stock ${total === 1 ? 'entry' : 'entries'}`}
          </p>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: 'Total Entries',
            value: isLoading ? null : total,
            icon: Layers,
            sub: 'On-hand stock locations',
          },
          {
            label: 'With Reservations',
            value: isLoading ? null : lowReserved,
            icon: Package,
            sub: 'Lines with reserved qty',
          },
          {
            label: 'Zero / Negative',
            value: isLoading ? null : zeroStock,
            icon: AlertTriangle,
            sub: 'Lines needing replenishment',
            alert: (zeroStock > 0),
          },
        ].map(({ label, value, icon: Icon, sub, alert }) => (
          <div
            key={label}
            className="group overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] transition-transform duration-300 hover:-translate-y-0.5"
          >
            <div className="p-6">
              <div className="mb-4 flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                    {label}
                  </p>
                  {value === null ? (
                    <div className="h-9 w-16 animate-pulse rounded-md bg-muted" />
                  ) : (
                    <div className={cn('text-3xl font-semibold tracking-tight', alert && 'text-destructive')}>
                      {value}
                    </div>
                  )}
                </div>
                <div className={cn(
                  'rounded-2xl border border-border/70 bg-muted/60 p-3 text-muted-foreground transition-colors',
                  'group-hover:bg-zinc-900 group-hover:text-white',
                  'dark:group-hover:border-zinc-700 dark:group-hover:bg-zinc-800 dark:group-hover:text-zinc-50',
                )}>
                  <Icon className="size-5" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + table */}
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)]">
        <div className="flex items-center justify-between border-b border-border/70 bg-muted/20 px-6 py-4">
          <div>
            <p className="text-sm font-semibold">All Stock Entries</p>
            <p className="text-xs text-muted-foreground mt-0.5">On-hand quantities across all locations</p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search product or location…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-xl pl-9"
            />
          </div>
        </div>
        <div className="p-0">
          <DataTable
            columns={columns}
            data={records}
            loading={isLoading}
            emptyMessage="No stock entries found."
          />
        </div>
      </div>
    </div>
  )
}
