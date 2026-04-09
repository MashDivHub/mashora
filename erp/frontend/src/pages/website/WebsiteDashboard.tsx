import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import {
  FileText, Menu, Newspaper, Package, Tag, ShoppingCart,
  GraduationCap, MessageCircle, BarChart3,
} from 'lucide-react'
import { PageHeader, StatCards, type StatCardData } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

export default function WebsiteDashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['website-dashboard'],
    queryFn: () =>
      erpClient.raw.get('/website/dashboard').then(r => r.data),
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

  const revenue: number = data?.online_revenue ?? 0

  const stats: StatCardData[] = [
    {
      label: 'Published Products',
      value: data?.products?.published ?? 0,
      sub: 'live in store',
      icon: <Package className="h-5 w-5" />,
      color: 'success',
      onClick: () => navigate('/website/products'),
    },
    {
      label: 'Pages',
      value: data?.pages ?? 0,
      sub: 'CMS pages',
      icon: <FileText className="h-5 w-5" />,
      color: 'info',
      onClick: () => navigate('/website/pages'),
    },
    {
      label: 'Orders This Month',
      value: data?.orders_this_month ?? 0,
      sub: 'e-commerce orders',
      icon: <ShoppingCart className="h-5 w-5" />,
      color: 'warning',
      onClick: () => navigate('/website/orders'),
    },
    {
      label: 'Online Revenue',
      value: `$${revenue.toLocaleString()}`,
      sub: 'this month',
      icon: <BarChart3 className="h-5 w-5" />,
      color: 'default',
      onClick: () => navigate('/website/analytics'),
    },
  ]

  const groups = [
    {
      title: 'Content',
      items: [
        { label: 'CMS Pages', desc: 'Manage website pages', icon: <FileText className="h-5 w-5" />, path: '/website/pages' },
        { label: 'Menus', desc: 'Configure site navigation', icon: <Menu className="h-5 w-5" />, path: '/website/menus' },
        { label: 'Blog', desc: 'Posts and blog articles', icon: <Newspaper className="h-5 w-5" />, path: '/website/blog' },
      ],
    },
    {
      title: 'E-Commerce',
      items: [
        { label: 'Products', desc: 'Manage your product catalog', icon: <Package className="h-5 w-5" />, path: '/website/products' },
        { label: 'Categories', desc: 'Organize product categories', icon: <Tag className="h-5 w-5" />, path: '/website/categories' },
        { label: 'E-Commerce Orders', desc: 'View and process orders', icon: <ShoppingCart className="h-5 w-5" />, path: '/website/orders' },
      ],
    },
    {
      title: 'Learning & Community',
      items: [
        { label: 'Courses', desc: 'Online courses and e-learning', icon: <GraduationCap className="h-5 w-5" />, path: '/website/courses' },
        { label: 'Forum', desc: 'Community discussion boards', icon: <MessageCircle className="h-5 w-5" />, path: '/website/forum' },
      ],
    },
    {
      title: 'Analytics',
      items: [
        { label: 'Visitor Analytics', desc: 'Traffic and visitor insights', icon: <BarChart3 className="h-5 w-5" />, path: '/website/analytics' },
      ],
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Website" subtitle="overview" />
      <StatCards stats={stats} columns={4} />
      <div className="space-y-4">
        {groups.map(group => (
          <div key={group.title}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.title}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {group.items.map(item => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="rounded-2xl border border-border/50 bg-card p-5 text-left transition-all hover:bg-muted/20 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-primary/10 p-2.5 text-primary">{item.icon}</div>
                    <div>
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
