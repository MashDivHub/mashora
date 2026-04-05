import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { PageHeader, Card, CardContent, CardHeader, CardTitle } from '@mashora/design-system'
import {
  Users,
  ShoppingCart,
  DollarSign,
  Package,
  ArrowRight,
  Calculator,
  Target,
  FolderKanban,
  Warehouse,
} from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrmHealth {
  status: string
  database: string
  models_loaded: number
  user_count: number
}

// ─── Stat Cards ───────────────────────────────────────────────────────────────

interface StatItem {
  title: string
  value: string | number
  icon: React.ElementType
  hint: string
}

function DashStatCard({ title, value, icon: Icon, hint }: StatItem) {
  return (
    <Card className="group overflow-hidden bg-card/90 transition-transform duration-300 hover:-translate-y-0.5">
      <CardContent className="p-6">
        <div className="mb-5 flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              {title}
            </p>
            <div className="text-3xl font-semibold tracking-tight">{value}</div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/60 p-3 text-muted-foreground transition-colors group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:border-zinc-700 dark:group-hover:bg-zinc-800 dark:group-hover:text-zinc-50">
            <Icon className="size-5" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}

// ─── Quick Actions ─────────────────────────────────────────────────────────────

interface QuickAction {
  to: string
  label: string
  description: string
  icon: React.ElementType
}

const quickActions: QuickAction[] = [
  {
    to: '/sales',
    label: 'Sales',
    description: 'Manage quotations, sales orders, and revenue pipeline from one place.',
    icon: ShoppingCart,
  },
  {
    to: '/accounting',
    label: 'Accounting',
    description: 'Invoices, payments, and chart of accounts at a glance.',
    icon: Calculator,
  },
  {
    to: '/crm',
    label: 'CRM',
    description: 'Track leads, opportunities, and your sales funnel progression.',
    icon: Target,
  },
  {
    to: '/inventory',
    label: 'Inventory',
    description: 'Stock levels, transfers, and warehouse operations in one view.',
    icon: Warehouse,
  },
  {
    to: '/projects',
    label: 'Projects',
    description: 'Tasks, milestones, and team workload across all active projects.',
    icon: FolderKanban,
  },
  {
    to: '/partners',
    label: 'Contacts',
    description: 'Customers, vendors, and all partner relationships in one registry.',
    icon: Users,
  },
]

// ─── ORM Health ────────────────────────────────────────────────────────────────

function OrmHealthCard({ data }: { data: OrmHealth }) {
  const isHealthy = data.status === 'ok' || data.status === 'healthy'

  return (
    <Card className="overflow-hidden bg-card/90">
      <CardHeader className="border-b border-border/70 bg-muted/20">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">System Health</CardTitle>
          <div className="flex items-center gap-2">
            <span
              className={`size-2 rounded-full ${isHealthy ? 'bg-emerald-500' : 'bg-red-500'} shadow-sm ${isHealthy ? 'shadow-emerald-500/40' : 'shadow-red-500/40'}`}
            />
            <span
              className={`text-xs font-semibold uppercase tracking-[0.2em] ${isHealthy ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}
            >
              {data.status}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/50">
          {[
            { label: 'Database', value: data.database, mono: true },
            { label: 'Models loaded', value: data.models_loaded, mono: true },
            { label: 'Active users', value: data.user_count, mono: true },
          ].map(({ label, value, mono }) => (
            <div key={label} className="flex items-center justify-between px-6 py-3.5">
              <span className="text-sm text-muted-foreground">{label}</span>
              <span className={`text-sm font-medium ${mono ? 'font-mono' : ''}`}>{value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: healthData } = useQuery<OrmHealth>({
    queryKey: ['health'],
    queryFn: () => erpClient.raw.get('/health/orm').then((r) => r.data),
  })

  const { data: partnerCount } = useQuery<number>({
    queryKey: ['partners', 'count'],
    queryFn: () => erpClient.list('res.partner', { limit: 1 }).then((r) => r.total),
  })

  const stats: StatItem[] = [
    {
      title: 'Contacts',
      value: partnerCount ?? '—',
      icon: Users,
      hint: 'Total partner records in the system.',
    },
    {
      title: 'Sales Orders',
      value: '—',
      icon: ShoppingCart,
      hint: 'Live data arrives in Phase 1B.',
    },
    {
      title: 'Revenue',
      value: '—',
      icon: DollarSign,
      hint: 'Accounting module lands in Phase 1A.',
    },
    {
      title: 'Products',
      value: '—',
      icon: Package,
      hint: 'Inventory catalogue coming Phase 1D.',
    },
  ]

  return (
    <div className="space-y-10">
      {/* Header */}
      <PageHeader
        eyebrow="Overview"
        title="Welcome back"
        description="Run operations, track performance, and manage your entire business from one focused workspace."
      />

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <DashStatCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
          Modules
        </p>
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {quickActions.map(({ to, label, description, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group rounded-3xl border border-border/70 bg-card/85 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-zinc-900/20 hover:shadow-xl dark:hover:border-zinc-100/20"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-2xl border border-border/70 bg-muted/60 p-3 text-zinc-900 transition-colors group-hover:bg-zinc-900 group-hover:text-white dark:text-zinc-100 dark:group-hover:border-zinc-700 dark:group-hover:bg-zinc-800 dark:group-hover:text-zinc-50">
                  <Icon className="size-5" />
                </div>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">{label}</h2>
                <p className="text-sm leading-6 text-muted-foreground">{description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ORM health */}
      {healthData ? (
        <OrmHealthCard data={healthData} />
      ) : (
        <Card className="overflow-hidden bg-card/90">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Loading system health...</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
