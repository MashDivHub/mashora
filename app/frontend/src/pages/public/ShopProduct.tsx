import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { erpClient } from '@/lib/erp-api'
import {
  Button,
  Separator,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
} from '@mashora/design-system'
import {
  ChevronRight,
  Heart,
  Minus,
  Plus,
  Share2,
  ShoppingBag,
  ShoppingCart,
  Star,
} from 'lucide-react'
import { sanitizedHtml } from '@/lib/sanitize'
import { toast } from '@/components/shared'

interface ProductDetail {
  id: number
  name: string
  image_1920?: string | false
  list_price?: number
  compare_at_price?: number | false
  compare_list_price?: number | false
  description_sale?: string | false
  default_code?: string | false
  categ_id?: [number, string] | false
  qty_available?: number
  rating_avg?: number
  rating_count?: number
  website_ribbon_id?: [number, string] | false
}

interface MediaItem {
  id: number
  name?: string
  image_1920?: string | false
  image?: string | false
}

interface AttributeValue {
  id: number
  name: string
  html_color?: string | false
  sequence?: number
}

interface AttributeLine {
  id: number
  attribute_id: number | [number, string]
  attribute_name?: string
  value_ids?: AttributeValue[]
  values?: AttributeValue[]
}

interface Variant {
  id: number
  name?: string
  product_template_attribute_value_ids?: number[]
  price?: number
  list_price?: number
  qty_available?: number
  image_1920?: string | false
}

interface RelatedProduct {
  id: number
  name: string
  image_1920?: string | false
  list_price?: number
}

const WISHLIST_KEY = 'mashora_wishlist'
const CART_KEY = 'mashora_cart'

function imageUrl(image: string | false | undefined | null): string | null {
  if (!image) return null
  if (typeof image !== 'string') return null
  if (image.startsWith('data:') || image.startsWith('http')) return image
  return `data:image/png;base64,${image}`
}

function formatPrice(n: number | undefined | null): string {
  if (typeof n !== 'number') return '$0.00'
  return `$${n.toFixed(2)}`
}

interface CartItem {
  product_id: number
  variant_id?: number
  quantity: number
  name: string
  price: number
  image?: string
}

function addToLocalCart(item: CartItem) {
  try {
    const raw = window.localStorage.getItem(CART_KEY)
    const parsed: CartItem[] = raw ? JSON.parse(raw) : []
    const idx = parsed.findIndex(
      p => p.product_id === item.product_id && p.variant_id === item.variant_id,
    )
    if (idx >= 0) {
      parsed[idx] = { ...parsed[idx], quantity: parsed[idx].quantity + item.quantity }
    } else {
      parsed.push(item)
    }
    window.localStorage.setItem(CART_KEY, JSON.stringify(parsed))
    window.dispatchEvent(new CustomEvent('mashora-cart-update'))
    window.dispatchEvent(new CustomEvent('mashora:cart-updated'))
  } catch {
    /* noop */
  }
}

function readWishlist(): number[] {
  try {
    const raw = window.localStorage.getItem(WISHLIST_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is number => typeof x === 'number') : []
  } catch {
    return []
  }
}

