import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import { Globe, FileText, Users, Eye } from 'lucide-react'
import { PageHeader, StatCards, type StatCardData } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

export default function WebsiteDashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['website-dashboard'],
    queryFn: async () => {
      const [pages, published, visitors] = await Promise.all([
        erpClient.raw.post('/model/website.page', { fields: ['id'], limit: 1 }).then(r => r.data),
        erpClient.raw.post('/model/website.page', { domain: [['is_published', '=', true]], fields: ['id'], limit: 1 }).then(r => r.data),
        erpClient.raw.post('/model/website.visitor', { fields: ['id'], limit: 1 }).then(r => r.data).catch(() => ({ total: 0 })),
      ])
      return { pages: pages.total || 0, published: published.total || 0, visitors: visitors.total || 0 }
    },
    staleTime: 60_000,
  })

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-48 rounded-xl" /><div className="grid grid-cols-2 md:grid-cols-3 gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div></div>
  }

  const stats: StatCardData[] = [
    { label: 'Total Pages', value: data?.pages || 0, icon: <FileText className="h-5 w-5" />, color: 'info', onClick: () => navigate('/website/pages') },
    { label: 'Published', value: data?.published || 0, icon: <Eye className="h-5 w-5" />, color: 'success', onClick: () => navigate('/website/pages?filter=published') },
    { label: 'Visitors', value: data?.visitors || 0, icon: <Users className="h-5 w-5" />, color: 'default' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Website" subtitle="overview" />
      <StatCards stats={stats} columns={3} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { label: 'Pages', desc: 'Manage website pages', icon: <FileText className="h-5 w-5" />, path: '/website/pages' },
          { label: 'Go to Website', desc: 'View your public website', icon: <Globe className="h-5 w-5" />, path: '#', external: true },
        ].map(item => (
          <button key={item.label} onClick={() => item.external ? window.open('/', '_blank') : navigate(item.path)}
            className="rounded-2xl border border-border/50 bg-card p-5 text-left transition-all hover:bg-muted/20 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">{item.icon}</div>
              <div><p className="text-sm font-semibold">{item.label}</p><p className="text-xs text-muted-foreground">{item.desc}</p></div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
