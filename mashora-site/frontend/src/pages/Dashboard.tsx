import { useEffect, useState } from 'react'
import { ArrowRight, Building2, CircleDollarSign, LifeBuoy, Rocket, Shield } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getSubscriptions, type SubscriptionResponse } from '../api/subscriptions'
import { listTenants, suspendTenant, type Tenant } from '../api/tenants'
import { useAuthStore } from '../store/authStore'
import { EmptyState } from '@/components/app/empty-state'
import { Notice } from '@/components/app/notice'
import { PageHeader } from '@/components/app/page-header'
import { SectionCard } from '@/components/app/section-card'
import { StatCard } from '@/components/app/stat-card'
import { StatusBadge } from '@/components/app/status-badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const planLabels: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
}

const quickLinkCards = [
  {
    to: '/dashboard/upgrades',
    label: 'Upgrades',
    description: 'Review pending releases and trigger safer upgrade windows.',
    icon: Rocket,
  },
  {
    to: '/dashboard/support',
    label: 'Support',
    description: 'Track active customer tickets and keep response time under control.',
    icon: LifeBuoy,
  },
  {
    to: '/dashboard/admin',
    label: 'Admin',
    description: 'Monitor tenants, platform health, and addon approval activity.',
    icon: Shield,
  },
]

export default function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null)

  useEffect(() => {
    listTenants()
      .then(setTenants)
      .catch(() => setError('Failed to load tenants.'))
      .finally(() => setLoading(false))

    getSubscriptions()
      .then((subs) => {
        const active = subs.find((item) => item.status === 'active' || item.status === 'trialing') ?? null
        setSubscription(active)
      })
      .catch(() => {
        // Best-effort summary only.
      })
  }, [])

  async function handleSuspend(id: string) {
    try {
      const updated = await suspendTenant(id)
      setTenants((prev) => prev.map((tenant) => (tenant.id === updated.id ? updated : tenant)))
    } catch {
      setError('Failed to suspend tenant.')
    }
  }

  const activeCount = tenants.filter((tenant) => tenant.status === 'active').length
  const suspendedCount = tenants.filter((tenant) => tenant.status === 'suspended').length

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Overview"
        title={`Welcome back${user?.org_name ? `, ${user.org_name}` : ''}`}
        description="Run tenant provisioning, billing, upgrades, support, and governance from one focused workspace."
        actions={
          <Button asChild className="w-full rounded-2xl sm:w-auto">
            <Link to="/dashboard/tenants/new">Create new instance</Link>
          </Button>
        }
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <StatCard title="Tenant instances" value={tenants.length} icon={Building2} hint="All active and suspended workspaces." />
        <StatCard title="Active spaces" value={activeCount} icon={Shield} hint={`${suspendedCount} suspended tenant${suspendedCount === 1 ? '' : 's'}.`} />
        <StatCard
          title="Current plan"
          value={subscription ? planLabels[subscription.plan] ?? subscription.plan : 'Free'}
          icon={CircleDollarSign}
          hint={
            subscription?.current_period_end
              ? `Renews ${new Date(subscription.current_period_end).toLocaleDateString()}`
              : 'No paid subscription yet.'
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {quickLinkCards.map(({ to, label, description, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="group rounded-3xl border border-border/70 bg-card/85 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-zinc-900/20 hover:shadow-xl dark:hover:border-zinc-100/20"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="rounded-2xl border border-border/70 bg-muted/60 p-3 text-zinc-900 dark:text-zinc-100">
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

      <SectionCard
        title="Tenant instances"
        description="Provisioned databases and their current operating status."
        actions={
          <Button variant="outline" asChild>
            <Link to="/dashboard/tenants/new">Add tenant</Link>
          </Button>
        }
        contentClassName="p-0"
      >
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading tenants...</div>
        ) : tenants.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No tenant instances yet"
              description="Create your first isolated workspace to start managing customers and operations."
              action={
                <Button asChild className="rounded-2xl">
                  <Link to="/dashboard/tenants/new">Create first instance</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Database</TableHead>
                <TableHead>Subdomain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell className="font-medium">{tenant.db_name}</TableCell>
                  <TableCell className="text-muted-foreground">{tenant.subdomain}</TableCell>
                  <TableCell>
                    <StatusBadge value={tenant.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(tenant.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {tenant.status === 'active' ? (
                      <Button variant="outline" size="sm" onClick={() => handleSuspend(tenant.id)}>
                        Suspend
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  )
}
