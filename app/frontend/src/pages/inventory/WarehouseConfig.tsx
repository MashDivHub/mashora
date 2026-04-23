import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button } from '@mashora/design-system'
import { Warehouse, Plus, Boxes } from 'lucide-react'
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
  const navigate = useNavigate()

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

  const handleNewWarehouse = () => navigate('/admin/model/stock.warehouse/new')
  const handleNewPickingType = () => navigate('/admin/model/stock.picking.type/new')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouses"
        subtitle="inventory"
        actions={
          <Button onClick={handleNewWarehouse} className="gap-2 rounded-xl">
            <Plus className="h-4 w-4" />
            New Warehouse
          </Button>
        }
      />

      {/* Warehouse Cards */}
      {loadingWh ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-border/30 bg-card/50 p-5 h-32"
            />
          ))}
        </div>
      ) : warehouses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-12 text-center space-y-4">
          <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-primary">
            <Warehouse className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">No warehouses configured yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create your first warehouse to start managing stock. This auto-generates default
              operation types (receipts, deliveries, internal transfers).
            </p>
          </div>
          <Button onClick={handleNewWarehouse} className="gap-2 rounded-xl">
            <Plus className="h-4 w-4" />
            Create First Warehouse
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {warehouses.map(wh => (
            <button
              key={wh.id}
              type="button"
              onClick={() => navigate(`/admin/model/stock.warehouse/${wh.id}`)}
              className="text-left rounded-2xl border border-border/30 bg-card/50 p-5 space-y-3 transition-all hover:bg-muted/20 hover:shadow-md"
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
            </button>
          ))}
        </div>
      )}

      {/* Operation Types */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Operation Types
          </h2>
          <Button
            size="sm"
            variant="outline"
            onClick={handleNewPickingType}
            className="gap-1.5 rounded-xl"
          >
            <Plus className="h-3.5 w-3.5" />
            New Operation Type
          </Button>
        </div>

        {loadingPt ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl border border-border/30 bg-card/50 p-5 h-24"
              />
            ))}
          </div>
        ) : pickingTypes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-10 text-center space-y-3">
            <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-primary">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">No operation types configured</p>
              <p className="text-xs text-muted-foreground mt-1">
                Operation types drive receipts, deliveries, and internal transfers. Create a
                warehouse to auto-seed defaults, or add one manually.
              </p>
            </div>
            <Button size="sm" onClick={handleNewPickingType} className="gap-1.5 rounded-xl">
              <Plus className="h-3.5 w-3.5" />
              New Operation Type
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {pickingTypes.map(pt => (
              <button
                key={pt.id}
                type="button"
                onClick={() => navigate(`/admin/model/stock.picking.type/${pt.id}`)}
                className="text-left rounded-2xl border border-border/30 bg-card/50 p-5 space-y-3 transition-all hover:bg-muted/20 hover:shadow-md"
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
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
