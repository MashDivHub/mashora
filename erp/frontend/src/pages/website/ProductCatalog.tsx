import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Button, Badge, Input,
  Tabs, TabsList, TabsTrigger,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  CardTitle, CardDescription,
  Skeleton,
  cn,
} from '@mashora/design-system'
import { Plus, Search, Globe, Globe2, SlidersHorizontal } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: number
  name: string
  list_price: number
  website_published: boolean
  default_code: string | false
  public_categ_ids: [number, string][] | number[]
  rating_avg: number
  compare_list_price: number
  currency_id: [number, string] | false
  type: string
  qty_available: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

function productTypeLabel(type: string): string {
  if (type === 'consu') return 'Consumable'
  if (type === 'service') return 'Service'
  return 'Storable'
}

// ─── Tab config ───────────────────────────────────────────────────────────────

type TabFilter = 'all' | 'published' | 'unpublished'

const tabConfig: { value: TabFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'unpublished', label: 'Unpublished' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductCatalog() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabFilter>('all')
  const [search, setSearch] = useState('')

  const params: Record<string, any> = { limit: 50, search: search || undefined }
  if (tab === 'published') params.published_only = true
  else if (tab === 'unpublished') params.published_only = false

  const { data, isLoading } = useQuery({
    queryKey: ['website-products', tab, search],
    queryFn: () => erpClient.raw.post('/website/products', params).then((r) => r.data),
  })

  const records: Product[] = data?.records ?? []

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Website
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Product Catalog</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Loading...' : `${data?.total ?? 0} products`}
          </p>
        </div>
        <Button className="rounded-2xl">
          <Plus className="h-4 w-4" />
          New Product
        </Button>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabFilter)}>
        <TabsList className="rounded-xl">
          {tabConfig.map(({ value, label }) => (
            <TabsTrigger key={value} value={value} className="rounded-lg">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Table card */}
      <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
        <div className="border-b border-border/70 bg-muted/20 px-6 py-4 flex items-center justify-between">
          <div>
            <CardTitle>Products</CardTitle>
            <CardDescription className="mt-0.5">
              {isLoading ? 'Loading...' : `${records.length} result${records.length !== 1 ? 's' : ''}`}
            </CardDescription>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="rounded-2xl border border-border/70 bg-muted/60 p-4">
              <SlidersHorizontal className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No products found</p>
            <p className="text-xs text-muted-foreground">
              Try adjusting your filters or create a new product.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Product
                </TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Price
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Type
                </TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Stock
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Rating
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Published
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer border-border/40 hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/website/products/${row.id}`)}
                >
                  <TableCell>
                    <div>
                      <span className="text-sm font-medium">{row.name}</span>
                      {row.default_code && (
                        <span className="ml-2 text-xs text-muted-foreground font-mono">
                          [{row.default_code}]
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="font-mono text-sm font-medium tabular-nums">
                        {formatCurrency(row.list_price)}
                      </span>
                      {row.compare_list_price > 0 && row.compare_list_price !== row.list_price && (
                        <span className="text-xs text-muted-foreground line-through font-mono tabular-nums">
                          {formatCurrency(row.compare_list_price)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {productTypeLabel(row.type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        'font-mono text-sm tabular-nums',
                        row.qty_available <= 0 && 'text-destructive',
                      )}
                    >
                      {row.qty_available > 0 ? row.qty_available : 'Out'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {row.rating_avg > 0 ? (
                      <span className="text-sm tabular-nums">{row.rating_avg.toFixed(1)} / 5</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={row.website_published ? 'success' : 'secondary'}
                      className="flex items-center gap-1 w-fit"
                    >
                      {row.website_published ? (
                        <Globe className="h-3 w-3" />
                      ) : (
                        <Globe2 className="h-3 w-3" />
                      )}
                      {row.website_published ? 'Published' : 'Hidden'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
