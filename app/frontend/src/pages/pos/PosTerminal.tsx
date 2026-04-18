import { useState, useMemo, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Skeleton,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input,
} from '@mashora/design-system'
import { Search, Plus, Minus, X, ShoppingCart, User, Trash2, Printer, CreditCard, Wallet } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'
import { M2OInput, toast, PosOfflineBadge } from '@/components/shared'
import { queueOrder, syncAllPending, cacheProducts, type PosProductCache } from '@/lib/posOffline'

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

interface PosPaymentMethod {
  id: number
  name: string
  is_cash_count?: boolean
}

interface PosSession {
  id: number
  name: string
  config_id: [number, string]
  state: string
}

interface PaymentLine {
  payment_method_id: number
  payment_method_name: string
  amount: number
  is_cash: boolean
}

interface CompletedReceipt {
  orderId: number
  orderName?: string
  lines: CartLine[]
  payments: PaymentLine[]
  subtotal: number
  tax: number
  total: number
  paid: number
  change: number
  customer?: string
  date: string
}

// ── helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return '$' + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── main component ────────────────────────────────────────────────────────────

export default function PosTerminal() {
  const { configId } = useParams<{ configId: string }>()
  const [searchParams] = useSearchParams()
  const tableId = searchParams.get('table')

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [mobileCartOpen, setMobileCartOpen] = useState(false)
  const [customer, setCustomer] = useState<[number, string] | false>(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [receipt, setReceipt] = useState<CompletedReceipt | null>(null)

  const configIdNum = configId ? Number(configId) : null

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

  // Fetch active session for this config (needed to create orders)
  const { data: sessionData } = useQuery<{ records: PosSession[] }>({
    queryKey: ['pos-session-active', configIdNum],
    queryFn: () =>
      erpClient.raw
        .post('/model/pos.session', {
          domain: configIdNum
            ? [['config_id', '=', configIdNum], ['state', '=', 'opened']]
            : [['state', '=', 'opened']],
          fields: ['id', 'name', 'config_id', 'state'],
          limit: 1,
          order: 'id desc',
        })
        .then(r => r.data),
    enabled: !!configIdNum,
  })

  const activeSession = sessionData?.records?.[0]

  // Fetch payment methods (filtered by config_id, fallback to defaults if empty/error)
  const { data: paymentMethodsData } = useQuery<{ records: PosPaymentMethod[] }>({
    queryKey: ['pos-payment-methods', configIdNum],
    queryFn: () =>
      erpClient.raw
        .post('/model/pos.payment.method', {
          domain: configIdNum ? [['config_ids', 'in', [configIdNum]]] : [],
          fields: ['id', 'name', 'is_cash_count'],
          limit: 50,
        })
        .then(r => r.data)
        .catch(() => ({ records: [] })),
    staleTime: 300_000,
  })

  const paymentMethods: PosPaymentMethod[] = useMemo(() => {
    const records = paymentMethodsData?.records ?? []
    if (records.length > 0) return records
    // Fallback defaults — synthetic ids of -1/-2 (won't be sent if backend resolves properly)
    return [
      { id: -1, name: 'Cash', is_cash_count: true },
      { id: -2, name: 'Card', is_cash_count: false },
    ]
  }, [paymentMethodsData])

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
    setCustomer(false)
  }

  // ── totals ────────────────────────────────────────────────────────────────

  const subtotal = cart.reduce((sum, l) => sum + l.price * l.qty, 0)
  const tax = subtotal * 0.15
  const total = subtotal + tax
  const orderTotal = cart.length > 0 ? formatCurrency(total) : formatCurrency(0)

  const totalReceived = paymentLines.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const change = Math.max(0, totalReceived - total)
  const remaining = Math.max(0, total - totalReceived)

  // ── payment dialog handlers ──────────────────────────────────────────────

  function openPayment() {
    if (cart.length === 0) return
    // Seed with first method = total amount
    const first = paymentMethods[0]
    if (first) {
      setPaymentLines([{
        payment_method_id: first.id,
        payment_method_name: first.name,
        amount: total,
        is_cash: !!first.is_cash_count,
      }])
    } else {
      setPaymentLines([])
    }
    setPaymentOpen(true)
  }

  function addPaymentLine(methodId: number) {
    const m = paymentMethods.find(pm => pm.id === methodId)
    if (!m) return
    setPaymentLines(prev => [
      ...prev,
      {
        payment_method_id: m.id,
        payment_method_name: m.name,
        amount: remaining,
        is_cash: !!m.is_cash_count,
      },
    ])
  }

  function updatePaymentAmount(idx: number, amount: number) {
    setPaymentLines(prev => prev.map((p, i) => i === idx ? { ...p, amount } : p))
  }

  function removePaymentLine(idx: number) {
    setPaymentLines(prev => prev.filter((_, i) => i !== idx))
  }

  async function validatePayment() {
    if (cart.length === 0) return
    if (totalReceived + 0.001 < total) {
      toast.warning('Underpaid', `Need ${formatCurrency(remaining)} more`)
      return
    }
    if (!activeSession?.id) {
      toast.error('No active session', 'Open a POS session before charging orders.')
      return
    }

    setSubmitting(true)
    try {
      const partnerId = Array.isArray(customer) ? customer[0] : null

      // Queue order to IndexedDB first (works offline)
      const uuid = await queueOrder({
        session_id: activeSession.id,
        config_id: Number(configId) || 0,
        partner_id: partnerId,
        table_id: tableId ? Number(tableId) : null,
        lines: cart.map(l => ({
          product_id: l.productId,
          qty: l.qty,
          price_unit: l.price,
          product_name: l.name,
        })),
        payments: paymentLines.map(p => ({
          payment_method_id: p.payment_method_id,
          method_name: p.payment_method_name,
          amount: Number(p.amount),
        })),
        amount_total: total,
        amount_tax: tax,
        amount_paid: totalReceived,
        amount_return: change,
      })

      // Stash receipt immediately (don't block on sync)
      setReceipt({
        orderId: 0,  // Will update if sync succeeds
        orderName: `LOCAL-${uuid.slice(-6).toUpperCase()}`,
        lines: cart,
        payments: paymentLines,
        subtotal,
        tax,
        total,
        paid: totalReceived,
        change,
        customer: Array.isArray(customer) ? customer[1] : undefined,
        date: new Date().toLocaleString(),
      })

      const isOnline = typeof navigator === 'undefined' || navigator.onLine
      if (isOnline) {
        // Best-effort immediate sync (fire-and-forget)
        syncAllPending().then(({ succeeded, failed }) => {
          if (succeeded > 0) toast.success(`Order completed`, `${succeeded} synced to server`)
          if (failed > 0) toast.warning('Some orders failed to sync', 'Will retry automatically')
        }).catch(() => {})
        toast.success('Order saved', 'Syncing to server...')
      } else {
        toast.warning('Order saved offline', 'Will sync when connection returns')
      }

      // Reset cart
      setCart([])
      setCustomer(false)
      setPaymentLines([])
      setPaymentOpen(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record order'
      toast.error('Payment failed', msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Cache products to IndexedDB whenever they load (for offline use)
  useEffect(() => {
    if (allProducts.length > 0) {
      const cached: PosProductCache[] = allProducts.map(p => ({
        id: p.id,
        name: p.name,
        list_price: p.price,
      }))
      cacheProducts(cached).catch(() => {})
    }
  }, [allProducts])

  // Reset payment lines when closing dialog
  useEffect(() => {
    if (!paymentOpen) setPaymentLines([])
  }, [paymentOpen])

  function printReceipt() {
    if (!receipt) return
    // Print stub — opens browser print dialog with the receipt panel
    window.print()
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">

      {/* ── LEFT PANEL: Product Grid ────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 bg-background overflow-hidden">

        {/* Category tabs + search */}
        <div className="shrink-0 border-b border-border/30 px-4 pt-3 pb-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            {tableId ? (
              <div className="text-xs text-primary font-medium">Table #{tableId}</div>
            ) : <div />}
            <PosOfflineBadge />
          </div>
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

        {/* Receipt area below grid */}
        {receipt && (
          <div className="shrink-0 border-t border-border/30 bg-card/40 max-h-[40%] overflow-y-auto print:max-h-none print:overflow-visible">
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Printer className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">
                    Receipt {receipt.orderName ?? `#${receipt.orderId}`}
                  </span>
                </div>
                <div className="flex items-center gap-2 print:hidden">
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={printReceipt}>
                    <Printer className="h-3.5 w-3.5 mr-1.5" /> Print
                  </Button>
                  <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => setReceipt(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">{receipt.date}</div>
              {receipt.customer && (
                <div className="text-xs">Customer: <span className="font-medium">{receipt.customer}</span></div>
              )}
              <div className="rounded-xl border border-border/40 divide-y divide-border/20">
                {receipt.lines.map(l => (
                  <div key={l.productId} className="flex justify-between px-3 py-1.5 text-xs">
                    <span className="truncate flex-1">{l.qty} × {l.name}</span>
                    <span className="font-mono shrink-0 ml-2">{formatCurrency(l.price * l.qty)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">{formatCurrency(receipt.subtotal)}</span></div>
                <div className="flex justify-between"><span>Tax</span><span className="font-mono">{formatCurrency(receipt.tax)}</span></div>
                <div className="flex justify-between font-semibold border-t border-border/30 pt-1 mt-1">
                  <span>Total</span><span className="font-mono">{formatCurrency(receipt.total)}</span>
                </div>
                {receipt.payments.map((p, i) => (
                  <div key={i} className="flex justify-between text-muted-foreground">
                    <span>{p.payment_method_name}</span>
                    <span className="font-mono">{formatCurrency(p.amount)}</span>
                  </div>
                ))}
                {receipt.change > 0 && (
                  <div className="flex justify-between text-emerald-500 font-semibold">
                    <span>Change</span><span className="font-mono">{formatCurrency(receipt.change)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Mobile cart toggle (visible < md) ─────────────────────────────── */}
      {cart.length > 0 && !mobileCartOpen && (
        <button
          onClick={() => setMobileCartOpen(true)}
          className="md:hidden fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-3 shadow-lg font-semibold"
        >
          <ShoppingCart className="h-5 w-5" />
          <span>{cart.length}</span>
          <span>·</span>
          <span>{orderTotal}</span>
        </button>
      )}

      {/* Mobile cart overlay backdrop */}
      {mobileCartOpen && (
        <button
          type="button"
          aria-label="Close cart"
          className="md:hidden fixed inset-0 z-40 bg-black/50 cursor-default"
          onClick={() => setMobileCartOpen(false)}
        />
      )}

      {/* ── RIGHT PANEL: Cart ───────────────────────────────────────────────── */}
      <div
        className={`flex flex-col w-full md:w-[40%] md:min-w-[320px] bg-card border-l border-border/30 overflow-hidden fixed md:relative inset-y-0 right-0 z-50 md:z-auto transform transition-transform md:translate-x-0 ${mobileCartOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}
        role={mobileCartOpen ? 'dialog' : undefined}
        aria-modal={mobileCartOpen ? true : undefined}
        aria-labelledby={mobileCartOpen ? 'pos-cart-title' : undefined}
        onKeyDown={(e) => { if (mobileCartOpen && e.key === 'Escape') setMobileCartOpen(false) }}
      >

        {/* Cart header */}
        <div className="shrink-0 px-4 py-3 border-b border-border/30 flex items-center justify-between">
          <span id="pos-cart-title" className="text-sm font-semibold">Current Order</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-primary">{orderTotal}</span>
            <button
              type="button"
              onClick={() => setMobileCartOpen(false)}
              aria-label="Close cart"
              className="md:hidden h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted/40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
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

        {/* Customer chip */}
        {Array.isArray(customer) && (
          <div className="shrink-0 px-4 py-2 border-t border-border/30 flex items-center justify-between bg-muted/10">
            <div className="flex items-center gap-2 text-xs">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">{customer[1]}</span>
            </div>
            <button
              onClick={() => setCustomer(false)}
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

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
            onClick={openPayment}
            disabled={cart.length === 0}
            className="w-full h-14 text-lg rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Pay {cart.length > 0 ? formatCurrency(total) : ''}
          </button>
          <div className="flex gap-2">
            <div className="flex-1">
              <M2OInput
                value={customer}
                model="res.partner"
                onChange={v => setCustomer(v || false)}
                placeholder="Customer"
                className="h-9"
              />
            </div>
            <button
              onClick={clearCart}
              disabled={cart.length === 0}
              className="flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl border border-border/40 bg-transparent text-sm font-medium text-muted-foreground hover:bg-muted/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* ── PAYMENT DIALOG ──────────────────────────────────────────────────── */}
      <Dialog open={paymentOpen} onOpenChange={v => !submitting && setPaymentOpen(v)}>
        <DialogContent className="sm:max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Payment</span>
              <span className="text-2xl font-bold text-primary">{formatCurrency(total)}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="grid sm:grid-cols-2 gap-6">
            {/* Order summary */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Order Summary
              </h3>
              <div className="rounded-xl border border-border/40 max-h-48 overflow-y-auto divide-y divide-border/20">
                {cart.map(l => (
                  <div key={l.productId} className="flex justify-between px-3 py-2 text-xs">
                    <span className="truncate flex-1">{l.qty} × {l.name}</span>
                    <span className="font-mono shrink-0 ml-2">{formatCurrency(l.price * l.qty)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{formatCurrency(subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="font-mono">{formatCurrency(tax)}</span></div>
                <div className="flex justify-between font-semibold pt-1 border-t border-border/30">
                  <span>Total</span><span className="font-mono">{formatCurrency(total)}</span>
                </div>
              </div>

              <div className="pt-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Customer</label>
                <M2OInput
                  value={customer}
                  model="res.partner"
                  onChange={v => setCustomer(v || false)}
                  placeholder="Walk-in customer"
                />
              </div>
            </div>

            {/* Payment lines */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Payment Methods
              </h3>

              <div className="flex flex-wrap gap-2">
                {paymentMethods.map(m => (
                  <button
                    key={m.id}
                    onClick={() => addPaymentLine(m.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-muted/20 px-3 py-1.5 text-xs font-medium hover:bg-muted/40 transition-colors"
                  >
                    {m.is_cash_count
                      ? <Wallet className="h-3.5 w-3.5" />
                      : <CreditCard className="h-3.5 w-3.5" />}
                    {m.name}
                  </button>
                ))}
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {paymentLines.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No payment lines yet — pick a method above.</p>
                ) : paymentLines.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1 text-xs font-medium truncate flex items-center gap-1.5">
                      {p.is_cash
                        ? <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                        : <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />}
                      {p.payment_method_name}
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={p.amount}
                      onChange={e => updatePaymentAmount(i, Number(e.target.value))}
                      className="w-28 h-8 rounded-lg text-right font-mono text-xs"
                    />
                    <button
                      onClick={() => removePaymentLine(i)}
                      className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="space-y-1 pt-2 border-t border-border/30 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Received</span>
                  <span className="font-mono">{formatCurrency(totalReceived)}</span>
                </div>
                {remaining > 0.001 ? (
                  <div className="flex justify-between text-amber-500 font-semibold">
                    <span>Remaining</span>
                    <span className="font-mono">{formatCurrency(remaining)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-emerald-500 font-semibold">
                    <span>Change Due</span>
                    <span className="font-mono">{formatCurrency(change)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" className="rounded-xl" onClick={() => setPaymentOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={validatePayment}
              disabled={submitting || cart.length === 0 || remaining > 0.001}
            >
              {submitting ? 'Processing...' : `Validate ${formatCurrency(total)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
