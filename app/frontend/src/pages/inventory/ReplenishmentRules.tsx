import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'

interface OrderPoint {
  id: number
  name: string
  product_id: [number, string]
  warehouse_id: [number, string]
  location_id: [number, string]
  product_min_qty: number
  product_max_qty: number
  qty_to_order: number
  trigger: 'automatic' | 'manual'
}

export default function ReplenishmentRules() {
  const [searchParams, setSearchParams] = useSearchParams()
  const productTmplId = searchParams.get('product_tmpl_id')
  const productName = searchParams.get('product_name') || ''

  const domain: unknown[] = []
  if (productTmplId) domain.push(['product.product_tmpl_id', '=', parseInt(productTmplId)])

  const { data, isLoading } = useQuery<OrderPoint[]>({
    queryKey: ['replenishment-rules', domain],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/stock.warehouse.orderpoint', {
        domain: domain.length ? domain : undefined,
        fields: ['id', 'name', 'product_id', 'warehouse_id', 'location_id', 'product_min_qty', 'product_max_qty', 'qty_to_order', 'trigger'],
        order: 'product_id asc',
        limit: 100,
      })
      return data.records ?? data
    },
  })

  const clearProductFilter = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('product_tmpl_id')
    next.delete('product_name')
    setSearchParams(next)
  }

  const records = data ?? []

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
      <PageHeader title="Replenishment Rules" />

      {productTmplId && (
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs">
          <span>Product: <strong>{productName || `#${productTmplId}`}</strong></span>
          <button type="button" onClick={clearProductFilter} className="hover:text-destructive" title="Clear product filter" aria-label="Clear product filter">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-border/30 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/40">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Product</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Warehouse</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Location</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Min Qty</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Max Qty</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">To Order</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Trigger</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">No replenishment rules found.</TableCell>
              </TableRow>
            ) : records.map(rule => (
              <TableRow key={rule.id} className="border-border/30 hover:bg-muted/10">
                <TableCell className="py-2 text-sm font-medium">
                  {Array.isArray(rule.product_id) ? rule.product_id[1] : '—'}
                </TableCell>
                <TableCell className="py-2 text-sm text-muted-foreground">
                  {Array.isArray(rule.warehouse_id) ? rule.warehouse_id[1] : '—'}
                </TableCell>
                <TableCell className="py-2 text-sm text-muted-foreground">
                  {Array.isArray(rule.location_id) ? rule.location_id[1] : '—'}
                </TableCell>
                <TableCell className="py-2 text-right font-mono text-sm">
                  {Number(rule.product_min_qty).toFixed(2)}
                </TableCell>
                <TableCell className="py-2 text-right font-mono text-sm">
                  {Number(rule.product_max_qty).toFixed(2)}
                </TableCell>
                <TableCell className={`py-2 text-right font-mono text-sm font-medium ${rule.qty_to_order > 0 ? 'text-amber-400' : ''}`}>
                  {Number(rule.qty_to_order).toFixed(2)}
                </TableCell>
                <TableCell className="py-2">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                    rule.trigger === 'automatic'
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  }`}>
                    {rule.trigger === 'automatic' ? 'Auto' : 'Manual'}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
