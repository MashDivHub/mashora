import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared'
import { Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'

const fmt = (n: number) => '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface ValuationLayer {
  id: number
  product_id: [number, string]
  quantity: number
  unit_cost: number
  value: number
  create_date: string
}

export default function InventoryValuation() {
  const { data, isLoading } = useQuery<ValuationLayer[]>({
    queryKey: ['inventory-valuation'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.post('/model/stock.valuation.layer', {
          fields: ['id', 'product_id', 'quantity', 'unit_cost', 'value', 'create_date'],
          order: 'create_date desc',
          limit: 200,
        })
        return data.records ?? data ?? []
      } catch {
        // Model may not exist — try stock.quant as fallback for valuation
        try {
          const { data } = await erpClient.raw.post('/model/stock.quant', {
            domain: [['location_id.usage', '=', 'internal']],
            fields: ['id', 'product_id', 'quantity', 'value', 'create_date'],
            order: 'create_date desc',
            limit: 200,
          })
          interface QuantRow { id: number; product_id?: [number, string] | false; quantity?: number; value?: number; create_date?: string | false; [k: string]: unknown }
          return ((data.records ?? []) as QuantRow[]).map((r) => ({ ...r, unit_cost: r.quantity ? (r.value ?? 0) / r.quantity : 0 }))
        } catch {
          return []
        }
      }
    },
  })

  const records = data ?? []
  const totalValue = records.reduce((sum, r) => sum + r.value, 0)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory Valuation" />

      <div className="rounded-2xl border border-border/30 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/40">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Product</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Quantity</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Unit Cost</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Total Value</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">No valuation entries yet</p>
                    <p className="text-xs">
                      Valuation entries appear after receiving products with FIFO or AVCO costing.
                      Products using &quot;standard&quot; costing won&apos;t produce entries here —
                      check the costing method on your product categories.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : records.map(layer => (
              <TableRow key={layer.id} className="border-border/30 hover:bg-muted/10">
                <TableCell className="py-2 text-sm font-medium">
                  {Array.isArray(layer.product_id) ? layer.product_id[1] : '—'}
                </TableCell>
                <TableCell className="py-2 text-right font-mono text-sm">
                  {Number(layer.quantity).toFixed(2)}
                </TableCell>
                <TableCell className="py-2 text-right font-mono text-sm">
                  {fmt(layer.unit_cost)}
                </TableCell>
                <TableCell className="py-2 text-right font-mono text-sm font-medium">
                  {fmt(layer.value)}
                </TableCell>
                <TableCell className="py-2 text-sm text-muted-foreground">
                  {layer.create_date ? layer.create_date.slice(0, 10) : '—'}
                </TableCell>
              </TableRow>
            ))}

            {/* Footer total row */}
            <TableRow className="border-t-2 border-border/50 bg-muted/10 font-semibold hover:bg-muted/15">
              <TableCell colSpan={3} className="py-2.5 text-sm">Total Inventory Value</TableCell>
              <TableCell className="py-2.5 text-right font-mono text-sm text-emerald-400">
                {fmt(totalValue)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
