import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Badge,
  Skeleton,
  CardTitle, CardDescription,
  cn,
} from '@mashora/design-system'
import {
  FileText, ClipboardCheck, Receipt, AlertTriangle, DollarSign,
  ArrowRight, ChevronRight, Plus,
} from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

const statItems = [
  {
    key: 'rfqs',
    title: 'Open RFQs',
    description: 'Requests for quotation',
    icon: FileText,
    format: (v: number) => String(v),
  },
  {
    key: 'to_approve',
    title: 'To Approve',
    description: 'Awaiting approval',
    icon: ClipboardCheck,
    format: (v: number) => String(v),
  },
  {
    key: 'late_deliveries',
    title: 'Late Deliveries',
    description: 'Past expected date',
    icon: AlertTriangle,
    format: (v: number) => String(v),
  },
  {
    key: 'month_spend',
    title: 'This Month',
    description: 'Purchase spend',
    icon: DollarSign,
    format: (v: number) => formatCurrency(v),
  },
]

const quickActions = [
  {
    label: 'New RFQ',
    description: 'Create a new request for quotation from a vendor.',
    icon: FileText,
    route: '/purchase/orders/new',
  },
  {
    label: 'Orders to Approve',
    description: 'Review and approve purchase orders awaiting sign-off.',
    icon: ClipboardCheck,
    route: '/purchase/orders?tab=to_approve',
  },
  {
    label: 'Orders to Invoice',
    description: 'Confirmed orders ready to be billed.',
    icon: Receipt,
    route: '/purchase/orders?tab=to_invoice',
  },
]

export default function PurchaseDashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-dashboard'],
    queryFn: () => erpClient.raw.get('/purchase/dashboard').then((r) => r.data),
  })

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Overview
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Purchase</h1>
          <p className="text-sm text-muted-foreground">
            Procurement overview and quick actions
          </p>
        </div>
        <Button
          className="rounded-2xl"
          onClick={() => navigate('/purchase/orders/new')}
        >
          <Plus className="h-4 w-4" />
          New RFQ
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statItems.map(({ key, title, description, icon: Icon, format }) => (
          <div
            key={key}
            className="group overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] transition-transform duration-300 hover:-translate-y-0.5"
          >
            <div className="p-6">
              <div className="mb-5 flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                    {title}
                  </p>
                  {isLoading ? (
                    <Skeleton className="h-9 w-20" />
                  ) : (
                    <div className="text-3xl font-semibold tracking-tight">
                      {format(data?.[key] ?? 0)}
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/60 p-3 text-muted-foreground transition-colors group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:border-zinc-700 dark:group-hover:bg-zinc-800 dark:group-hover:text-zinc-50">
                  <Icon className="size-5" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions + pipeline summary */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Quick actions */}
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)]">
          <div className="border-b border-border/70 bg-muted/20 px-6 py-4">
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription className="mt-1">Jump to common procurement tasks</CardDescription>
          </div>
          <div className="space-y-2 p-4">
            {quickActions.map(({ label, description, icon: Icon, route }) => (
              <button
                key={route}
                onClick={() => navigate(route)}
                className="group flex w-full items-center gap-4 rounded-2xl border border-border/70 bg-card/85 p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-zinc-900/20 hover:shadow-xl dark:hover:border-zinc-100/20"
              >
                <div className="shrink-0 rounded-xl border border-border/70 bg-muted/60 p-2.5 text-muted-foreground transition-colors group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:border-zinc-700 dark:group-hover:bg-zinc-800 dark:group-hover:text-zinc-50">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-xs leading-5 text-muted-foreground">{description}</p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </button>
            ))}
          </div>
        </div>

        {/* Pipeline summary */}
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)]">
          <div className="border-b border-border/70 bg-muted/20 px-6 py-4">
            <CardTitle>Pipeline Summary</CardTitle>
            <CardDescription className="mt-1">Current state of your procurement pipeline</CardDescription>
          </div>
          <div className="space-y-0 p-6">
            {[
              { label: 'Open RFQs', key: 'rfqs', badge: 'secondary' as const },
              { label: 'To Approve', key: 'to_approve', badge: 'warning' as const },
              { label: 'Confirmed POs', key: 'confirmed', badge: 'success' as const },
              { label: 'To Invoice', key: 'to_invoice', badge: 'info' as const },
            ].map(({ label, key, badge }, idx, arr) => (
              <div
                key={key}
                className={cn(
                  'flex items-center justify-between py-3.5 text-sm',
                  idx < arr.length - 1 && 'border-b border-border/50'
                )}
              >
                <span className="text-muted-foreground">{label}</span>
                <div className="flex items-center gap-2">
                  {isLoading ? (
                    <Skeleton className="h-5 w-8" />
                  ) : (
                    <Badge variant={badge} className="tabular-nums">
                      {data?.[key] ?? 0}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
            <div className="pt-4">
              <Button
                variant="outline"
                className="w-full rounded-2xl"
                onClick={() => navigate('/purchase/orders')}
              >
                View All Orders
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
