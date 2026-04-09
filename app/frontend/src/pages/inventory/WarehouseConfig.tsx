import { useQuery } from '@tanstack/react-query'
import { Badge } from '@mashora/design-system'
import { Warehouse } from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface WarehouseRecord {
  id: number
  name: string
  code: string
  company_id: [number, string]
  partner_id: [number, string]
  lot_stock_id: [number, string]
}

interface PickingTypeRecord {
  id: number
  name: string
  code: string
  warehouse_id: [number, string]
  count_picking_ready: number
  count_picking_waiting: number
  count_picking_late: number
}

const CODE_BADGE: Record<string, string> = {
  incoming: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  outgoing: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  internal: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
}

const CODE_LABEL: Record<string, string> = {
  incoming: 'Incoming',
  outgoing: 'Outgoing',
  internal: 'Internal',
}

export default function WarehouseConfig() {
  const { data: warehouseData, isLoading: loadingWh } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const { data } = await erpClient.raw.get('/inventory/warehouses')
      return data as { records: WarehouseRecord[]; total: number }
    },
  })

  const { data: pickingData, isLoading: loadingPt } = useQuery({
    queryKey: ['picking-types'],
    queryFn: async () => {
      const { data } = await erpClient.raw.get('/inventory/picking-types')
      return data as { records: PickingTypeRecord[] }
    },
  })

  const warehouses = warehouseData?.records || []
  const pickingTypes = pickingData?.records || []

  return (
    <div className="space-y-6">
      <PageHeader title="Warehouses" subtitle="inventory" />

      {/* Warehouse Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {loadingWh
          ? Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl border border-border/30 bg-card/50 p-5 h-32"
              />
            ))
          : warehouses.map(wh => (
              <div
                key={wh.id}
                className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <Warehouse className="h-5 w-5 text-muted-foreground shrink-0" />
                  <span className="font-bold text-base leading-tight">{wh.name}</span>
                  <span className="ml-auto font-mono text-xs px-2 py-0.5 rounded border border-border/40 bg-muted/40 text-muted-foreground">
                    {wh.code}
                  </span>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex gap-2">
                    <span className="w-24 shrink-0">Company</span>
                    <span className="text-foreground/80">
                      {Array.isArray(wh.company_id) ? wh.company_id[1] : ''}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-24 shrink-0">Stock Location</span>
                    <span className="font-mono text-xs text-foreground/70">
                      {Array.isArray(wh.lot_stock_id) ? wh.lot_stock_id[1] : ''}
                    </span>
                  </div>
                </div>
              </div>
            ))}
      </div>

      {/* Operation Types */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
          Operation Types
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {loadingPt
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-2xl border border-border/30 bg-card/50 p-5 h-24"
                />
              ))
            : pickingTypes.map(pt => (
                <div
                  key={pt.id}
                  className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm">{pt.name}</span>
                    <span
                      className={`ml-auto font-mono text-xs px-2 py-0.5 rounded border ${CODE_BADGE[pt.code] || 'bg-muted/40 text-muted-foreground border-border/40'}`}
                    >
                      {CODE_LABEL[pt.code] || pt.code}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">
                    {Array.isArray(pt.warehouse_id) ? pt.warehouse_id[1] : ''}
                  </div>
                  <div className="flex gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {pt.count_picking_ready} Ready
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {pt.count_picking_waiting} Waiting
                    </span>
                    {pt.count_picking_late > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                        {pt.count_picking_late} Late
                      </span>
                    )}
                  </div>
                </div>
              ))}
        </div>
      </div>
    </div>
  )
}
