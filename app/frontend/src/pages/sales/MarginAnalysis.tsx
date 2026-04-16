import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared'
import { Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { TrendingUp, TrendingDown } from 'lucide-react'

const fmt = (n: number) => '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface MarginLine {
  id: number
  name: string
  product_id: [number, string]
  product_uom_qty: number
  price_unit: number
  price_subtotal: number
  purchase_price: number
  margin: number
  margin_percent: number
}

interface MarginData {
  id: number
  name: string
  amount_untaxed: number
  amount_total: number
  margin: number
  margin_percent: number
  lines: MarginLine[]
}

export default function MarginAnalysis() {
  const { id } = useParams<{ id: string }>()

  const { data, isLoading } = useQuery<MarginData>({
    queryKey: ['sale-order-margins', id],
    queryFn: async () => {
      const { data } = await erpClient.raw.get(`/sales/orders/${id}/margins`)
      return data
    },
    enabled: !!id,
  })

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  const marginPositive = data.margin >= 0
  const totalSubtotal = data.lines.reduce((sum, l) => sum + l.price_subtotal, 0)
  const totalMargin = data.lines.reduce((sum, l) => sum + l.margin, 0)
  const overallMarginPct = totalSubtotal > 0 ? (totalMargin / totalSubtotal) * 100 : 0

  const marginPctColor = (pct: number) => {
    if (pct >= 20) return 'text-emerald-400'
    if (pct >= 10) return 'text-amber-400'
    return 'text-red-400'
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Margin Analysis — ${data.name}`}
        backTo={`/admin/sales/orders/${id}`}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {/* Revenue */}
        <div className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Revenue</p>
          <p className="text-2xl font-bold font-mono">{fmt(data.amount_untaxed)}</p>
          <p className="text-xs text-muted-foreground">Untaxed amount</p>
        </div>

        {/* Margin $ */}
        <div className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Margin</p>
          <p className={`text-2xl font-bold font-mono ${marginPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmt(data.margin)}
          </p>
          <p className="text-xs text-muted-foreground">Gross profit</p>
        </div>

        {/* Margin % */}
        <div className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Margin %</p>
          <div className={`flex items-center gap-2 ${marginPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {marginPositive
              ? <TrendingUp className="h-5 w-5 shrink-0" />
              : <TrendingDown className="h-5 w-5 shrink-0" />}
            <span className="text-2xl font-bold font-mono">{data.margin_percent.toFixed(1)}%</span>
          </div>
          <p className="text-xs text-muted-foreground">Of revenue</p>
        </div>
      </div>

      {/* Lines table */}
      <div className="rounded-2xl border border-border/30 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/40">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Product</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Qty</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Unit Price</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Cost</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Subtotal</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Margin</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Margin %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.lines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">No lines</TableCell>
              </TableRow>
            ) : data.lines.map(line => (
              <TableRow key={line.id} className="border-border/30 hover:bg-muted/10">
                <TableCell className="py-2 text-sm font-medium">
                  {line.product_id[1]}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {Number(line.product_uom_qty).toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {fmt(line.price_unit)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {fmt(line.purchase_price)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {fmt(line.price_subtotal)}
                </TableCell>
                <TableCell className={`text-right font-mono text-sm font-medium ${line.margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmt(line.margin)}
                </TableCell>
                <TableCell className={`text-right font-mono text-sm font-medium ${marginPctColor(line.margin_percent)}`}>
                  {line.margin_percent.toFixed(1)}%
                </TableCell>
              </TableRow>
            ))}

            {/* Footer totals row */}
            <TableRow className="border-t-2 border-border/50 bg-muted/10 font-semibold hover:bg-muted/15">
              <TableCell colSpan={4} className="py-2.5 text-sm">Total</TableCell>
              <TableCell className="text-right font-mono text-sm">
                {fmt(totalSubtotal)}
              </TableCell>
              <TableCell className={`text-right font-mono text-sm ${totalMargin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmt(totalMargin)}
              </TableCell>
              <TableCell className={`text-right font-mono text-sm ${marginPctColor(overallMarginPct)}`}>
                {overallMarginPct.toFixed(1)}%
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
