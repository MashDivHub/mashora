import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import {
  Package, Tag, Layers, DollarSign, BoxesIcon,
  AlertTriangle, AlertCircle, Clock, Sparkles,
  Sliders, Ruler, BookmarkIcon, TrendingUp,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from 'recharts'
import { PageHeader, StatCards, type StatCardData } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

const CHART_COLORS = [
  'hsl(220, 70%, 55%)',
  'hsl(160, 60%, 50%)',
  'hsl(30, 80%, 55%)',
  'hsl(280, 65%, 60%)',
  'hsl(340, 75%, 55%)',
]

const LOW_STOCK_THRESHOLD = 5

interface TopSeller {
  product_id: number
  name: string
  qty: number
  revenue: number
}

interface RecentProduct {
  id: number
  name: string
  default_code: string | false
  list_price: number
  create_date: string
}

interface CategoryBucket {
  id: number
  name: string
  count: number
}

interface DashboardData {
  total_products: number
  categories: number
  variants: number
  out_of_stock: number
  low_stock: number
  recent_updates: number
  top_sellers: TopSeller[]
  recent_products: RecentProduct[]
  categories_breakdown: CategoryBucket[]
}

function isoDaysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0] + ' 00:00:00'
}

function fmtCur(v: number) {
  return v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M`
    : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K`
    : `$${(v || 0).toFixed(0)}`
}

function fmtNum(v: number) {
  return v >= 1e6 ? `${(v / 1e6).toFixed(1)}M`
    : v >= 1e3 ? `${(v / 1e3).toFixed(1)}K`
    : String(v || 0)
}

type DomainTerm = string | [string, string, unknown]

interface ReadGroupRow {
  product_id?: [number, string] | number | false
  categ_id?: [number, string] | number | false
  quantity?: number
  product_uom_qty?: number
  price_subtotal?: number
  categ_id_count?: number
  __count?: number
  [key: string]: unknown
}

async function loadCount(model: string, domain: DomainTerm[]): Promise<number> {
  try {
    const { data } = await erpClient.raw.post(`/model/${model}`, {
      domain, fields: ['id'], limit: 1,
    })
    return data?.total || 0
  } catch {
    return 0
  }
}

async function loadOutOfStock(): Promise<{ out: number; low: number }> {
  // Group stock.quant by product_id, sum quantity, then filter
  try {
    const { data } = await erpClient.raw.post('/model/stock.quant/read_group', {
      domain: [['location_id.usage', '=', 'internal']],
      fields: ['quantity', 'product_id'],
      groupby: ['product_id'],
      limit: 5000,
    })
    let out = 0
    let low = 0
    for (const g of (data?.groups || [])) {
      const q = Number(g.quantity || 0)
      if (q <= 0) out++
      else if (q < LOW_STOCK_THRESHOLD) low++
    }
    return { out, low }
  } catch {
    return { out: 0, low: 0 }
  }
}

async function loadTopSellers(): Promise<TopSeller[]> {
  const since = isoDaysAgo(30)
  try {
    const { data } = await erpClient.raw.post('/model/sale.order.line/read_group', {
      domain: [
        ['create_date', '>=', since],
        ['state', 'in', ['sale', 'done']],
      ],
      fields: ['product_uom_qty', 'price_subtotal', 'product_id'],
      groupby: ['product_id'],
      limit: 100,
    })
    const items: TopSeller[] = (data?.groups || []).map((g: ReadGroupRow) => {
      const pid = Array.isArray(g.product_id) ? g.product_id[0] : g.product_id
      const name = Array.isArray(g.product_id) ? g.product_id[1] : 'Unknown'
      return {
        product_id: pid,
        name,
        qty: Number(g.product_uom_qty || 0),
        revenue: Number(g.price_subtotal || 0),
      }
    })
    return items.sort((a, b) => b.qty - a.qty).slice(0, 10)
  } catch {
    return []
  }
}

