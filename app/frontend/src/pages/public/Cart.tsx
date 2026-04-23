import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Input, Separator, cn } from '@mashora/design-system'
import {
  ArrowRight,
  ChevronRight,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Trash2,
} from 'lucide-react'
import { toast } from '@/components/shared'

const CART_KEY = 'mashora_cart'

interface CartItem {
  product_id: number
  variant_id?: number
  name: string
  price: number
  quantity: number
  image?: string
}

function imageUrl(image: string | undefined | null): string | null {
  if (!image) return null
  if (typeof image !== 'string') return null
  if (image.startsWith('data:') || image.startsWith('http')) return image
  return `data:image/png;base64,${image}`
}

function formatPrice(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '$0.00'
  return `$${n.toFixed(2)}`
}

function readCart(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(CART_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (x): x is CartItem =>
        !!x &&
        typeof x === 'object' &&
        typeof (x as CartItem).product_id === 'number' &&
        typeof (x as CartItem).name === 'string' &&
        typeof (x as CartItem).price === 'number' &&
        typeof (x as CartItem).quantity === 'number',
    )
  } catch {
    return []
  }
}

function writeCart(items: CartItem[]) {
  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify(items))
    window.dispatchEvent(new CustomEvent('mashora-cart-update'))
    window.dispatchEvent(new CustomEvent('mashora:cart-updated'))
  } catch {
    /* noop */
  }
}

interface UseCartResult {
  items: CartItem[]
  updateQty: (product_id: number, variant_id: number | undefined, qty: number) => void
  removeItem: (product_id: number, variant_id: number | undefined) => void
  clearCart: () => void
  total: number
  subtotal: number
  tax: number
  count: number
}

export function useCart(): UseCartResult {
  const [items, setItems] = useState<CartItem[]>(() => readCart())

  useEffect(() => {
    const onChange = () => setItems(readCart())
    window.addEventListener('storage', onChange)
    window.addEventListener('mashora:cart-updated', onChange)
    window.addEventListener('mashora-cart-update', onChange)
    return () => {
      window.removeEventListener('storage', onChange)
      window.removeEventListener('mashora:cart-updated', onChange)
      window.removeEventListener('mashora-cart-update', onChange)
    }
  }, [])

  const updateQty = useCallback(
    (product_id: number, variant_id: number | undefined, qty: number) => {
      setItems(prev => {
        const next = prev
          .map(it => {
            if (it.product_id === product_id && it.variant_id === variant_id) {
              return { ...it, quantity: Math.max(1, Math.floor(qty)) }
            }
            return it
          })
          .filter(it => it.quantity > 0)
        writeCart(next)
        return next
      })
    },
    [],
  )

  const removeItem = useCallback((product_id: number, variant_id: number | undefined) => {
    setItems(prev => {
      const next = prev.filter(
        it => !(it.product_id === product_id && it.variant_id === variant_id),
      )
      writeCart(next)
      return next
    })
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
    writeCart([])
  }, [])

  const subtotal = useMemo(
    () => items.reduce((sum, it) => sum + it.price * it.quantity, 0),
    [items],
  )
  const tax = useMemo(() => +(subtotal * 0.1).toFixed(2), [subtotal])
  const total = useMemo(() => +(subtotal + tax).toFixed(2), [subtotal, tax])
  const count = useMemo(() => items.reduce((sum, it) => sum + it.quantity, 0), [items])

  return { items, updateQty, removeItem, clearCart, total, subtotal, tax, count }
}

