import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import {
  ShoppingCart, Plus, Gift, Users, DollarSign, TrendingUp, FileText, Clock,
} from 'lucide-react'
import { PageHeader, StatCards, type StatCardData } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

export default function SalesDashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['sales-dashboard'],
    queryFn: () => erpClient.raw.get('/sales/dashboard').then(r => r.data),
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

  const stats: StatCardData[] = [
    {
      label: 'Quotations',
      value: data?.quotations ?? 0,
      sub: 'draft & sent',
      icon: <FileText className="h-5 w-5" />,
      color: 'info',
      onClick: () => navigate('/sales/orders?filter=quotations'),
    },
    {
      label: 'Confirmed',
      value: data?.confirmed ?? 0,
      sub: 'sales orders',
      icon: <ShoppingCart className="h-5 w-5" />,
      color: 'success',
      onClick: () => navigate('/sales/orders?filter=orders'),
    },
    {
      label: 'To Invoice',
      value: data?.to_invoice ?? 0,
      sub: 'ready for invoicing',
      icon: <Clock className="h-5 w-5" />,
      color: 'warning',
      onClick: () => navigate('/sales/orders?filter=to_invoice'),
    },
    {
      label: 'Month Revenue',
      value: fmtCur(data?.month_revenue ?? 0),
      sub: 'this month',
      icon: <DollarSign className="h-5 w-5" />,
      color: 'default',
    },
  ]

  const quickActions = [
    { label: 'Orders', desc: 'Browse all sales orders', icon: ShoppingCart, path: '/sales/orders' },
    { label: 'New Quotation', desc: 'Create a new quotation', icon: Plus, path: '/sales/orders/new' },
    { label: 'Loyalty Programs', desc: 'Manage reward programs', icon: Gift, path: '/sales/loyalty' },
    { label: 'Sales Teams', desc: 'Manage your sales teams', icon: Users, path: '/sales/teams' },
    { label: 'Commission', desc: 'Track sales commissions', icon: DollarSign, path: '/sales/commission' },
    {
      label: 'Margin Analysis',
      desc: 'Available per order',
      icon: TrendingUp,
      path: null,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Sales" subtitle="overview" />

      <StatCards stats={stats} columns={4} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {quickActions.map(item => {
          const Icon = item.icon
          if (item.path === null) {
            return (
              <div
                key={item.label}
                className="rounded-2xl border border-border/50 bg-card p-5 text-left opacity-60"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-muted/30 p-2.5 text-muted-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              </div>
            )
          }
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path!)}
              className="rounded-2xl border border-border/50 bg-card p-5 text-left transition-all hover:bg-muted/20 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-1">
          <p className="text-sm font-semibold mb-3">Orders &amp; Invoicing</p>
          {[
            { label: 'All Orders', path: '/sales/orders' },
            { label: 'To Invoice', path: '/sales/orders?filter=to_invoice' },
          ].map(link => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className="block w-full rounded-xl px-3 py-2 text-sm text-left hover:bg-muted/20 transition-colors"
            >
              {link.label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-1">
          <p className="text-sm font-semibold mb-3">Marketing &amp; Analytics</p>
          {[
            { label: 'Loyalty Programs', path: '/sales/loyalty' },
            { label: 'Sales Teams', path: '/sales/teams' },
            { label: 'Commission Dashboard', path: '/sales/commission' },
          ].map(link => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className="block w-full rounded-xl px-3 py-2 text-sm text-left hover:bg-muted/20 transition-colors"
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