async function loadRecentProducts(): Promise<RecentProduct[]> {
  try {
    const { data } = await erpClient.raw.post('/model/product.template', {
      domain: [['active', '=', true]],
      fields: ['id', 'name', 'default_code', 'list_price', 'create_date'],
      order: 'create_date desc',
      limit: 5,
    })
    return data?.records || []
  } catch {
    return []
  }
}

async function loadCategoryBreakdown(): Promise<CategoryBucket[]> {
  try {
    const { data } = await erpClient.raw.post('/model/product.template/read_group', {
      domain: [['active', '=', true]],
      fields: ['categ_id'],
      groupby: ['categ_id'],
      limit: 100,
    })
    const items: CategoryBucket[] = (data?.groups || []).map((g: ReadGroupRow) => {
      const id = Array.isArray(g.categ_id) ? g.categ_id[0] : g.categ_id
      const name = Array.isArray(g.categ_id) ? g.categ_id[1] : 'Uncategorized'
      const count = Number(g.categ_id_count || g.__count || 0)
      return { id, name, count }
    })
    return items.sort((a, b) => b.count - a.count).slice(0, 5)
  } catch {
    return []
  }
}

export default function ProductsDashboard() {
  useDocumentTitle('Products')
  const navigate = useNavigate()

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['products-dashboard-v2'],
    queryFn: async () => {
      const recentSince = isoDaysAgo(7)
      const [
        totalProducts,
        categories,
        variants,
        recentUpdates,
        stock,
        topSellers,
        recentProducts,
        categoriesBreakdown,
      ] = await Promise.all([
        loadCount('product.template', [['active', '=', true]]),
        loadCount('product.category', []),
        loadCount('product.product', [['active', '=', true]]),
        loadCount('product.template', [
          ['active', '=', true],
          ['write_date', '>=', recentSince],
        ]),
        loadOutOfStock(),
        loadTopSellers(),
        loadRecentProducts(),
        loadCategoryBreakdown(),
      ])

      return {
        total_products: totalProducts,
        categories,
        variants,
        out_of_stock: stock.out,
        low_stock: stock.low,
        recent_updates: recentUpdates,
        top_sellers: topSellers,
        recent_products: recentProducts,
        categories_breakdown: categoriesBreakdown,
      }
    },
    staleTime: 60_000,
  })

  const stats: StatCardData[] = [
    {
      label: 'Total Products', value: isLoading ? '...' : fmtNum(data?.total_products ?? 0),
      icon: <Package className="h-5 w-5" />, color: 'info',
      onClick: () => navigate('/admin/products/list'),
    },
    {
      label: 'Categories', value: isLoading ? '...' : fmtNum(data?.categories ?? 0),
      icon: <Tag className="h-5 w-5" />,
      onClick: () => navigate('/admin/products/categories'),
    },
    {
      label: 'Variants', value: isLoading ? '...' : fmtNum(data?.variants ?? 0),
      icon: <Layers className="h-5 w-5" />,
      onClick: () => navigate('/admin/products/variants'),
    },
    {
      label: 'Out of Stock', value: isLoading ? '...' : fmtNum(data?.out_of_stock ?? 0),
      sub: 'qty <= 0',
      icon: <AlertCircle className="h-5 w-5" />,
      color: (data?.out_of_stock ?? 0) > 0 ? 'danger' : 'default',
    },
    {
      label: 'Low Stock', value: isLoading ? '...' : fmtNum(data?.low_stock ?? 0),
      sub: `< ${LOW_STOCK_THRESHOLD} units`,
      icon: <AlertTriangle className="h-5 w-5" />,
      color: (data?.low_stock ?? 0) > 0 ? 'warning' : 'default',
    },
    {
      label: 'Updated 7d', value: isLoading ? '...' : fmtNum(data?.recent_updates ?? 0),
      sub: 'last week',
      icon: <Clock className="h-5 w-5" />, color: 'success',
    },
  ]

  const actions = [
    { label: 'All Products', desc: 'Browse and manage product catalog', icon: <Package className="h-5 w-5" />, path: '/admin/products/list' },
    { label: 'Categories', desc: 'Organize products into categories', icon: <Tag className="h-5 w-5" />, path: '/admin/products/categories' },
    { label: 'Bundles / Kits', desc: 'Combine products into packages', icon: <BoxesIcon className="h-5 w-5" />, path: '/admin/products/bundles' },
    { label: 'Pricelists', desc: 'Manage pricing rules and discounts', icon: <DollarSign className="h-5 w-5" />, path: '/admin/products/pricelists' },
    { label: 'Variants', desc: 'View all product variants', icon: <Layers className="h-5 w-5" />, path: '/admin/products/variants' },
    { label: 'Attributes', desc: 'Configure product attributes', icon: <Sliders className="h-5 w-5" />, path: '/admin/model/product.attribute' },
    { label: 'Units of Measure', desc: 'Manage unit conversions', icon: <Ruler className="h-5 w-5" />, path: '/admin/model/uom.uom' },
    { label: 'Tags', desc: 'Tag products for filtering', icon: <BookmarkIcon className="h-5 w-5" />, path: '/admin/model/product.tag' },
  ]

  const topSellers = data?.top_sellers ?? []
  const recentProducts = data?.recent_products ?? []
  const categoriesBreakdown = data?.categories_breakdown ?? []
  const maxQty = topSellers.length ? Math.max(...topSellers.map(t => t.qty)) : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        subtitle="catalog overview"
        onNew="/admin/products/new"
        newLabel="New Product"
      />

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <StatCards stats={stats} columns={5} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Sellers */}
        <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Top Sellers</h3>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              last 30d
            </span>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-lg" />
              ))}
            </div>
          ) : topSellers.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              No sales activity in the last 30 days.
            </div>
          ) : (
            <ol className="space-y-1.5">
              {topSellers.map((p, idx) => {
                const pct = maxQty > 0 ? (p.qty / maxQty) * 100 : 0
                return (
                  <li key={p.product_id}>
                    <button
                      onClick={() => navigate(`/admin/model/product.product/${p.product_id}`)}
                      className="w-full text-left rounded-lg p-2 hover:bg-muted/40 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-5 text-xs font-mono text-muted-foreground tabular-nums shrink-0">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                              {p.name}
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                              {fmtNum(p.qty)} u
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="flex-1 h-1 rounded-full bg-muted/40 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary/60"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                              {fmtCur(p.revenue)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ol>
          )}
        </div>

        {/* Recent Products */}
        <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Recently Added</h3>
            </div>
            <button
              onClick={() => navigate('/admin/products/list')}
              className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-colors"
            >
              view all
            </button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : recentProducts.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              No products yet.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {recentProducts.map(p => (
                <li key={p.id}>
                  <button
                    onClick={() => navigate(`/admin/products/${p.id}`)}
                    className="w-full text-left rounded-lg p-2 hover:bg-muted/40 transition-colors group flex items-center gap-3"
                  >
                    <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
                      <Package className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                        {p.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                        {p.default_code && <span className="font-mono">{p.default_code}</span>}
                        {p.default_code && <span>·</span>}
                        <span className="tabular-nums">{fmtCur(p.list_price || 0)}</span>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">
          Quick Actions
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map(a => (
            <button
              key={a.path}
              onClick={() => navigate(a.path)}
              className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card p-4 text-left transition-all hover:bg-muted/20 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary shrink-0">{a.icon}</div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{a.label}</div>
                <div className="text-xs text-muted-foreground truncate">{a.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Category breakdown */}
      <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Top Categories</h3>
          </div>
          <button
            onClick={() => navigate('/admin/products/categories')}
            className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-colors"
          >
            manage
          </button>
        </div>

        {isLoading ? (
          <Skeleton className="h-48 rounded-xl" />
        ) : categoriesBreakdown.length === 0 ? (
          <div className="py-10 text-center text-xs text-muted-foreground">
            No categorized products yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoriesBreakdown}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={75}
                    paddingAngle={2}
                  >
                    {categoriesBreakdown.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2">
              {categoriesBreakdown.map((c, i) => (
                <li key={c.id} className="flex items-center gap-3 text-sm">
                  <span
                    className="h-3 w-3 rounded-sm shrink-0"
                    style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {fmtNum(c.count)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
