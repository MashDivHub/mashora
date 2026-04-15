import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import { Package, Plus, Truck, FileText, DollarSign, Clock, AlertTriangle } from 'lucide-react'
import { PageHeader, StatCards, type StatCardData } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

export default function PurchaseDashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-dashboard'],
    queryFn: () => erpClient.raw.get('/purchase/dashboard').then(r => r.data),
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  const fmtCur = (v: number) =>
    v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v.toFixed(0)}`

  const lateCount: number = data?.late_deliveries ?? 0
  const toInvoiceCount: number = data?.to_invoice ?? 0

  const stats: StatCardData[] = [
    {
      label: 'RFQs',
      value: data?.rfqs ?? 0,
      sub: 'draft & sent',
      icon: <FileText className="h-5 w-5" />,
      color: 'info',
      onClick: () => navigate('/admin/purchase/orders?filter=rfq'),
    },
    {
      label: 'To Approve',
      value: data?.to_approve ?? 0,
      sub: 'awaiting approval',
      icon: <Clock className="h-5 w-5" />,
      color: 'warning',
      onClick: () => navigate('/admin/purchase/orders?filter=to_approve'),
    },
    {
      label: 'Confirmed',
      value: data?.confirmed ?? 0,
      sub: 'purchase orders',
      icon: <Package className="h-5 w-5" />,
      color: 'success',
      onClick: () => navigate('/admin/purchase/orders?filter=orders'),
    },
    {
      label: 'Month Spend',
      value: fmtCur(data?.month_spend ?? 0),
      sub: 'this month',
      icon: <DollarSign className="h-5 w-5" />,
      color: 'default',
    },
  ]

  const quickActions = [
    { label: 'Purchase Orders', desc: 'Browse all purchase orders', icon: Package, path: '/purchase/orders' },
    { label: 'New RFQ', desc: 'Create a request for quotation', icon: Plus, path: '/purchase/orders/new' },
    {
      label: 'Late Deliveries',
      desc: lateCount > 0 ? `${lateCount} overdue` : 'No late deliveries',
      icon: Truck,
      path: '/purchase/orders?filter=late',
      badge: lateCount > 0 ? lateCount : null,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Purchase" subtitle="overview" />

      <StatCards stats={stats} columns={4} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {quickActions.map(item => {
          const Icon = item.icon
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="rounded-2xl border border-border/50 bg-card p-5 text-left transition-all hover:bg-muted/20 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{item.label}</p>
                    {item.badge != null && (
                      <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-xs font-medium text-amber-500">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-3">
        <div
          className={`rounded-2xl border px-5 py-4 flex items-center gap-3 ${
            lateCount > 0
              ? 'border-red-500/30 bg-red-500/5'
              : 'border-border/50 bg-card'
          }`}
        >
          <AlertTriangle
            className={`h-5 w-5 ${lateCount > 0 ? 'text-red-500' : 'text-muted-foreground'}`}
          />
          <div>
            <p className={`text-2xl font-bold ${lateCount > 0 ? 'text-red-500' : ''}`}>
              {lateCount}
            </p>
            <p className="text-xs text-muted-foreground">Late Deliveries</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card px-5 py-4 flex items-center gap-3">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-2xl font-bold">{toInvoiceCount}</p>
            <p className="text-xs text-muted-foreground">To Invoice</p>
          </div>
        </div>
      </div>
    </div>
  )
}
