import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Badge, Skeleton,
  CardTitle, CardDescription,
  cn,
} from '@mashora/design-system'
import {
  ArrowLeft, Globe, Globe2, Tag, Package, Star, ChevronRight,
} from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

function productTypeLabel(type: string): string {
  if (type === 'consu') return 'Consumable'
  if (type === 'service') return 'Service'
  return 'Storable'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
  mono = false,
  className,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 py-3 text-sm border-b border-border/40 last:border-0',
        className,
      )}
    >
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={cn('text-right font-medium', mono && 'font-mono tabular-nums')}>{value}</span>
    </div>
  )
}

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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: product, isLoading } = useQuery({
    queryKey: ['website-product', id],
    queryFn: () => erpClient.raw.get(`/website/products/${id}`).then((r) => r.data),
    enabled: !!id,
  })

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-10 w-28 rounded-2xl" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-56 w-full rounded-3xl" />
          <Skeleton className="h-56 w-full rounded-3xl" />
        </div>
        <Skeleton className="h-48 w-full rounded-3xl" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <p className="text-sm font-medium">Product not found.</p>
        <Button
          variant="outline"
          className="rounded-2xl"
          onClick={() => navigate('/website/products')}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Catalog
        </Button>
      </div>
    )
  }

  const variants = product.variants || []

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Product
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
          {product.default_code && (
            <p className="text-sm text-muted-foreground font-mono">SKU: {product.default_code}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={product.website_published ? 'success' : 'secondary'}
            className="flex items-center gap-1"
          >
            {product.website_published ? (
              <Globe className="h-3 w-3" />
            ) : (
              <Globe2 className="h-3 w-3" />
            )}
            {product.website_published ? 'Published' : 'Hidden'}
          </Badge>
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={() => navigate('/website/products')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      </div>

      {/* Two-column: Pricing + Details */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Pricing */}
        <SectionCard title="Pricing" description="Storefront price and availability">
          <InfoRow
            label="Price"
            value={
              <span className="text-lg font-semibold font-mono tabular-nums">
                {formatCurrency(product.list_price)}
              </span>
            }
          />
          {product.compare_list_price > 0 && product.compare_list_price !== product.list_price && (
            <InfoRow
              label="Compare At"
              value={
                <span className="font-mono tabular-nums line-through text-muted-foreground">
                  {formatCurrency(product.compare_list_price)}
                </span>
              }
            />
          )}
          <InfoRow
            label="Type"
            value={<Badge variant="outline">{productTypeLabel(product.type)}</Badge>}
          />
          {product.default_code && (
            <InfoRow label="SKU" value={product.default_code} mono />
          )}
          <InfoRow
            label="Available"
            value={
              <span
                className={cn(
                  'font-mono tabular-nums',
                  product.qty_available <= 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400',
                )}
              >
                {product.qty_available}
              </span>
            }
          />
        </SectionCard>

        {/* Details */}
        <SectionCard title="Details" description="Classification and performance">
          {product.rating_avg > 0 && (
            <InfoRow
              label="Rating"
              value={
                <span className="flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                  <span className="font-mono tabular-nums">{product.rating_avg.toFixed(1)}</span>
                  <span className="text-muted-foreground text-xs">({product.rating_count} reviews)</span>
                </span>
              }
            />
          )}
          {product.categ_id && (
            <InfoRow
              label="Internal Category"
              value={Array.isArray(product.categ_id) ? product.categ_id[1] : product.categ_id}
            />
          )}
          {product.public_categ_ids?.length > 0 && (
            <div className="flex items-start justify-between gap-4 py-3 text-sm border-b border-border/40 last:border-0">
              <span className="text-muted-foreground shrink-0">Shop Categories</span>
              <div className="flex flex-wrap gap-1 justify-end">
                {product.public_categ_ids.map((cat: any) => (
                  <Badge
                    key={typeof cat === 'number' ? cat : cat[0]}
                    variant="secondary"
                    className="text-xs"
                  >
                    <Tag className="mr-1 h-2.5 w-2.5" />
                    {typeof cat === 'number' ? `Cat ${cat}` : cat[1]}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Description */}
      {(product.description_sale || product.website_description) && (
        <SectionCard title="Description" description="Storefront product copy">
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{
              __html: product.website_description || product.description_sale || '',
            }}
          />
        </SectionCard>
      )}

      {/* Variants */}
      {variants.length > 1 && (
        <SectionCard
          title={`Variants (${variants.length})`}
          description="All purchasable configurations of this product"
          noPadding
        >
          <div className="divide-y divide-border/50">
            {variants.map((v: any) => (
              <div
                key={v.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{v.name}</p>
                  {v.default_code && (
                    <p className="text-xs text-muted-foreground font-mono">[{v.default_code}]</p>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-mono font-medium tabular-nums">
                    {formatCurrency(v.list_price)}
                  </span>
                  <span
                    className={cn(
                      'font-mono text-xs tabular-nums',
                      v.qty_available > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-destructive',
                    )}
                  >
                    {v.qty_available > 0 ? `${v.qty_available} in stock` : 'Out of stock'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Alternative Products */}
      {product.alternative_product_ids?.length > 0 && (
        <SectionCard
          title="Alternative Products"
          description="Related items suggested on the storefront"
        >
          <div className="flex flex-wrap gap-2">
            {product.alternative_product_ids.map((p: any) => (
              <Button
                key={typeof p === 'number' ? p : p[0]}
                variant="outline"
                size="sm"
                className="rounded-xl font-mono"
                onClick={() =>
                  navigate(`/website/products/${typeof p === 'number' ? p : p[0]}`)
                }
              >
                <Package className="mr-1.5 h-3.5 w-3.5" />
                {typeof p === 'number' ? `Product ${p}` : p[1]}
                <ChevronRight className="ml-1 h-3 w-3 text-muted-foreground" />
              </Button>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}
