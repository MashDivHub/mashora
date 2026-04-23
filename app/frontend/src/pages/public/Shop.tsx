import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { erpClient } from '@/lib/erp-api'
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Skeleton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  cn,
} from '@mashora/design-system'
import {
  ChevronRight,
  Grid3x3,
  Heart,
  List,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'

type SortKey = 'name asc' | 'list_price asc' | 'list_price desc' | 'create_date desc'

interface WebsiteCategory {
  id: number
  name: string
  product_count?: number
}

interface WebsiteProduct {
  id: number
  name: string
  image_1920?: string | false
  list_price?: number
  description_sale?: string | false
  default_code?: string | false
  create_date?: string
  categ_id?: [number, string] | false
  compare_list_price?: number | false
  website_ribbon_id?: [number, string] | false
  rating_avg?: number
  rating_count?: number
}

interface ProductsResponse {
  records: WebsiteProduct[]
  total: number
}

const PAGE_SIZE = 24
const WISHLIST_KEY = 'mashora_wishlist'
const CART_KEY = 'mashora_cart'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'name asc', label: 'Name: A→Z' },
  { value: 'list_price asc', label: 'Price: Low → High' },
  { value: 'list_price desc', label: 'Price: High → Low' },
  { value: 'create_date desc', label: 'Newest first' },
]

function readWishlist(): number[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(WISHLIST_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is number => typeof v === 'number') : []
  } catch {
    return []
  }
}

