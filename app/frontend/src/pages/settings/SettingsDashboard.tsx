import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import { Settings, Users, Building2, Globe, Shield, Database, Key, Bell } from 'lucide-react'
import { PageHeader, StatCards, type StatCardData } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

export default function SettingsDashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['settings-dashboard'],
    queryFn: async () => {
      const [users, companies] = await Promise.all([
        erpClient.raw.post('/model/res.users', { domain: [['active', '=', true]], fields: ['id'], limit: 1 }).then(r => r.data),
        erpClient.raw.post('/model/res.company', { fields: ['id'], limit: 1 }).then(r => r.data),
      ])
      return { users: users.total || 0, companies: companies.total || 0 }
    },
    staleTime: 60_000,
  })

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-48 rounded-xl" /><div className="grid grid-cols-2 gap-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div></div>
  }

  const stats: StatCardData[] = [
    { label: 'Users', value: data?.users || 0, sub: 'active', icon: <Users className="h-5 w-5" />, color: 'info', onClick: () => navigate('/admin/settings/users') },
    { label: 'Companies', value: data?.companies || 0, icon: <Building2 className="h-5 w-5" />, color: 'success', onClick: () => navigate('/admin/settings/companies') },
  ]

  const sections = [
    {
      title: 'Users & Access',
      items: [
        { label: 'Users', desc: 'Manage user accounts and access', icon: <Users className="h-5 w-5" />, path: '/settings/users' },
        { label: 'Companies', desc: 'Multi-company configuration', icon: <Building2 className="h-5 w-5" />, path: '/settings/companies' },
      ],
    },
    {
      title: 'Configuration',
      items: [
        { label: 'General Settings', desc: 'System-wide configuration', icon: <Settings className="h-5 w-5" />, path: '/settings/general' },
        { label: 'Technical', desc: 'Advanced technical settings', icon: <Database className="h-5 w-5" />, path: '/model/ir.config_parameter' },
      ],
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="configuration" />
      <StatCards stats={stats} columns={2} />

      {sections.map(section => (
        <div key={section.title} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{section.title}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {section.items.map(item => (
              <button key={item.path} onClick={() => navigate(item.path)}
                className="rounded-2xl border border-border/50 bg-card p-5 text-left transition-all hover:bg-muted/20 hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-2.5 text-primary">{item.icon}</div>
                  <div><p className="text-sm font-semibold">{item.label}</p><p className="text-xs text-muted-foreground">{item.desc}</p></div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
