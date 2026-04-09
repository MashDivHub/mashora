import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import { Package, FileText, ShoppingBag, DollarSign } from 'lucide-react'
import { PageHeader, StatCards, type StatCardData } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

export default function VisitorAnalytics() {
  const { data, isLoading } = useQuery({
    queryKey: ['website-analytics-dashboard'],
    queryFn: async () => {
      const { data } = await erpClient.raw.get('/website/dashboard')
      return data
    },
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-52 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>
    )
  }

  const published = data?.products?.published ?? 0
  const unpublished = data?.products?.unpublished ?? 0
  const totalProducts = published + unpublished
  const pages = data?.pages ?? 0
  const ordersThisMonth = data?.orders_this_month ?? 0
  const abandonedCarts = data?.abandoned_carts ?? 0
  const revenue = data?.online_revenue ?? 0

  const publishedPct = totalProducts > 0 ? Math.round((published / totalProducts) * 100) : 0
  const unpublishedPct = 100 - publishedPct

  const totalActivity = ordersThisMonth + abandonedCarts
  const ordersPct = totalActivity > 0 ? Math.round((ordersThisMonth / totalActivity) * 100) : 0
  const abandonedPct = 100 - ordersPct

  const stats: StatCardData[] = [
    {
      label: 'Published Products',
      value: published,
      sub: `${unpublished} unpublished`,
      icon: <Package className="h-5 w-5" />,
      color: 'success',
    },
    {
      label: 'Pages',
      value: pages,
      icon: <FileText className="h-5 w-5" />,
      color: 'info',
    },
    {
      label: 'Orders This Month',
      value: ordersThisMonth,
      icon: <ShoppingBag className="h-5 w-5" />,
      color: 'warning',
    },
    {
      label: 'Revenue',
      value: `$${Number(revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      icon: <DollarSign className="h-5 w-5" />,
      color: 'success',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Website Analytics" subtitle="website" />

      <StatCards stats={stats} columns={4} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Product Status */}
        <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold">Product Status</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Published vs unpublished products</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-3 w-full rounded-full overflow-hidden bg-muted/50">
                {publishedPct > 0 && (
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${publishedPct}%` }}
                  />
                )}
                {unpublishedPct > 0 && (
                  <div
                    className="h-full bg-muted-foreground/30 transition-all"
                    style={{ width: `${unpublishedPct}%` }}
                  />
                )}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                <span className="text-muted-foreground">Published</span>
                <span className="font-semibold tabular-nums">{published}</span>
                <span className="text-muted-foreground">({publishedPct}%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 inline-block" />
                <span className="text-muted-foreground">Unpublished</span>
                <span className="font-semibold tabular-nums">{unpublished}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cart Health */}
        <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold">Cart Health</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Orders vs abandoned carts this month</p>
          </div>
          <div className="space-y-3">
            <div className="flex h-3 w-full rounded-full overflow-hidden bg-muted/50">
              {ordersPct > 0 && (
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${ordersPct}%` }}
                />
              )}
              {abandonedPct > 0 && (
                <div
                  className="h-full bg-amber-500/60 transition-all"
                  style={{ width: `${abandonedPct}%` }}
                />
              )}
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
                <span className="text-muted-foreground">Orders</span>
                <span className="font-semibold tabular-nums">{ordersThisMonth}</span>
                <span className="text-muted-foreground">({ordersPct}%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500/60 inline-block" />
                <span className="text-muted-foreground">Abandoned</span>
                <span className="font-semibold tabular-nums">{abandonedCarts}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
