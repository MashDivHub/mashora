import { useEffect, useState } from 'react'
import { Building2, PackageCheck, ShieldCheck, Ticket, Users } from 'lucide-react'
import { getStats, listAllTenants, listAllTickets, listPendingAddons, updateAddonStatus, type PlatformStats } from '../api/admin'
import { Notice } from '@/components/app/notice'
import { PageHeader } from '@/components/app/page-header'
import { StatCard } from '@/components/app/stat-card'
import { StatusBadge } from '@/components/app/status-badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Tab = 'tenants' | 'tickets' | 'addons'

export default function Admin() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [tenants, setTenants] = useState<any[]>([])
  const [tickets, setTickets] = useState<any[]>([])
  const [addons, setAddons] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('tenants')
  const [tabLoading, setTabLoading] = useState(false)
  const [error, setError] = useState('')
  const [addonActionId, setAddonActionId] = useState<string | null>(null)

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(() => setError('Failed to load platform stats.'))
      .finally(() => setStatsLoading(false))

    void loadTab('tenants')
  }, [])

  async function loadTab(tab: Tab) {
    setTabLoading(true)
    setError('')
    try {
      if (tab === 'tenants') {
        setTenants(await listAllTenants())
      } else if (tab === 'tickets') {
        setTickets(await listAllTickets())
      } else {
        setAddons(await listPendingAddons())
      }
    } catch {
      setError(`Failed to load ${tab}.`)
    } finally {
      setTabLoading(false)
    }
  }

  function switchTab(tab: Tab) {
    setActiveTab(tab)
    void loadTab(tab)
  }

  async function handleAddonAction(addonId: string, status: string) {
    setAddonActionId(addonId)
    try {
      await updateAddonStatus(addonId, status)
      setAddons((prev) => prev.filter((addon) => addon.id !== addonId))
    } catch {
      setError('Failed to update addon status.')
    } finally {
      setAddonActionId(null)
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Platform operations"
        description="Cross-platform insight into organizations, subscriptions, support load, and marketplace approvals."
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {statsLoading ? (
        <div className="rounded-3xl border border-border/70 bg-card/90 p-6 text-sm text-muted-foreground">Loading stats...</div>
      ) : stats ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard title="Organizations" value={stats.total_orgs} icon={Building2} />
          <StatCard title="Users" value={stats.total_users} icon={Users} />
          <StatCard title="Tenants" value={stats.total_tenants} icon={ShieldCheck} />
          <StatCard title="Subscriptions" value={stats.active_subscriptions} icon={PackageCheck} />
          <StatCard
            title="MRR"
            value={`$${(stats.monthly_revenue_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={Ticket}
          />
        </div>
      ) : null}

      <div className="rounded-3xl border border-border/70 bg-card/90 p-6">
        <Tabs value={activeTab} onValueChange={(value) => switchTab(value as Tab)}>
          <TabsList className="mb-2">
            <TabsTrigger value="tenants">Tenants</TabsTrigger>
            <TabsTrigger value="tickets">Tickets</TabsTrigger>
            <TabsTrigger value="addons">Addon approvals</TabsTrigger>
          </TabsList>

          <TabsContent value="tenants">
            {tabLoading ? (
              <div className="py-6 text-sm text-muted-foreground">Loading tenants...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>DB name</TableHead>
                    <TableHead>Subdomain</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">No tenants found.</TableCell>
                    </TableRow>
                  ) : (
                    tenants.map((tenant, index) => (
                      <TableRow key={tenant.id ?? index}>
                        <TableCell className="font-medium">{tenant.org_name ?? '-'}</TableCell>
                        <TableCell>{tenant.db_name ?? '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{tenant.subdomain ?? '-'}</TableCell>
                        <TableCell><StatusBadge value={tenant.status ?? 'pending'} /></TableCell>
                        <TableCell className="text-muted-foreground">
                          {tenant.created_at ? new Date(tenant.created_at).toLocaleDateString() : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="tickets">
            {tabLoading ? (
              <div className="py-6 text-sm text-muted-foreground">Loading tickets...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">No tickets found.</TableCell>
                    </TableRow>
                  ) : (
                    tickets.map((ticket, index) => (
                      <TableRow key={ticket.id ?? index}>
                        <TableCell className="font-medium">{ticket.subject ?? '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{ticket.user_email ?? ticket.user ?? '-'}</TableCell>
                        <TableCell><StatusBadge value={ticket.priority ?? 'medium'} /></TableCell>
                        <TableCell><StatusBadge value={ticket.status ?? 'open'} /></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="addons">
            {tabLoading ? (
              <div className="py-6 text-sm text-muted-foreground">Loading addon approvals...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Publisher</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {addons.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">No pending addon approvals.</TableCell>
                    </TableRow>
                  ) : (
                    addons.map((addon, index) => (
                      <TableRow key={addon.id ?? index}>
                        <TableCell className="font-medium">{addon.display_name ?? addon.name ?? addon.technical_name ?? '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{addon.publisher ?? addon.org_name ?? '-'}</TableCell>
                        <TableCell>{addon.category ?? '-'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {addon.created_at ? new Date(addon.created_at).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col justify-end gap-2 sm:flex-row">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={addonActionId === addon.id}
                              onClick={() => handleAddonAction(addon.id, 'published')}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={addonActionId === addon.id}
                              onClick={() => handleAddonAction(addon.id, 'rejected')}
                            >
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
