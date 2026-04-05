import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  CardTitle, CardDescription, Button, Skeleton,
} from '@mashora/design-system'
import {
  Globe, Globe2, ShoppingBag, FileText, DollarSign, ShoppingCart,
  ArrowRight, Package,
} from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatItem {
  title: string
  value: string | number
  icon: React.ElementType
  description: string
}

function StatCard({ title, value, icon: Icon, description }: StatItem) {
  return (
    <div className="group overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] transition-transform duration-300 hover:-translate-y-0.5">
      <div className="p-6">
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
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

// ─── Section Card wrapper ─────────────────────────────────────────────────────

function SectionCard({
  title,
  description,
  children,
  noPadding = false,
}: {
  title: string
  description?: string
  children: React.ReactNode
  noPadding?: boolean
}) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
      <div className="border-b border-border/70 bg-muted/20 px-6 py-4">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription className="mt-0.5">{description}</CardDescription>}
      </div>
      <div className={noPadding ? '' : 'p-6'}>{children}</div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WebsiteDashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['website-dashboard'],
    queryFn: () => erpClient.raw.get('/website/dashboard').then((r) => r.data),
  })

  const products = data?.products ?? {}

  const stats: StatItem[] = [
    {
      title: 'Published Products',
      value: isLoading ? '—' : products.published ?? 0,
      icon: Globe,
      description: 'Visible on storefront',
    },
    {
      title: 'Online Orders',
      value: isLoading ? '—' : data?.orders_this_month ?? 0,
      icon: ShoppingBag,
      description: 'This month',
    },
    {
      title: 'Online Revenue',
      value: isLoading ? '—' : formatCurrency(data?.online_revenue ?? 0),
      icon: DollarSign,
      description: 'This month',
    },
    {
      title: 'Abandoned Carts',
      value: isLoading ? '—' : data?.abandoned_carts ?? 0,
      icon: ShoppingCart,
      description: 'With items',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Overview
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Website &amp; eCommerce</h1>
          <p className="text-sm text-muted-foreground">Online store management</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Middle row: Products summary + Content summary + Quick actions */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Products summary */}
        <SectionCard title="Products" description="Storefront catalogue status">
          <div className="space-y-0">
            {[
              {
                label: 'Published',
                value: isLoading ? null : products.published ?? 0,
                accent: 'text-emerald-600 dark:text-emerald-400',
              },
              {
                label: 'Unpublished',
                value: isLoading ? null : products.unpublished ?? 0,
                accent: '',
              },
              {
                label: 'Total',
                value: isLoading ? null : (products.published ?? 0) + (products.unpublished ?? 0),
                accent: '',
              },
            ].map(({ label, value, accent }, idx, arr) => (
              <div
                key={label}
                className={`flex items-center justify-between py-3 text-sm ${idx < arr.length - 1 ? 'border-b border-border/50' : ''}`}
              >
                <span className="text-muted-foreground">{label}</span>
                {value === null ? (
                  <Skeleton className="h-4 w-8" />
                ) : (
                  <span className={`font-semibold font-mono tabular-nums ${accent}`}>{value}</span>
                )}
              </div>
            ))}
          </div>
          <div className="pt-4">
            <Button
              variant="outline"
              className="w-full rounded-2xl"
              onClick={() => navigate('/website/products')}
            >
              Manage Products
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </SectionCard>

        {/* Content summary */}
        <SectionCard title="Content" description="CMS pages on your website">
          <div className="space-y-0">
            <div className="flex items-center justify-between py-3 text-sm border-b border-border/50">
              <span className="text-muted-foreground">Total Pages</span>
              {isLoading ? (
                <Skeleton className="h-4 w-8" />
              ) : (
                <span className="font-semibold font-mono tabular-nums">{data?.pages ?? 0}</span>
              )}
            </div>
          </div>
          <div className="pt-4">
            <Button
              variant="outline"
              className="w-full rounded-2xl"
              onClick={() => navigate('/website/pages')}
            >
              Manage Pages
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </SectionCard>

        {/* Quick actions */}
        <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
          <div className="border-b border-border/70 bg-muted/20 px-6 py-4">
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription className="mt-0.5">Jump to common website tasks</CardDescription>
          </div>
          <div className="p-4 space-y-2">
            {[
              {
                label: 'Product Catalog',
                description: 'Browse and manage all storefront products.',
                icon: ShoppingBag,
                route: '/website/products',
              },
              {
                label: 'CMS Pages',
                description: 'Edit and publish website content pages.',
                icon: FileText,
                route: '/website/pages',
              },
              {
                label: 'Unpublished',
                description: 'Review products hidden from the storefront.',
                icon: Globe2,
                route: '/website/products',
              },
            ].map(({ label, description, icon: Icon, route }) => (
              <button
                key={label}
                onClick={() => navigate(route)}
                className="group w-full flex items-center gap-4 rounded-2xl border border-border/70 bg-card/85 p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-zinc-900/20 hover:shadow-xl dark:hover:border-zinc-100/20"
              >
                <div className="rounded-xl border border-border/70 bg-muted/60 p-2.5 text-muted-foreground transition-colors group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:border-zinc-700 dark:group-hover:bg-zinc-800 dark:group-hover:text-zinc-50 shrink-0">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-xs text-muted-foreground leading-5">{description}</p>
                </div>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Store overview — full width breakdown */}
      <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
        <div className="border-b border-border/70 bg-muted/20 px-6 py-4 flex items-center justify-between">
          <div>
            <CardTitle>Store Overview</CardTitle>
            <CardDescription className="mt-0.5">Key eCommerce metrics at a glance</CardDescription>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/60 p-2.5 text-muted-foreground">
            <Package className="size-4" />
          </div>
        </div>
        <div className="divide-y divide-border/50">
          {[
            { label: 'Published Products', value: isLoading ? null : products.published ?? 0 },
            { label: 'Unpublished Products', value: isLoading ? null : products.unpublished ?? 0 },
            { label: 'Orders This Month', value: isLoading ? null : data?.orders_this_month ?? 0 },
            { label: 'Abandoned Carts', value: isLoading ? null : data?.abandoned_carts ?? 0 },
            { label: 'Online Revenue', value: isLoading ? null : formatCurrency(data?.online_revenue ?? 0), mono: true },
          ].map(({ label, value, mono }) => (
            <div key={label} className="flex items-center justify-between px-6 py-3.5">
              <span className="text-sm text-muted-foreground">{label}</span>
              {value === null ? (
                <Skeleton className="h-4 w-16" />
              ) : (
                <span className={`text-sm font-medium ${mono ? 'font-mono tabular-nums' : ''}`}>{value}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