function writeWishlist(ids: number[]) {
  try {
    window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(ids))
    window.dispatchEvent(new CustomEvent('mashora-wishlist-update'))
  } catch {
    /* noop */
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

function RelatedCard({ product }: { product: RelatedProduct }) {
  const img = imageUrl(product.image_1920)
  return (
    <Link
      to={`/shop/${product.id}`}
      className="group block overflow-hidden rounded-2xl border border-border/40 bg-card transition-all hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="aspect-square overflow-hidden bg-muted">
        {img ? (
          <img
            src={img}
            alt={product.name}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            <ShoppingBag className="size-10" />
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="line-clamp-2 min-h-[2.75rem] text-sm font-medium leading-tight">{product.name}</div>
        <div className="mt-2 text-lg font-bold">{formatPrice(product.list_price)}</div>
      </div>
    </Link>
  )
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <Skeleton className="mb-6 h-4 w-64" />
      <div className="grid gap-12 lg:grid-cols-2">
        <div className="space-y-4">
          <Skeleton className="aspect-square w-full rounded-3xl" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        </div>
        <div className="space-y-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  )
}

export default function ShopProduct() {
  const { slug } = useParams<{ slug: string }>()
  const id = Number(slug)
  const validId = !!id && !Number.isNaN(id)

  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [selectedAttrs, setSelectedAttrs] = useState<Record<number, number>>({})
  const [wishlist, setWishlist] = useState<number[]>(() => readWishlist())

  const { data: product, isLoading, isError } = useQuery<ProductDetail | null>({
    queryKey: ['website', 'product', id],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.get(`/website/products/${id}`)
        return (data as ProductDetail) || null
      } catch {
        return null
      }
    },
    enabled: validId,
  })

  const { data: media = [] } = useQuery<MediaItem[]>({
    queryKey: ['website', 'product', id, 'media'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.get(`/website/products/${id}/media`)
        if (Array.isArray(data)) return data as MediaItem[]
        if (Array.isArray(data?.records)) return data.records as MediaItem[]
        return []
      } catch {
        return []
      }
    },
    enabled: validId,
  })

  const { data: attributeLines = [] } = useQuery<AttributeLine[]>({
    queryKey: ['website', 'product', id, 'attribute-lines'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.get(`/website/products/${id}/attribute-lines`)
        if (Array.isArray(data)) return data as AttributeLine[]
        if (Array.isArray(data?.records)) return data.records as AttributeLine[]
        return []
      } catch {
        return []
      }
    },
    enabled: validId,
  })

  const { data: variants = [] } = useQuery<Variant[]>({
    queryKey: ['website', 'product', id, 'variants'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.get(`/website/products/${id}/variants`)
        if (Array.isArray(data)) return data as Variant[]
        if (Array.isArray(data?.records)) return data.records as Variant[]
        return []
      } catch {
        return []
      }
    },
    enabled: validId,
  })

  const { data: alternatives = [] } = useQuery<RelatedProduct[]>({
    queryKey: ['website', 'product', id, 'alternative-products'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.get(`/website/products/${id}/alternative-products`)
        if (Array.isArray(data)) return data as RelatedProduct[]
        if (Array.isArray(data?.records)) return data.records as RelatedProduct[]
        return []
      } catch {
        return []
      }
    },
    enabled: validId,
  })

  const { data: accessories = [] } = useQuery<RelatedProduct[]>({
    queryKey: ['website', 'product', id, 'accessory-products'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.get(`/website/products/${id}/accessory-products`)
        if (Array.isArray(data)) return data as RelatedProduct[]
        if (Array.isArray(data?.records)) return data.records as RelatedProduct[]
        return []
      } catch {
        return []
      }
    },
    enabled: validId,
  })

  // Build gallery (main image + media)
  const gallery = useMemo<string[]>(() => {
    const imgs: string[] = []
    const main = imageUrl(product?.image_1920)
    if (main) imgs.push(main)
    for (const m of media) {
      const u = imageUrl(m.image_1920 ?? m.image)
      if (u && !imgs.includes(u)) imgs.push(u)
    }
    return imgs
  }, [product, media])

  useEffect(() => {
    if (gallery.length > 0 && !selectedImage) {
      setSelectedImage(gallery[0])
    }
  }, [gallery, selectedImage])

  // Initialize attribute selection to first value of each attribute line
  useEffect(() => {
    if (attributeLines.length === 0) return
    setSelectedAttrs(prev => {
      if (Object.keys(prev).length > 0) return prev
      const init: Record<number, number> = {}
      for (const line of attributeLines) {
        const attrId = Array.isArray(line.attribute_id) ? line.attribute_id[0] : line.attribute_id
        const vals = line.value_ids || line.values || []
        if (vals.length > 0) {
          init[attrId] = vals[0].id
        }
      }
      return init
    })
  }, [attributeLines])

  // Try to match selected attribute combo to a variant
  const selectedVariant = useMemo<Variant | null>(() => {
    if (variants.length === 0) return null
    const selectedValueIds = Object.values(selectedAttrs)
    if (selectedValueIds.length === 0) return variants[0] ?? null
    const match = variants.find(v => {
      const vals = v.product_template_attribute_value_ids || []
      return selectedValueIds.every(id => vals.includes(id))
    })
    return match || variants[0] || null
  }, [variants, selectedAttrs])

  const displayPrice = useMemo(() => {
    if (selectedVariant && typeof selectedVariant.price === 'number') return selectedVariant.price
    if (selectedVariant && typeof selectedVariant.list_price === 'number') return selectedVariant.list_price
    return product?.list_price ?? 0
  }, [selectedVariant, product])

  const compareAtPrice = (() => {
    if (typeof product?.compare_list_price === 'number' && product.compare_list_price > 0) {
      return product.compare_list_price
    }
    if (typeof product?.compare_at_price === 'number' && product.compare_at_price > 0) {
      return product.compare_at_price
    }
    return null
  })()
  const hasDiscount = compareAtPrice !== null && compareAtPrice > displayPrice
  const discountPercent =
    hasDiscount && compareAtPrice
      ? Math.round(((compareAtPrice - displayPrice) / compareAtPrice) * 100)
      : 0

  const categoryName = product?.categ_id && Array.isArray(product.categ_id) ? product.categ_id[1] : null

  const isWishlisted = product ? wishlist.includes(product.id) : false

  const handleWishlistToggle = () => {
    if (!product) return
    setWishlist(prev => {
      const next = prev.includes(product.id) ? prev.filter(x => x !== product.id) : [...prev, product.id]
      writeWishlist(next)
      return next
    })
  }

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast('success', 'Link copied', 'Product URL has been copied to your clipboard.')
    } catch {
      toast('info', 'Copy this link', window.location.href)
    }
  }

  const handleAddToCart = () => {
    if (!product) return
    addToLocalCart({
      product_id: product.id,
      variant_id: selectedVariant?.id,
      quantity,
      name: product.name,
      price: displayPrice,
      image: typeof product.image_1920 === 'string' ? product.image_1920 : undefined,
    })
    toast('success', 'Added to cart', `${quantity} × ${product.name}`)
  }

  if (!validId) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold">Invalid product</h1>
        <p className="mt-2 text-muted-foreground">The requested product could not be found.</p>
        <Button asChild className="mt-6">
          <Link to="/shop">Back to shop</Link>
        </Button>
      </div>
    )
  }

  if (isLoading) return <DetailSkeleton />

  if (isError || !product) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-24 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-muted">
          <ShoppingBag className="size-7 text-muted-foreground" />
        </div>
        <h1 className="mt-6 text-2xl font-semibold">Product not found</h1>
        <p className="mt-2 text-muted-foreground">We couldn't find this product. It may have been removed.</p>
        <Button asChild className="mt-6">
          <Link to="/shop">Back to shop</Link>
        </Button>
      </div>
    )
  }

  const relatedSource = alternatives.length > 0 ? alternatives : accessories
  const relatedHeading = alternatives.length > 0 ? 'You might also like' : 'Pair with'
  const descriptionHtml = typeof product.description_sale === 'string' ? product.description_sale : ''
  const descriptionText = stripHtml(descriptionHtml)

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-8 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <ChevronRight className="size-3.5" />
        <Link to="/shop" className="hover:text-foreground">
          Shop
        </Link>
        {categoryName && (
          <>
            <ChevronRight className="size-3.5" />
            <span className="hover:text-foreground">{categoryName}</span>
          </>
        )}
        <ChevronRight className="size-3.5" />
        <span className="truncate text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-12 lg:grid-cols-2">
        {/* Gallery */}
        <div className="space-y-4">
          <div className="group aspect-square overflow-hidden rounded-3xl bg-muted">
            {selectedImage ? (
              <img
                src={selectedImage}
                alt={product.name}
                className="size-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            ) : (
              <div className="grid size-full place-items-center text-muted-foreground">
                <ShoppingBag className="size-16" />
              </div>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="grid grid-cols-4 gap-3">
              {gallery.slice(0, 8).map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedImage(src)}
                  className={cn(
                    'aspect-square overflow-hidden rounded-xl border-2 bg-muted transition-all',
                    selectedImage === src
                      ? 'border-foreground ring-2 ring-foreground/20'
                      : 'border-transparent hover:border-border',
                  )}
                >
                  <img src={src} alt={`${product.name} ${i + 1}`} className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-6">
          {categoryName && (
            <div className="inline-flex items-center rounded-full border border-border/60 bg-card px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {categoryName}
            </div>
          )}

          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{product.name}</h1>

          {/* Real rating (hidden if no reviews) */}
          {typeof product.rating_avg === 'number' &&
            typeof product.rating_count === 'number' &&
            product.rating_count > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        'size-4',
                        i < Math.round(product.rating_avg ?? 0)
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-muted text-muted-foreground/40',
                      )}
                    />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  {(product.rating_avg ?? 0).toFixed(1)} ({product.rating_count}{' '}
                  {product.rating_count === 1 ? 'review' : 'reviews'})
                </span>
              </div>
            )}

          {/* Price */}
          <div className="flex items-baseline gap-3 flex-wrap">
            <div className="text-4xl font-bold tracking-tight">{formatPrice(displayPrice)}</div>
            {hasDiscount && compareAtPrice !== null && (
              <>
                <div className="text-xl text-muted-foreground line-through">{formatPrice(compareAtPrice)}</div>
                <span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-600">
                  Save {formatPrice(compareAtPrice - displayPrice)}
                  {discountPercent > 0 && <> · {discountPercent}% off</>}
                </span>
              </>
            )}
          </div>

          {/* Short description */}
          {descriptionText && (
            <p className="text-base leading-relaxed text-muted-foreground">
              {descriptionText.slice(0, 280)}
              {descriptionText.length > 280 ? '…' : ''}
            </p>
          )}

          <Separator />

          {/* Attribute / variant pickers */}
          {attributeLines.length > 0 && (
            <div className="space-y-5">
              {attributeLines.map(line => {
                const attrId = Array.isArray(line.attribute_id) ? line.attribute_id[0] : line.attribute_id
                const attrName =
                  line.attribute_name ||
                  (Array.isArray(line.attribute_id) ? line.attribute_id[1] : 'Option')
                const values = line.value_ids || line.values || []
                const selectedValueId = selectedAttrs[attrId]
                const isColor = /colou?r/i.test(attrName)
                return (
                  <div key={line.id}>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-sm font-medium">{attrName}</div>
                      {selectedValueId && (
                        <div className="text-sm text-muted-foreground">
                          {values.find(v => v.id === selectedValueId)?.name}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {values.map(v => {
                        const selected = selectedValueId === v.id
                        if (isColor && v.html_color) {
                          return (
                            <button
                              key={v.id}
                              type="button"
                              title={v.name}
                              aria-label={v.name}
                              onClick={() => setSelectedAttrs(prev => ({ ...prev, [attrId]: v.id }))}
                              className={cn(
                                'relative size-9 rounded-full border-2 transition-all',
                                selected
                                  ? 'border-foreground ring-2 ring-foreground/20'
                                  : 'border-border hover:border-foreground/50',
                              )}
                              style={{ backgroundColor: v.html_color }}
                            />
                          )
                        }
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setSelectedAttrs(prev => ({ ...prev, [attrId]: v.id }))}
                            className={cn(
                              'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                              selected
                                ? 'border-foreground bg-foreground text-background'
                                : 'border-border hover:border-foreground/50',
                            )}
                          >
                            {v.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Stock + quantity + add to cart */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="text-sm font-medium">Quantity</div>
              <div className="inline-flex items-center rounded-full border border-border/60 bg-card">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="grid size-10 place-items-center rounded-l-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Minus className="size-4" />
                </button>
                <input
                  type="number"
                  value={quantity}
                  min={1}
                  onChange={e => {
                    const v = Number(e.target.value)
                    if (!Number.isNaN(v) && v > 0) setQuantity(Math.floor(v))
                  }}
                  className="h-10 w-12 border-none bg-transparent text-center text-sm font-medium outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => setQuantity(q => q + 1)}
                  className="grid size-10 place-items-center rounded-r-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Plus className="size-4" />
                </button>
              </div>
              {selectedVariant && typeof selectedVariant.qty_available === 'number' && (
                <div
                  className={cn(
                    'text-sm font-medium',
                    selectedVariant.qty_available > 0 ? 'text-emerald-600' : 'text-rose-600',
                  )}
                >
                  {selectedVariant.qty_available > 0 ? 'In stock' : 'Out of stock'}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button size="lg" className="h-12 flex-1 text-base" onClick={handleAddToCart}>
                <ShoppingCart className="mr-2 size-5" /> Add to cart
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12"
                aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                onClick={handleWishlistToggle}
              >
                <Heart className={cn('size-5', isWishlisted && 'fill-rose-500 text-rose-500')} />
              </Button>
              <Button size="lg" variant="outline" className="h-12" aria-label="Share" onClick={handleShare}>
                <Share2 className="size-5" />
              </Button>
            </div>
          </div>

        </div>
      </div>

      {/* Description / Specifications */}
      <div className="mt-16">
        {attributeLines.length > 0 ? (
          <Tabs defaultValue="description" className="w-full">
            <TabsList>
              <TabsTrigger value="description">Description</TabsTrigger>
              <TabsTrigger value="specs">Specifications</TabsTrigger>
            </TabsList>
            <TabsContent value="description" className="mt-6">
              {descriptionHtml ? (
                <div
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={sanitizedHtml(descriptionHtml)}
                />
              ) : (
                <p className="text-muted-foreground">No description available.</p>
              )}
            </TabsContent>
            <TabsContent value="specs" className="mt-6">
              <div className="overflow-hidden rounded-2xl border border-border/40">
                <table className="w-full text-sm">
                  <tbody>
                    {attributeLines.map((line, idx) => {
                      const attrName =
                        line.attribute_name ||
                        (Array.isArray(line.attribute_id) ? line.attribute_id[1] : 'Option')
                      const values = line.value_ids || line.values || []
                      return (
                        <tr
                          key={line.id}
                          className={cn(idx % 2 === 0 ? 'bg-card' : 'bg-card/40', 'border-b border-border/40 last:border-0')}
                        >
                          <td className="w-1/3 px-4 py-3 font-medium">{attrName}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {values.map(v => v.name).join(', ') || '—'}
                          </td>
                        </tr>
                      )
                    })}
                    {product.default_code && (
                      <tr className="bg-card">
                        <td className="px-4 py-3 font-medium">SKU</td>
                        <td className="px-4 py-3 text-muted-foreground">{product.default_code}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div>
            <h2 className="text-2xl font-bold tracking-tight mb-4">Description</h2>
            {descriptionHtml ? (
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={sanitizedHtml(descriptionHtml)}
              />
            ) : (
              <p className="text-muted-foreground">No description available.</p>
            )}
          </div>
        )}
      </div>

      {/* Related products */}
      {relatedSource.length > 0 && (
        <div className="mt-20">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-2xl font-bold tracking-tight">{relatedHeading}</h2>
            <Link to="/shop" className="text-sm text-muted-foreground hover:text-foreground">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
            {relatedSource.slice(0, 4).map(r => (
              <RelatedCard key={r.id} product={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
