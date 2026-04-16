import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import {
  Package, Tag, Layers, DollarSign, BarChart3, Box,
} from 'lucide-react'
import { PageHeader, StatCards, type StatCardData } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

export default function ProductsDashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['products-dashboard'],
    queryFn: async () => {
      const [products, categories] = await Promise.all([
        erpClient.raw.post('/model/product.template', { domain: [['active', '=', true]], limit: 1 }).then(r => r.data),
        erpClient.raw.post('/model/product.category', { domain: [], limit: 1 }).then(r => r.data),
      ])
      return { products: products.total || 0, categories: categories.total || 0 }
    },
  })

  const stats: StatCardData[] = [
    { label: 'Total Products', value: isLoading ? '...' : String(data?.products ?? 0), icon: <Package className="h-5 w-5" /> },
    { label: 'Categories', value: isLoading ? '...' : String(data?.categories ?? 0), icon: <Tag className="h-5 w-5" /> },
  ]

  const actions = [
    { label: 'All Products', desc: 'Browse and manage product catalog', icon: <Package className="h-5 w-5" />, path: '/admin/products/list' },
    { label: 'Categories', desc: 'Organize products into categories', icon: <Tag className="h-5 w-5" />, path: '/admin/products/categories' },
    { label: 'Pricelists', desc: 'Manage pricing rules and discounts', icon: <DollarSign className="h-5 w-5" />, path: '/admin/products/pricelists' },
    { label: 'Variants', desc: 'View all product variants', icon: <Layers className="h-5 w-5" />, path: '/admin/products/variants' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Products" subtitle="Manage your product catalog" />
      <StatCards stats={stats} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map(a => (
          <button
            key={a.label}
            onClick={() => a.path && navigate(a.path)}
            className="flex flex-col items-start gap-3 rounded-2xl border border-border/60 bg-card p-5 text-left transition-colors hover:bg-accent/50"
          >
            <div className="rounded-xl border border-border/40 bg-muted/40 p-2.5">{a.icon}</div>
            <div>
              <div className="text-sm font-semibold">{a.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{a.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
