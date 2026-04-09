import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, Skeleton } from '@mashora/design-system'
import { ArrowLeft, Package } from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

function productTypeLabel(type: string): string {
  if (type === 'consu') return 'Consumable'
  if (type === 'service') return 'Service'
  if (type === 'product') return 'Storable'
  return type
}

function productTypeVariant(type: string): string {
  if (type === 'service') return 'info'
  if (type === 'product') return 'success'
  return 'secondary'
}

function InfoRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm border-b border-border/40 last:border-0">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={mono ? 'font-mono font-medium text-right' : 'font-medium text-right'}>{value}</span>
    </div>
  )
}

export default function ProductEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['website-product-editor', id],
    queryFn: () => erpClient.raw.get(`/website/products/${id}`).then(r => r.data),
    enabled: Boolean(id),
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-8 w-56" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <Package className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium">Product not found.</p>
        <button
          className="rounded-2xl border border-border/60 px-4 py-2 text-sm hover:bg-muted/20 transition-colors flex items-center gap-2"
          onClick={() => navigate('/website/products')}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Products
        </button>
      </div>
    )
  }

  const variants: any[] = data.variants || []

  return (
    <div className="space-y-6">
      {/* Page header */}
      <PageHeader
        title={data.name}
        subtitle="website / products"
        backTo="/website/products"
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Product image */}
        {data.image_1920 && (
          <div className="rounded-2xl border border-border/30 bg-card/50 p-6 flex items-center justify-center">
            <img
              src={`data:image/png;base64,${data.image_1920}`}
              alt={data.name}
              className="max-h-64 w-auto object-contain rounded-xl"
            />
          </div>
        )}

        {/* Info card */}
        <div className={`rounded-2xl border border-border/30 bg-card/50 p-6${!data.image_1920 ? ' md:col-span-2' : ''}`}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Product Info</h2>
          <InfoRow label="Name" value={data.name} />
          {data.default_code && (
            <InfoRow label="Internal Reference" value={data.default_code} mono />
          )}
          <InfoRow
            label="Price"
            value={
              <span className="font-mono font-semibold">
                ${Number(data.list_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            }
          />
          <InfoRow
            label="Type"
            value={
              <Badge variant={productTypeVariant(data.type) as any} className="text-xs">
                {productTypeLabel(data.type)}
              </Badge>
            }
          />
          {data.categ_id && (
            <InfoRow
              label="Category"
              value={Array.isArray(data.categ_id) ? data.categ_id[1] : data.categ_id}
            />
          )}
          <InfoRow
            label="Published"
            value={
              <Badge variant={data.website_published ? 'success' : 'secondary'} className="text-xs">
                {data.website_published ? 'Published' : 'Unpublished'}
              </Badge>
            }
          />
        </div>
      </div>

      {/* Description card */}
      {data.description_sale && (
        <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Description</h2>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{data.description_sale}</p>
        </div>
      )}

      {/* Variants table */}
      {variants.length > 0 && (
        <div className="rounded-2xl border border-border/30 bg-card/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-border/40">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Variants ({variants.length})
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Variant Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reference</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {variants.map((v: any) => (
                <tr key={v.id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-6 py-3 font-medium">{v.name}</td>
                  <td className="px-6 py-3 font-mono text-muted-foreground">{v.default_code || '—'}</td>
                  <td className="px-6 py-3 text-right font-mono">
                    ${Number(v.list_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
