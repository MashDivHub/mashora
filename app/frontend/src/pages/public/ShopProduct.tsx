import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { erpClient } from '@/lib/erp-api'
import { Button } from '@mashora/design-system'
import { ArrowLeft } from 'lucide-react'
import { sanitizedHtml } from '@/lib/sanitize'

export default function ShopProduct() {
  const { slug } = useParams<{ slug: string }>()
  const id = Number(slug)

  const { data: product, isLoading } = useQuery({
    queryKey: ['website', 'product', id],
    queryFn: async () => {
      const { data } = await erpClient.raw.get(`/website/products/${id}`)
      return data
    },
    enabled: !!id && !isNaN(id),
  })

  if (isLoading) return <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 text-muted-foreground">Loading...</div>
  if (!product) return <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">Product not found.</div>

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      <Link to="/shop" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"><ArrowLeft className="size-4" /> Back to shop</Link>
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        <div className="aspect-square rounded-2xl bg-muted overflow-hidden">
          {product.image_1920 && <img src={`data:image/png;base64,${product.image_1920}`} className="h-full w-full object-cover" alt={product.name} />}
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{product.name}</h1>
          <div className="text-2xl font-semibold mt-3">${typeof product.list_price === 'number' ? product.list_price.toFixed(2) : '0.00'}</div>
          {product.description_sale && (
            <div className="prose dark:prose-invert max-w-none mt-6" dangerouslySetInnerHTML={sanitizedHtml(product.description_sale)} />
          )}
          <Button className="mt-8" size="lg">Add to cart</Button>
        </div>
      </div>
    </div>
  )
}