function writeWishlist(ids: number[]) {
  try {
    window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(ids))
  } catch {
    /* noop */
  }
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
    const existing = parsed.findIndex(
      p => p.product_id === item.product_id && p.variant_id === item.variant_id,
    )
    if (existing >= 0) {
      parsed[existing] = { ...parsed[existing], quantity: parsed[existing].quantity + item.quantity }
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

function imageUrl(image: string | false | undefined): string | null {
  if (!image) return null
  if (image.startsWith('data:') || image.startsWith('http')) return image
  return `data:image/png;base64,${image}`
}

function formatPrice(n: number | undefined): string {
  if (typeof n !== 'number') return '$0.00'
  return `$${n.toFixed(2)}`
}

function ProductCardSkeleton({ variant }: { variant: 'grid' | 'list' }) {
  if (variant === 'list') {
    return (
      <div className="flex gap-4 rounded-2xl border border-border/40 bg-card/60 p-4">
        <Skeleton className="size-32 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 overflow-hidden">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-5 w-1/3" />
      </div>
    </div>
  )
}

interface ProductCardProps {
  product: WebsiteProduct
  variant: 'grid' | 'list'
  wishlisted: boolean
  onToggleWishlist: (id: number) => void
  onQuickAdd: (product: WebsiteProduct) => void
}

function ProductCard({ product, variant, wishlisted, onToggleWishlist, onQuickAdd }: ProductCardProps) {
  const img = imageUrl(product.image_1920)
  const price = typeof product.list_price === 'number' ? product.list_price : 0
  const compareAt =
    typeof product.compare_list_price === 'number' && product.compare_list_price > price
      ? product.compare_list_price
      : null
  const isOnSale = compareAt !== null
  const isNew = (() => {
    if (!product.create_date) return false
    const d = new Date(product.create_date).getTime()
    if (Number.isNaN(d)) return false
    return Date.now() - d < 30 * 24 * 60 * 60 * 1000
  })()
  const customRibbon =
    Array.isArray(product.website_ribbon_id) && product.website_ribbon_id.length >= 2
      ? product.website_ribbon_id[1]
      : null

  if (variant === 'list') {
    return (
      <div className="group relative flex gap-5 rounded-2xl border border-border/40 bg-card p-4 transition-all hover:-translate-y-1 hover:shadow-xl">
        <Link to={`/shop/${product.id}`} className="relative size-36 shrink-0 overflow-hidden rounded-xl bg-muted">
          {img ? (
            <img
              src={img}
              alt={product.name}
              className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="grid size-full place-items-center text-muted-foreground">
              <ShoppingCart className="size-8" />
            </div>
          )}
        </Link>
        <div className="flex flex-1 flex-col">
          <div className="flex items-start justify-between gap-3">
            <div>
              {product.categ_id && Array.isArray(product.categ_id) && (
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{product.categ_id[1]}</div>
              )}
              <Link to={`/shop/${product.id}`}>
                <h3 className="mt-1 text-lg font-semibold leading-tight hover:underline">{product.name}</h3>
              </Link>
            </div>
            <button
              type="button"
              aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              onClick={() => onToggleWishlist(product.id)}
              className={cn(
                'shrink-0 rounded-full border border-border/50 p-2 transition-colors',
                wishlisted ? 'bg-rose-500/10 text-rose-500' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Heart className={cn('size-4', wishlisted && 'fill-current')} />
            </button>
          </div>
          {product.description_sale && (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
              {String(product.description_sale).replace(/<[^>]*>/g, '').slice(0, 220)}
            </p>
          )}
          <div className="mt-auto flex items-center justify-between pt-3">
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold">{formatPrice(price)}</div>
              {compareAt !== null && (
                <div className="text-sm text-muted-foreground line-through">{formatPrice(compareAt)}</div>
              )}
            </div>
            <Button size="sm" onClick={() => onQuickAdd(product)}>
              <ShoppingCart className="mr-2 size-4" /> Add to cart
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/40 bg-card transition-all hover:-translate-y-1 hover:shadow-xl">
      <Link to={`/shop/${product.id}`} className="block">
        <div className="relative aspect-square overflow-hidden bg-muted">
          {img ? (
            <img
              src={img}
              alt={product.name}
              className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="grid size-full place-items-center text-muted-foreground">
              <ShoppingCart className="size-10" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
            <div className="flex flex-wrap gap-1.5">
              {customRibbon ? (
                <span className="rounded-full bg-foreground px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-background">
                  {customRibbon}
                </span>
              ) : (
                <>
                  {isOnSale && (
                    <span className="rounded-full bg-rose-500 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                      Sale
                    </span>
                  )}
                  {isNew && (
                    <span className="rounded-full bg-foreground px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-background">
                      New
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </Link>
      <button
        type="button"
        aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        onClick={e => {
          e.preventDefault()
          onToggleWishlist(product.id)
        }}
        className={cn(
          'pointer-events-auto absolute right-3 top-3 rounded-full border border-border/50 bg-background/80 p-2 backdrop-blur transition-colors',
          wishlisted ? 'text-rose-500' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Heart className={cn('size-4', wishlisted && 'fill-current')} />
      </button>
      <div className="pointer-events-none absolute inset-x-3 bottom-[92px] flex justify-center opacity-0 transition-all duration-300 group-hover:-translate-y-2 group-hover:opacity-100">
        <Button
          size="sm"
          className="pointer-events-auto shadow-lg"
          onClick={e => {
            e.preventDefault()
            onQuickAdd(product)
          }}
        >
          <ShoppingCart className="mr-2 size-4" /> Quick add
        </Button>
      </div>
      <Link to={`/shop/${product.id}`} className="block p-4">
        {product.categ_id && Array.isArray(product.categ_id) && (
          <div className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">
            {product.categ_id[1]}
          </div>
        )}
        <div className="mt-1 line-clamp-2 min-h-[2.75rem] text-sm font-medium leading-tight">{product.name}</div>
        <div className="mt-2 flex items-baseline gap-2">
          <div className="text-lg font-bold">{formatPrice(price)}</div>
          {compareAt !== null && (
            <div className="text-sm text-muted-foreground line-through">{formatPrice(compareAt)}</div>
          )}
        </div>
      </Link>
    </div>
  )
}

interface FiltersProps {
  search: string
  onSearchChange: (v: string) => void
  categories: WebsiteCategory[]
  categoryId: number | null
  onCategoryChange: (id: number | null) => void
  priceMin: string
  priceMax: string
  onPriceMinChange: (v: string) => void
  onPriceMaxChange: (v: string) => void
  sort: SortKey
  onSortChange: (s: SortKey) => void
  onClose?: () => void
}

function Filters({
  search,
  onSearchChange,
  categories,
  categoryId,
  onCategoryChange,
  priceMin,
  priceMax,
  onPriceMinChange,
  onPriceMaxChange,
  sort,
  onSortChange,
  onClose,
}: FiltersProps) {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Search</div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search products..."
            className="pl-9"
          />
        </div>
      </div>
      <Separator />
      <div>
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categories</div>
        <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
          <button
            type="button"
            onClick={() => {
              onCategoryChange(null)
              onClose?.()
            }}
            className={cn(
              'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
              categoryId === null
                ? 'bg-foreground text-background'
                : 'hover:bg-accent hover:text-foreground',
            )}
          >
            <span>All categories</span>
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                onCategoryChange(cat.id)
                onClose?.()
              }}
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors',
                categoryId === cat.id
                  ? 'bg-foreground text-background'
                  : 'hover:bg-accent hover:text-foreground',
              )}
            >
              <span className="truncate">{cat.name}</span>
              {typeof cat.product_count === 'number' && (
                <span
                  className={cn(
                    'text-xs',
                    categoryId === cat.id ? 'text-background/70' : 'text-muted-foreground',
                  )}
                >
                  {cat.product_count}
                </span>
              )}
            </button>
          ))}
          {categories.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">No categories yet.</div>
          )}
        </div>
      </div>
      <Separator />
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Price range</div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="decimal"
            placeholder="Min"
            value={priceMin}
            onChange={e => onPriceMinChange(e.target.value)}
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="Max"
            value={priceMax}
            onChange={e => onPriceMaxChange(e.target.value)}
          />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Applied to loaded products.</p>
      </div>
      <Separator />
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sort by</div>
        <Select value={sort} onValueChange={v => onSortChange(v as SortKey)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

export default function Shop() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const initialSearch = searchParams.get('search') || ''
  const initialCategory = searchParams.get('category')
  const initialSort = (searchParams.get('sort') as SortKey) || 'name asc'

  const [search, setSearch] = useState(initialSearch)
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch)
  const [categoryId, setCategoryId] = useState<number | null>(initialCategory ? Number(initialCategory) : null)
  const [sort, setSort] = useState<SortKey>(initialSort)
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(0)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [wishlist, setWishlist] = useState<number[]>(() => readWishlist())

  const topRef = useRef<HTMLDivElement | null>(null)

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  // Sync to URL
  useEffect(() => {
    const next = new URLSearchParams()
    if (debouncedSearch) next.set('search', debouncedSearch)
    if (categoryId) next.set('category', String(categoryId))
    if (sort !== 'name asc') next.set('sort', sort)
    setSearchParams(next, { replace: true })
  }, [debouncedSearch, categoryId, sort, setSearchParams])

  // Reset paging when filters change
  useEffect(() => {
    setPage(0)
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [debouncedSearch, categoryId, sort])

  const { data: categories = [] } = useQuery<WebsiteCategory[]>({
    queryKey: ['website', 'categories'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.post('/website/categories', { limit: 100 })
        return (data?.records as WebsiteCategory[]) || []
      } catch {
        return []
      }
    },
  })

  const { data: productsResp, isLoading, isFetching } = useQuery<ProductsResponse>({
    queryKey: ['website', 'products', debouncedSearch, categoryId, sort, page],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.post('/website/products', {
          search: debouncedSearch || undefined,
          category_id: categoryId || undefined,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
          order: sort,
        })
        return { records: (data?.records as WebsiteProduct[]) || [], total: data?.total ?? 0 }
      } catch {
        return { records: [], total: 0 }
      }
    },
    placeholderData: keepPreviousData,
  })

  const [accumulated, setAccumulated] = useState<WebsiteProduct[]>([])

  useEffect(() => {
    if (!productsResp) return
    if (page === 0) {
      setAccumulated(productsResp.records)
    } else {
      setAccumulated(prev => {
        const seen = new Set(prev.map(p => p.id))
        const additions = productsResp.records.filter(r => !seen.has(r.id))
        return [...prev, ...additions]
      })
    }
  }, [productsResp, page])

  const total = productsResp?.total ?? 0
  const hasMore = accumulated.length < total

  // Client-side price filter (optional, doesn't affect server pagination)
  const filtered = useMemo(() => {
    const min = priceMin ? Number(priceMin) : null
    const max = priceMax ? Number(priceMax) : null
    if (min === null && max === null) return accumulated
    return accumulated.filter(p => {
      const price = typeof p.list_price === 'number' ? p.list_price : 0
      if (min !== null && price < min) return false
      if (max !== null && price > max) return false
      return true
    })
  }, [accumulated, priceMin, priceMax])

  const toggleWishlist = (id: number) => {
    setWishlist(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      writeWishlist(next)
      return next
    })
  }

  const handleQuickAdd = (product: WebsiteProduct) => {
    addToLocalCart({
      product_id: product.id,
      quantity: 1,
      name: product.name,
      price: typeof product.list_price === 'number' ? product.list_price : 0,
      image: typeof product.image_1920 === 'string' ? product.image_1920 : undefined,
    })
    // Lazy import of toast to keep bundle slim not needed; direct import.
    void import('@/components/shared').then(mod => mod.toast('success', 'Added to cart', product.name))
  }

  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = []
    if (debouncedSearch) {
      chips.push({ key: 'search', label: `Search: "${debouncedSearch}"`, clear: () => setSearch('') })
    }
    if (categoryId) {
      const cat = categories.find(c => c.id === categoryId)
      if (cat) chips.push({ key: 'cat', label: cat.name, clear: () => setCategoryId(null) })
    }
    if (priceMin) chips.push({ key: 'min', label: `Min $${priceMin}`, clear: () => setPriceMin('') })
    if (priceMax) chips.push({ key: 'max', label: `Max $${priceMax}`, clear: () => setPriceMax('') })
    return chips
  }, [debouncedSearch, categoryId, categories, priceMin, priceMax])

  const clearAllFilters = () => {
    setSearch('')
    setCategoryId(null)
    setPriceMin('')
    setPriceMax('')
    setSort('name asc')
  }

  return (
    <div ref={topRef} className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      {/* Breadcrumb + heading */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">Shop</span>
      </nav>
      <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Shop</h1>
          <p className="mt-2 text-muted-foreground">Explore our catalog of handpicked products.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="size-4" />
          <span>Curated for you</span>
        </div>
      </div>

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {activeFilters.map(chip => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              className="group inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1 text-xs font-medium transition-colors hover:bg-accent"
            >
              {chip.label}
              <span className="text-muted-foreground group-hover:text-foreground">×</span>
            </button>
          ))}
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      <div className="mt-8 grid gap-8 md:grid-cols-[280px_1fr]">
        {/* Sidebar (desktop) */}
        <aside className="hidden md:block">
          <div className="sticky top-24 rounded-2xl border border-border/40 bg-card/60 p-6 backdrop-blur">
            <Filters
              search={search}
              onSearchChange={setSearch}
              categories={categories}
              categoryId={categoryId}
              onCategoryChange={setCategoryId}
              priceMin={priceMin}
              priceMax={priceMax}
              onPriceMinChange={setPriceMin}
              onPriceMaxChange={setPriceMax}
              sort={sort}
              onSortChange={setSort}
            />
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0">
          {/* Toolbar */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {isLoading ? (
                <Skeleton className="h-4 w-24" />
              ) : (
                <>
                  <span className="font-medium text-foreground">{filtered.length}</span>
                  {total > filtered.length && <> of {total}</>} products
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Dialog open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="md:hidden">
                    <SlidersHorizontal className="mr-2 size-4" /> Filters
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Filters</DialogTitle>
                  </DialogHeader>
                  <div className="mt-2 max-h-[70vh] overflow-y-auto pr-1">
                    <Filters
                      search={search}
                      onSearchChange={setSearch}
                      categories={categories}
                      categoryId={categoryId}
                      onCategoryChange={setCategoryId}
                      priceMin={priceMin}
                      priceMax={priceMax}
                      onPriceMinChange={setPriceMin}
                      onPriceMaxChange={setPriceMax}
                      sort={sort}
                      onSortChange={setSort}
                      onClose={() => setMobileFiltersOpen(false)}
                    />
                  </div>
                </DialogContent>
              </Dialog>

              <div className="inline-flex rounded-lg border border-border/60 bg-card p-0.5">
                <button
                  type="button"
                  aria-label="Grid view"
                  onClick={() => setView('grid')}
                  className={cn(
                    'inline-flex size-8 items-center justify-center rounded-md transition-colors',
                    view === 'grid' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Grid3x3 className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="List view"
                  onClick={() => setView('list')}
                  className={cn(
                    'inline-flex size-8 items-center justify-center rounded-md transition-colors',
                    view === 'list' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <List className="size-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Products */}
          {isLoading && accumulated.length === 0 ? (
            <div
              className={cn(
                view === 'grid'
                  ? 'grid gap-5 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                  : 'flex flex-col gap-4',
              )}
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} variant={view} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/60 bg-card/40 px-6 py-20 text-center">
              <div className="mx-auto grid size-16 place-items-center rounded-full bg-muted">
                <Search className="size-7 text-muted-foreground" />
              </div>
              <h3 className="mt-6 text-xl font-semibold">No products match your filters</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Try adjusting your search or clearing some filters.
              </p>
              <div className="mt-6 flex items-center justify-center gap-2">
                <Button onClick={clearAllFilters} variant="outline">
                  Clear filters
                </Button>
                <Button onClick={() => navigate('/shop')}>Reset</Button>
              </div>
            </div>
          ) : (
            <>
              <div
                className={cn(
                  view === 'grid'
                    ? 'grid gap-5 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                    : 'flex flex-col gap-4',
                )}
              >
                {filtered.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    variant={view}
                    wishlisted={wishlist.includes(product.id)}
                    onToggleWishlist={toggleWishlist}
                    onQuickAdd={handleQuickAdd}
                  />
                ))}
              </div>
              {hasMore && (
                <div className="mt-10 flex items-center justify-center">
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => setPage(p => p + 1)}
                    disabled={isFetching}
                  >
                    {isFetching ? 'Loading...' : 'Load more'}
                  </Button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
