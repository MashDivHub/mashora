import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Card, CardTitle, CardDescription,
  Button, Badge, Skeleton, cn,
} from '@mashora/design-system'
import {
  PackageCheck, Truck, ArrowLeftRight, AlertTriangle,
  ArrowRight, ChevronRight, Package, Clock,
} from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

const statItems = [
  {
    key: 'receipts_ready',
    title: 'Receipts Ready',
    description: 'Ready to receive into stock',
    icon: PackageCheck,
  },
  {
    key: 'deliveries_ready',
    title: 'Deliveries Ready',
    description: 'Ready to ship to customer',
    icon: Truck,
  },
  {
    key: 'internal_ready',
    title: 'Internal Transfers',
    description: 'Ready to process internally',
    icon: ArrowLeftRight,
  },
  {
    key: 'late',
    title: 'Late Transfers',
    description: 'Past their scheduled date',
    icon: AlertTriangle,
  },
]

const quickActions = [
  {
    label: 'View Receipts',
    description: 'Incoming stock from suppliers and vendors.',
    icon: PackageCheck,
    route: '/inventory/transfers?type=incoming',
    accent: 'text-emerald-500',
  },
  {
    label: 'View Deliveries',
    description: 'Outgoing shipments to customers.',
    icon: Truck,
    route: '/inventory/transfers?type=outgoing',
    accent: 'text-blue-500',
  },
  {
    label: 'Internal Transfers',
    description: 'Move stock between warehouse locations.',
    icon: ArrowLeftRight,
    route: '/inventory/transfers?type=internal',
    accent: 'text-violet-500',
  },
  {
    label: 'Stock Levels',
    description: 'View on-hand, reserved, and available quantities.',
    icon: Package,
    route: '/inventory/stock',
    accent: 'text-amber-500',
  },
]

export default function InventoryDashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-dashboard'],
    queryFn: () => erpClient.raw.get('/inventory/dashboard').then((r) => r.data),
  })

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Warehouse
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Warehouse operations overview and quick actions
          </p>
        </div>
        <Button
          className="rounded-2xl"
          onClick={() => navigate('/inventory/transfers/new')}
        >
          <ArrowLeftRight className="h-4 w-4" />
          New Transfer
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statItems.map(({ key, title, description, icon: Icon }) => (
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
                    <Skeleton className="h-9 w-16" />
                  ) : (
                    <div className={cn(
                      'text-3xl font-semibold tracking-tight',
                      key === 'late' && (data?.[key] ?? 0) > 0 && 'text-destructive',
                    )}>
                      {data?.[key] ?? 0}
                    </div>
                  )}
                </div>
                <div className={cn(
                  'rounded-2xl border border-border/70 bg-muted/60 p-3 text-muted-foreground transition-colors',
                  'group-hover:bg-zinc-900 group-hover:text-white',
                  'dark:group-hover:border-zinc-700 dark:group-hover:bg-zinc-800 dark:group-hover:text-zinc-50',
                )}>
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
            <CardDescription className="mt-1">Jump to common inventory tasks</CardDescription>
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

        {/* Operations summary */}
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)]">
          <div className="border-b border-border/70 bg-muted/20 px-6 py-4">
            <CardTitle>Operations Summary</CardTitle>
            <CardDescription className="mt-1">Current state of warehouse operations</CardDescription>
          </div>
          <div className="p-6">
            <div className="space-y-0">
              {[
                { label: 'Receipts Ready', key: 'receipts_ready', badge: 'success' as const },
                { label: 'Deliveries Ready', key: 'deliveries_ready', badge: 'success' as const },
                { label: 'Internal Ready', key: 'internal_ready', badge: 'info' as const },
                { label: 'Waiting Availability', key: 'waiting', badge: 'warning' as const },
                { label: 'Late Transfers', key: 'late', badge: 'destructive' as const },
              ].map(({ label, key, badge }, idx, arr) => (
                <div
                  key={key}
                  className={cn(
                    'flex items-center justify-between py-3.5 text-sm',
                    idx < arr.length - 1 && 'border-b border-border/50',
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
            </div>
            <div className="pt-4">
              <Button
                variant="outline"
                className="w-full rounded-2xl"
                onClick={() => navigate('/inventory/transfers')}
              >
                View All Transfers
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