function CartRow({
  item,
  onChangeQty,
  onRemove,
}: {
  item: CartItem
  onChangeQty: (qty: number) => void
  onRemove: () => void
}) {
  const img = imageUrl(item.image)
  const lineTotal = item.price * item.quantity
  return (
    <div className="flex gap-4 rounded-2xl border border-border/60 bg-card p-4">
      <Link
        to={`/shop/${item.product_id}`}
        className="size-24 shrink-0 overflow-hidden rounded-xl bg-muted"
        aria-label={item.name}
      >
        {img ? (
          <img src={img} alt={item.name} className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center bg-gradient-to-br from-muted to-accent/30 text-muted-foreground">
            <ShoppingBag className="size-8" />
          </div>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
        <div className="min-w-0">
          <Link
            to={`/shop/${item.product_id}`}
            className="line-clamp-2 font-semibold leading-tight hover:underline"
          >
            {item.name}
          </Link>
          <div className="mt-1 text-sm text-muted-foreground">{formatPrice(item.price)}</div>
        </div>

        <div className="inline-flex items-center self-start rounded-full border border-border/60 bg-background">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => onChangeQty(Math.max(1, item.quantity - 1))}
            className="grid size-9 place-items-center rounded-l-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Minus className="size-4" />
          </button>
          <input
            type="number"
            min={1}
            value={item.quantity}
            onChange={e => {
              const v = Number(e.target.value)
              if (!Number.isNaN(v) && v > 0) onChangeQty(Math.floor(v))
            }}
            className="h-9 w-10 border-none bg-transparent text-center text-sm font-medium outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => onChangeQty(item.quantity + 1)}
            className="grid size-9 place-items-center rounded-r-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col items-end justify-between gap-2">
        <div className="text-base font-semibold">{formatPrice(lineTotal)}</div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${item.name}`}
          className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  )
}

export default function Cart() {
  const navigate = useNavigate()
  const { items, updateQty, removeItem, subtotal, tax, total, count } = useCart()
  const [promo, setPromo] = useState('')

  const onApplyPromo = (e: React.FormEvent) => {
    e.preventDefault()
    toast.info('No active promotions', promo ? `Code "${promo}" is not valid.` : undefined)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="mb-8 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">Cart</span>
      </nav>

      <header className="mb-8 flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Your cart</h1>
        <p className="text-sm text-muted-foreground">
          {count} {count === 1 ? 'item' : 'items'}
        </p>
      </header>

      {items.length === 0 ? (
        <div className="mx-auto max-w-md rounded-3xl border border-dashed border-border/60 bg-card/40 px-6 py-16 text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-muted">
            <ShoppingBag className="size-7 text-muted-foreground" />
          </div>
          <h2 className="mt-6 text-xl font-semibold">Your cart is empty</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Looks like you haven&apos;t added anything yet. Let&apos;s find something you&apos;ll love.
          </p>
          <Button asChild className="mt-6" size="lg">
            <Link to="/shop">Continue shopping</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Items list */}
          <div className="space-y-3">
            {items.map(item => (
              <CartRow
                key={`${item.product_id}-${item.variant_id ?? 'none'}`}
                item={item}
                onChangeQty={qty => updateQty(item.product_id, item.variant_id, qty)}
                onRemove={() => removeItem(item.product_id, item.variant_id)}
              />
            ))}
          </div>

          {/* Summary */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-6">
              <h2 className="text-lg font-semibold">Order summary</h2>

              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="font-medium">{formatPrice(subtotal)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Shipping</dt>
                  <dd className="font-medium text-emerald-600">Free</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Tax (est. 10%)</dt>
                  <dd className="font-medium">{formatPrice(tax)}</dd>
                </div>
              </dl>

              <Separator />

              <div className="flex items-center justify-between text-base font-semibold">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>

              <form onSubmit={onApplyPromo} className="flex gap-2 pt-2">
                <Input
                  type="text"
                  placeholder="Promo code"
                  value={promo}
                  onChange={e => setPromo(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" variant="outline">
                  Apply
                </Button>
              </form>

              <Button
                size="lg"
                className={cn('h-12 w-full text-base')}
                onClick={() => navigate('/checkout')}
              >
                Proceed to checkout
                <ArrowRight className="ml-2 size-4" />
              </Button>

              <Link
                to="/shop"
                className="block text-center text-sm text-muted-foreground hover:text-foreground"
              >
                Continue shopping
              </Link>

              <div className="flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-4" />
                Secure checkout
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
