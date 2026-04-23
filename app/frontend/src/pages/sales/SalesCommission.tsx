import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared'
import { Button, Skeleton } from '@mashora/design-system'
import { BarChart3, ArrowRight } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

const fmt = (n: number) => '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface SaleOrder {
  id: number
  name: string
  user_id: [number, string]
  amount_total: number
  date_order: string
  state: string
}

interface SalespersonSummary {
  id: number
  name: string
  orderCount: number
  totalRevenue: number
}

export default function SalesCommission() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery<SaleOrder[]>({
    queryKey: ['sales-commission-orders'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/sale.order', {
        fields: ['id', 'name', 'user_id', 'amount_total', 'date_order', 'state'],
        domain: [['state', '=', 'sale']],
        order: 'user_id asc, date_order desc',
        limit: 500,
      })
      return data.records ?? data
    },
  })

  const summaries: SalespersonSummary[] = (() => {
    if (!data) return []
    const map = new Map<number, SalespersonSummary>()
    for (const order of data) {
      const [uid, uname] = Array.isArray(order.user_id) ? order.user_id : [0, 'Unknown']
      const existing = map.get(uid)
      if (existing) {
        existing.orderCount += 1
        existing.totalRevenue += order.amount_total
      } else {
        map.set(uid, { id: uid, name: uname, orderCount: 1, totalRevenue: order.amount_total })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue)
  })()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Sales Commission" />

      {summaries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-12 text-center space-y-4">
          <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-primary">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">No commissions yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Commission appears after orders are confirmed. Confirm your first sale to see commissions.
            </p>
          </div>
          <Button onClick={() => navigate('/admin/sales/orders')} className="gap-2">
            Go to Sales Orders
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {summaries.map((sp, rank) => (
            <div
              key={sp.id}
              className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {rank + 1}
                  </span>
                  <p className="font-semibold text-sm leading-tight truncate">{sp.name}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Orders</p>
                  <p className="text-xl font-bold font-mono">{sp.orderCount}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Revenue</p>
                  <p className="text-xl font-bold font-mono text-emerald-400">{fmt(sp.totalRevenue)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
