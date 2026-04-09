import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import { Search, Plus, Minus, X, ShoppingCart, User } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

// ── types ─────────────────────────────────────────────────────────────────────

interface PosCategory {
  id: number
  name: string
  parent_id: [number, string] | null
  sequence: number
}

interface Product {
  id: number
  name: string
  price: number
  categ_id?: [number, string] | null
}

interface CartLine {
  productId: number
  name: string
  price: number
  qty: number
}

interface ProductsResponse {
  products: Product[]
  total?: number
}

// ── helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return '$' + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── main component ────────────────────────────────────────────────────────────

export default function PosTerminal() {
  useParams<{ configId: string }>()

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])

  // Fetch categories
  const { data: categoriesData, isLoading: catsLoading } = useQuery<{ records: PosCategory[] }>({
    queryKey: ['pos-categories'],
    queryFn: () =>
      erpClient.raw
        .post('/model/pos.category', {
          fields: ['id', 'name', 'parent_id', 'sequence'],
          order: 'sequence asc',
          limit: 100,
        })
        .then(r => r.data),
    staleTime: 300_000,
  })

  // Fetch products
  const { data: productsData, isLoading: prodsLoading } = useQuery<ProductsResponse>({
    queryKey: ['pos-products', search],
    queryFn: () =>
      erpClient.raw
        .post('/website/products', {
          search,
          limit: 50,
          published_only: false,
        })
        .then(r => r.data),
    staleTime: 60_000,
  })

  const categories = categoriesData?.records ?? []
  const allProducts: Product[] = productsData?.products ?? []

  const filteredProducts = useMemo(() => {
    if (selectedCategory === null) return allProducts
    return allProducts.filter(p => {
      if (!p.categ_id) return false
      return p.categ_id[0] === selectedCategory
    })
  }, [allProducts, selectedCategory])

  // ── cart helpers ──────────────────────────────────────────────────────────

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.find(l => l.productId === product.id)
      if (existing) {
        return prev.map(l =>
          l.productId === product.id ? { ...l, qty: l.qty + 1 } : l
        )
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price ?? 0, qty: 1 }]
    })
  }

  function setQty(productId: number, delta: number) {
    setCart(prev =>
      prev
        .map(l => l.productId === productId ? { ...l, qty: l.qty + delta } : l)
        .filter(l => l.qty > 0)
    )
  }

  function removeLine(productId: number) {
    setCart(prev => prev.filter(l => l.productId !== productId))
  }

  function clearCart() {
    setCart([])
  }

  // ── totals ────────────────────────────────────────────────────────────────

  const subtotal = cart.reduce((sum, l) => sum + l.price * l.qty, 0)
  const tax = subtotal * 0.15
  const total = subtotal + tax
  const orderTotal = cart.length > 0 ? formatCurrency(total) : formatCurrency(0)

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">

      {/* ── LEFT PANEL: Product Grid ────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 bg-background overflow-hidden">

        {/* Category tabs + search */}
        <div className="shrink-0 border-b border-border/30 px-4 pt-3 pb-0 space-y-2">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full rounded-xl border border-border/40 bg-muted/30 py-2 pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
            />
          </div>

          {/* Category tabs */}
          {!catsLoading && (
            <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-none">
              <button
                onClick={() => setSelectedCategory(null)}
                className={[
                  'shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                  selectedCategory === null
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/30 text-muted-foreground hover:bg-muted/60',
                ].join(' ')}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={[
                    'shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                    selectedCategory === cat.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/30 text-muted-foreground hover:bg-muted/60',
                  ].join(' ')}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {prodsLoading ? (
            <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              No products found
            </div>
          ) : (
            <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="rounded-xl border border-border/30 bg-card/50 p-3 hover:bg-muted/20 cursor-pointer transition-all text-left space-y-2 active:scale-95"
                >
                  {/* Image placeholder */}
                  <div className="w-full aspect-square rounded-lg bg-muted/40 flex items-center justify-center">
                    <ShoppingCart className="h-6 w-6 text-muted-foreground/40" />
                  </div>
                  <div>
                    <p className="text-xs font-medium leading-tight line-clamp-2">{product.name}</p>
                    <p className="text-xs font-semibold text-primary mt-0.5">
                      {formatCurrency(product.price ?? 0)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL: Cart ───────────────────────────────────────────────── */}
      <div className="flex flex-col w-[40%] min-w-[320px] bg-card border-l border-border/30 overflow-hidden">

        {/* Cart header */}
        <div className="shrink-0 px-4 py-3 border-b border-border/30 flex items-center justify-between">
          <span className="text-sm font-semibold">Current Order</span>
          <span className="text-sm font-bold text-primary">{orderTotal}</span>
        </div>

        {/* Line items */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <ShoppingCart className="h-8 w-8 opacity-30" />
              <p className="text-sm">Cart is empty</p>
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {cart.map(line => (
                <div key={line.productId} className="flex items-center gap-2 px-4 py-2.5">
                  {/* Name + price */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{line.name}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(line.price)}</p>
                  </div>

                  {/* Qty controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setQty(line.productId, -1)}
                      className="h-6 w-6 rounded-md border border-border/40 bg-muted/30 flex items-center justify-center hover:bg-muted/60 transition-colors"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-semibold">{line.qty}</span>
                    <button
                      onClick={() => setQty(line.productId, 1)}
                      className="h-6 w-6 rounded-md border border-border/40 bg-muted/30 flex items-center justify-center hover:bg-muted/60 transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Line total */}
                  <span className="text-xs font-semibold w-16 text-right shrink-0">
                    {formatCurrency(line.price * line.qty)}
                  </span>

                  {/* Remove */}
                  <button
                    onClick={() => removeLine(line.productId)}
                    className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="shrink-0 border-t border-border/30 px-4 py-3 space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Tax (15%)</span>
            <span>{formatCurrency(tax)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold pt-1 border-t border-border/20">
            <span>Total</span>
            <span className="text-lg">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="shrink-0 px-4 pb-4 pt-2 space-y-2">
          <button
            onClick={() => alert(`Payment of ${formatCurrency(total)} — payment dialog coming soon`)}
            disabled={cart.length === 0}
            className="w-full h-14 text-lg rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Pay {cart.length > 0 ? formatCurrency(total) : ''}
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => alert('Customer selection — coming soon')}
              className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl border border-border/40 bg-transparent text-sm font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
            >
              <User className="h-4 w-4" />
              Customer
            </button>
            <button
              onClick={clearCart}
              disabled={cart.length === 0}
              className="flex-1 h-9 rounded-xl border border-border/40 bg-transparent text-sm font-medium text-muted-foreground hover:bg-muted/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
