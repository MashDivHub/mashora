import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Skeleton, Button } from '@mashora/design-system'
import {
  ShoppingCart, User, Trash2, Plus, Percent, Bookmark, Printer,
  PackageOpen, ArrowLeft,
} from 'lucide-react'
import { erpClient } from '@/lib/erp-api'
import { M2OInput, toast, ConfirmDialog } from '@/components/shared'
import { queueOrder, syncAllPending, cacheProducts, type PosProductCache } from '@/lib/posOffline'
import { extractErrorMessage } from '@/lib/errors'
import { usePosOffline } from '@/hooks/usePosOffline'
import { useAuthStore } from '@/engine/AuthStore'

import {
  type CartLine, type PaymentLine, type Product, type PosSession, type PosConfig,
  type PosCategory, type PosPaymentMethod, type CompletedReceipt, type ServiceMode,
  TAX_RATE, categoryColor, fmtMoney, uuid,
} from './terminal/types'
import SessionGuard from './terminal/SessionGuard'
import TerminalHeader from './terminal/TerminalHeader'
import ProductCard from './terminal/ProductCard'
import CartLineRow from './terminal/CartLineRow'
import VariantPicker from './terminal/VariantPicker'
import PaymentDialog from './terminal/PaymentDialog'
import ReceiptScreen from './terminal/ReceiptScreen'

// ── Response shapes ──────────────────────────────────────────────────────────

interface ProductsResponse {
  records?: Product[]
  total?: number
}
interface CategoriesResponse {
  records?: PosCategory[]
}
interface SessionsResponse {
  records?: PosSession[]
}
interface PaymentMethodsResponse {
  records?: PosPaymentMethod[]
}

// ── Cart persistence ─────────────────────────────────────────────────────────

function cartStorageKey(configId: number) {
  return `mashora_pos_cart_${configId}`
}

function loadCart(configId: number): CartLine[] {
  try {
    const raw = localStorage.getItem(cartStorageKey(configId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as CartLine[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter(l => l && typeof l.productId === 'number' && typeof l.name === 'string')
  } catch {
    return []
  }
}

function saveCart(configId: number, cart: CartLine[]) {
  try {
    // Strip large image_1920 blobs on save (keep cart lightweight)
    const slim = cart.map(l => ({ ...l, image_1920: l.image_1920 ? l.image_1920.slice(0, 64) : null }))
    localStorage.setItem(cartStorageKey(configId), JSON.stringify(slim))
  } catch {
    // Quota exceeded — drop silently
  }
}

function clearCartStorage(configId: number) {
  try { localStorage.removeItem(cartStorageKey(configId)) } catch { /* noop */ }
}

// ── Main component ───────────────────────────────────────────────────────────

export default function PosTerminal() {
  const { configId } = useParams<{ configId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const tableId = searchParams.get('table')

  const configIdNum = configId ? Number(configId) : 0
  const { online } = usePosOffline()
  const { user } = useAuthStore()

  // UI state
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [cart, setCart] = useState<CartLine[]>(() => configIdNum ? loadCart(configIdNum) : [])
  const [customer, setCustomer] = useState<[number, string] | false>(false)
  const [mode, setMode] = useState<ServiceMode>(tableId ? 'dine_in' : 'dine_in')
  const [mobileCartOpen, setMobileCartOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [receipt, setReceipt] = useState<CompletedReceipt | null>(null)
  const [variantProduct, setVariantProduct] = useState<Product | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const barcodeBuf = useRef<{ chars: string; lastAt: number }>({ chars: '', lastAt: 0 })

  // Persist cart
  useEffect(() => {
    if (!configIdNum) return
    saveCart(configIdNum, cart)
  }, [cart, configIdNum])

  // ── Data ───────────────────────────────────────────────────────────────────

  const { data: configData } = useQuery<PosConfig>({
    queryKey: ['pos-config', configIdNum],
    enabled: configIdNum > 0,
    queryFn: () => erpClient.raw
      .get(`/pos/configs/${configIdNum}`)
      .then(r => r.data)
      .catch(() => ({ id: configIdNum, name: `Register #${configIdNum}` } as PosConfig)),
    staleTime: 300_000,
  })

  const { data: categoriesData, isLoading: catsLoading } = useQuery<CategoriesResponse>({
    queryKey: ['pos-categories'],
    queryFn: () => erpClient.raw.get('/pos/categories').then(r => r.data).catch(() => ({ records: [] })),
    staleTime: 300_000,
  })

  const { data: productsData, isLoading: prodsLoading } = useQuery<ProductsResponse>({
    queryKey: ['pos-products', search, selectedCategory],
    queryFn: () => erpClient.raw
      .post('/website/products', {
        search: search || undefined,
        category_id: selectedCategory ?? undefined,
        limit: 60,
      })
      .then(r => r.data)
      .catch(() => ({ records: [] })),
    staleTime: 60_000,
  })

  const { data: sessionData, isLoading: sessionLoading, refetch: refetchSession } = useQuery<SessionsResponse>({
    queryKey: ['pos-session-active', configIdNum],
    enabled: configIdNum > 0,
    queryFn: () => erpClient.raw
      .get('/pos/sessions', {
        params: { config_id: configIdNum, state: 'opened', limit: 1 },
      })
      .then(r => r.data)
      .catch(() => ({ records: [] })),
  })

  const activeSession = sessionData?.records?.[0] ?? null

  const { data: paymentMethodsData } = useQuery<PaymentMethodsResponse>({
    queryKey: ['pos-payment-methods', configIdNum],
    queryFn: () => erpClient.raw
      .get('/pos/payment-methods', { params: { active_only: true } })
      .then(r => r.data)
      .catch(() => ({ records: [] })),
    staleTime: 300_000,
  })

  const paymentMethods: PosPaymentMethod[] = useMemo(() => {
    const records = paymentMethodsData?.records ?? []
    if (records.length > 0) return records
    return [
      { id: -1, name: 'Cash', is_cash_count: true },
      { id: -2, name: 'Card', is_cash_count: false },
    ]
  }, [paymentMethodsData])

  const categories = categoriesData?.records ?? []
  const categoriesById = useMemo(() => {
    const m = new Map<number, PosCategory>()
    for (const c of categories) m.set(c.id, c)
    return m
  }, [categories])

  const allProducts: Product[] = productsData?.records ?? []

  // Client-side category filter (backend may or may not apply categ filter)
  const filteredProducts = useMemo(() => {
    if (selectedCategory === null) return allProducts
    return allProducts.filter(p => {
      if (!p.categ_id) return false
      const id = Array.isArray(p.categ_id) ? p.categ_id[0] : p.categ_id
      return id === selectedCategory
    })
  }, [allProducts, selectedCategory])

  // Cache products for offline use
  useEffect(() => {
    if (allProducts.length > 0) {
      const cached: PosProductCache[] = allProducts.map(p => ({
        id: p.id,
        name: p.name,
        list_price: p.list_price ?? p.price ?? 0,
      }))
      cacheProducts(cached).catch(() => {})
    }
  }, [allProducts])

  // ── Cart helpers ───────────────────────────────────────────────────────────

  const addProductToCart = useCallback((product: Product, opts?: { variantId?: number; variantName?: string; price?: number; qty?: number; image?: string | null }) => {
    const productId = opts?.variantId ?? product.id
    const name = opts?.variantName ?? product.name
    const price = opts?.price ?? product.list_price ?? product.price ?? 0
    const qty = opts?.qty ?? 1

    setCart(prev => {
      // Merge same product+variant with zero discount / no note
      const matchIdx = prev.findIndex(l =>
        l.productId === productId
        && (l.variantId ?? null) === (opts?.variantId ?? null)
        && l.discount === 0
        && !l.note,
      )
      if (matchIdx >= 0) {
        return prev.map((l, i) => i === matchIdx ? { ...l, qty: l.qty + qty } : l)
      }
      const newLine: CartLine = {
        uid: uuid(),
        productId,
        variantId: opts?.variantId ?? null,
        name,
        price,
        qty,
        discount: 0,
        image_1920: opts?.image ?? (typeof product.image_1920 === 'string' ? product.image_1920 : null),
      }
      return [...prev, newLine]
    })
  }, [])

  function onProductClick(product: Product) {
    // Products with attribute lines open the variant picker; others go straight in.
    // The cheapest heuristic without an extra fetch: attempt to add directly; the
    // picker is also available via right-click.
    addProductToCart(product)
  }

  function onProductContext(e: React.MouseEvent, product: Product) {
    e.preventDefault()
    setVariantProduct(product)
  }

  function setQtyDelta(lineUid: string, delta: number) {
    setCart(prev =>
      prev
        .map(l => l.uid === lineUid ? { ...l, qty: l.qty + delta } : l)
        .filter(l => l.qty > 0),
    )
  }
  function setQty(lineUid: string, qty: number) {
    setCart(prev => prev.map(l => l.uid === lineUid ? { ...l, qty } : l).filter(l => l.qty > 0))
  }
  function removeLine(lineUid: string) {
    setCart(prev => prev.filter(l => l.uid !== lineUid))
  }
  function setDiscount(lineUid: string, discount: number) {
    setCart(prev => prev.map(l => l.uid === lineUid ? { ...l, discount } : l))
  }
  function setNote(lineUid: string, note: string) {
    setCart(prev => prev.map(l => l.uid === lineUid ? { ...l, note } : l))
  }
  function clearCart() {
    setCart([])
    setCustomer(false)
  }

  // Global discount: apply to each line
  function applyQuickDiscount() {
    const pctStr = window.prompt('Global discount % (0–100)', '10')
    if (pctStr == null) return
    const pct = Math.max(0, Math.min(100, Number(pctStr)))
    if (!Number.isFinite(pct)) return
    setCart(prev => prev.map(l => ({ ...l, discount: pct })))
  }

  function saveDraft() {
    if (cart.length === 0) return
    toast.success('Draft saved', 'Order is preserved for this register.')
  }

  // ── Totals ─────────────────────────────────────────────────────────────────

  const { subtotal, discount, tax, total } = useMemo(() => {
    const gross = cart.reduce((s, l) => s + l.price * l.qty, 0)
    const disc = cart.reduce((s, l) => s + l.price * l.qty * (l.discount / 100), 0)
    const net = gross - disc
    const t = net * TAX_RATE
    return { subtotal: gross, discount: disc, tax: t, total: net + t }
  }, [cart])

  const cartCount = cart.reduce((s, l) => s + l.qty, 0)

  // ── Payment ────────────────────────────────────────────────────────────────

  function openPayment() {
    if (cart.length === 0 || !activeSession) return
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

  async function validatePayment() {
    if (cart.length === 0) return
    const received = paymentLines.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    if (received + 0.001 < total) {
      toast.warning('Underpaid', `Need ${fmtMoney(total - received)} more`)
      return
    }
    if (!activeSession?.id) {
      toast.error('No active session')
      return
    }

    setSubmitting(true)
    const partnerId = Array.isArray(customer) ? customer[0] : null
    const change = Math.max(0, received - total)

    const payload = {
      session_id: activeSession.id,
      partner_id: partnerId,
      table_id: tableId ? Number(tableId) : null,
      lines: cart.map(l => ({
        product_id: l.productId,
        name: l.name,
        qty: l.qty,
        price_unit: l.price,
        discount: l.discount,
      })),
      payments: paymentLines
        .filter(p => p.payment_method_id > 0)
        .map(p => ({
          payment_method_id: p.payment_method_id,
          amount: Number(p.amount),
        })),
    }

    const isOnline = typeof navigator === 'undefined' || navigator.onLine

    try {
      if (!isOnline) throw new Error('offline')
      const { data } = await erpClient.raw.post('/pos/orders', payload)
      finishOrder({
        orderId: data?.id ?? 0,
        orderName: data?.name ?? `#${data?.id ?? ''}`,
        received, change,
      })
      toast.success('Order completed', data?.name ?? 'Saved to server')
    } catch (err: unknown) {
      try {
        const uuidStr = await queueOrder({
          session_id: activeSession.id,
          config_id: configIdNum,
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
          amount_paid: received,
          amount_return: change,
        })
        finishOrder({
          orderId: 0,
          orderName: `LOCAL-${uuidStr.slice(-6).toUpperCase()}`,
          received, change,
        })
        if (isOnline) {
          toast.error('Payment failed', extractErrorMessage(err))
          syncAllPending().catch(() => {})
        } else {
          toast.warning('Order saved offline', 'Will sync when connection returns')
        }
      } catch (queueErr) {
        toast.error('Payment failed', extractErrorMessage(queueErr ?? err))
      }
    } finally {
      setSubmitting(false)
    }
  }

  function finishOrder({ orderId, orderName, received, change }: { orderId: number; orderName: string; received: number; change: number }) {
    setReceipt({
      orderId, orderName,
      lines: cart,
      payments: paymentLines,
      subtotal, discount, tax, total,
      paid: received, change,
      customer: Array.isArray(customer) ? customer[1] : undefined,
      date: new Date().toLocaleString(),
    })
    setCart([])
    setCustomer(false)
    setPaymentLines([])
    setPaymentOpen(false)
    if (configIdNum) clearCartStorage(configIdNum)
  }

  // ── Keyboard shortcuts + barcode ───────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't hijack typing inside inputs for most shortcuts
      const target = e.target as HTMLElement | null
      const inInput = !!target && (
        target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.isContentEditable
      )

      if (e.key === '/' && !inInput) {
        e.preventDefault()
        searchInputRef.current?.focus()
        return
      }
      if (e.key === 'Escape') {
        // Close any sheet/drawer — dialogs handle their own Escape
        if (mobileCartOpen) setMobileCartOpen(false)
        if (variantProduct) setVariantProduct(null)
        if (confirmClear) setConfirmClear(false)
        // Also clear search when focused
        if (inInput && target === searchInputRef.current) {
          setSearch('')
          ;(target as HTMLInputElement).blur()
        }
        return
      }
      if (e.key === 'F2') {
        e.preventDefault()
        if (cart.length > 0) setConfirmClear(true)
        return
      }

      // Barcode heuristic: rapid printable char bursts terminated by Enter
      if (!inInput && e.key.length === 1) {
        const now = Date.now()
        const buf = barcodeBuf.current
        if (now - buf.lastAt > 100) buf.chars = ''
        buf.chars += e.key
        buf.lastAt = now
      } else if (!inInput && e.key === 'Enter') {
        const buf = barcodeBuf.current
        if (buf.chars.length >= 4) {
          setSearch(buf.chars)
          buf.chars = ''
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileCartOpen, variantProduct, confirmClear, cart.length])

  // ── Guards / loading states ────────────────────────────────────────────────

  if (!configIdNum) {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-6 bg-background">
        <div className="text-center space-y-3">
          <p className="text-base font-semibold">Invalid register</p>
          <Button onClick={() => navigate('/admin/pos')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        </div>
      </div>
    )
  }

  if (sessionLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <p className="text-sm">Loading register…</p>
        </div>
      </div>
    )
  }

  if (!activeSession) {
    return (
      <SessionGuard
        configId={configIdNum}
        configName={configData?.name}
        onOpened={() => { refetchSession() }}
      />
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const orderCountLabel = receipt ? receipt.orderName ?? '' : 'New order'

  return (
    <div className="fixed inset-0 flex flex-col bg-background text-foreground">
      {/* Header */}
      <TerminalHeader
        ref={searchInputRef}
        registerName={configData?.name ?? activeSession.name}
        sessionName={activeSession.name}
        online={online}
        search={search}
        onSearchChange={setSearch}
        onExit={() => navigate('/admin/pos')}
        onCloseSession={() => navigate(`/admin/pos/sessions/${activeSession.id}`)}
        onOpenFloors={() => navigate(`/admin/pos/restaurant/${configIdNum}`)}
        hasRestaurant={configData?.module_pos_restaurant}
        user={user ? { name: user.name, email: user.email } : undefined}
      />

      {/* Main two-column layout */}
      <div className="flex-1 flex min-h-0">
        {/* ── LEFT: products ───────────────────────────────────────────────── */}
        <section className="flex-1 min-w-0 flex flex-col">
          {/* Category pill row */}
          <div className="h-12 shrink-0 flex items-center gap-2 px-4 border-b border-border/30 overflow-x-auto scrollbar-none">
            <CategoryPill
              label="All"
              active={selectedCategory === null}
              onClick={() => setSelectedCategory(null)}
            />
            {catsLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-20 rounded-xl shrink-0" />
              ))
            ) : (
              categories.map(c => (
                <CategoryPill
                  key={c.id}
                  label={c.name}
                  active={selectedCategory === c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  color={categoryColor(c.color)}
                />
              ))
            )}
            {tableId && (
              <div className="ml-auto shrink-0 flex items-center gap-1.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold px-3 py-1.5">
                Table #{tableId}
              </div>
            )}
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {prodsLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <PackageOpen className="h-12 w-12 opacity-30" />
                <p className="text-sm">No products found</p>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => navigate('/admin/products/new')}
                >
                  <Plus className="h-4 w-4 mr-1.5" /> Create product
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredProducts.map(p => {
                  const categId = p.categ_id
                    ? (Array.isArray(p.categ_id) ? p.categ_id[0] : p.categ_id)
                    : undefined
                  const cat = categId ? categoriesById.get(categId as number) ?? null : null
                  return (
                    <ProductCard
                      key={p.id}
                      product={p}
                      category={cat}
                      onClick={() => onProductClick(p)}
                      onContextMenu={e => onProductContext(e, p)}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {/* ── RIGHT: cart ───────────────────────────────────────────────────── */}
        <aside
          className={`${mobileCartOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
            fixed md:relative inset-y-0 right-0 z-50 md:z-auto
            w-full md:w-[400px] xl:w-[460px]
            bg-card border-l border-border/40 flex flex-col
            transition-transform duration-200 shadow-2xl md:shadow-none`}
        >
          {receipt ? (
            <ReceiptScreen
              receipt={receipt}
              onNewOrder={() => setReceipt(null)}
            />
          ) : (
            <>
              {/* Cart header */}
              <div className="h-14 shrink-0 px-5 flex items-center justify-between border-b border-border/30">
                <div>
                  <h2 className="text-base font-bold">Current Order</h2>
                  <p className="text-[11px] text-muted-foreground">{orderCountLabel}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => cart.length > 0 && setConfirmClear(true)}
                    disabled={cart.length === 0}
                    className="h-9 w-9 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-all duration-200 disabled:opacity-30"
                    aria-label="Clear cart"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setMobileCartOpen(false)}
                    className="md:hidden h-9 w-9 rounded-lg text-muted-foreground hover:bg-muted/40 flex items-center justify-center"
                    aria-label="Close cart"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Mode tabs */}
              <div className="h-11 shrink-0 px-4 flex gap-1 border-b border-border/20">
                {(['dine_in', 'takeout', 'delivery'] as ServiceMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex-1 text-xs font-medium rounded-lg transition-all duration-200 ${
                      mode === m
                        ? 'bg-muted/60 text-foreground'
                        : 'text-muted-foreground hover:bg-muted/40'
                    }`}
                  >
                    {m === 'dine_in' ? 'Dine-in' : m === 'takeout' ? 'Takeout' : 'Delivery'}
                  </button>
                ))}
              </div>

              {/* Lines */}
              <div className="flex-1 overflow-y-auto px-3 py-3">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <ShoppingCart className="h-10 w-10 opacity-30" />
                    <p className="text-sm font-medium">Cart is empty</p>
                    <p className="text-xs">Tap a product to start</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cart.map(l => (
                      <CartLineRow
                        key={l.uid}
                        line={l}
                        onQtyChange={setQtyDelta}
                        onQtySet={setQty}
                        onRemove={removeLine}
                        onDiscountChange={setDiscount}
                        onNoteChange={setNote}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Customer */}
              <div className="shrink-0 px-4 py-3 border-t border-border/30 flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-muted/40 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <M2OInput
                    value={customer}
                    model="res.partner"
                    onChange={v => setCustomer(v || false)}
                    placeholder="Walk-in customer"
                  />
                </div>
              </div>

              {/* Totals */}
              <div className="shrink-0 px-6 py-4 border-t border-border/30 bg-muted/20 space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{fmtMoney(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-rose-400">
                    <span>Discount</span>
                    <span className="tabular-nums">− {fmtMoney(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax ({Math.round(TAX_RATE * 100)}%)</span>
                  <span className="tabular-nums">{fmtMoney(tax)}</span>
                </div>
                <div className="border-t border-border/30 pt-2 flex justify-between items-baseline">
                  <span className="font-semibold">Total</span>
                  <span className="text-2xl font-bold tabular-nums text-emerald-400">{fmtMoney(total)}</span>
                </div>
              </div>

              {/* Pay + actions */}
              <div className="shrink-0 p-4 space-y-2 border-t border-border/30">
                <button
                  onClick={openPayment}
                  disabled={cart.length === 0}
                  className="w-full h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-lg font-semibold transition-all duration-200 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  <span>Pay {fmtMoney(total)}</span>
                  <span aria-hidden>→</span>
                </button>
                <div className="grid grid-cols-3 gap-2">
                  <SecondaryAction icon={<Bookmark className="h-4 w-4" />} label="Save" onClick={saveDraft} />
                  <SecondaryAction icon={<Printer className="h-4 w-4" />} label="Reprint" onClick={() => window.print()} />
                  <SecondaryAction icon={<Percent className="h-4 w-4" />} label="Discount" onClick={applyQuickDiscount} />
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Mobile bottom "view cart" bar */}
      {cart.length > 0 && !mobileCartOpen && !receipt && (
        <button
          onClick={() => setMobileCartOpen(true)}
          className="md:hidden fixed bottom-4 left-4 right-4 z-30 flex items-center gap-3 rounded-2xl bg-emerald-500 text-white px-5 h-14 shadow-2xl font-semibold transition-all duration-200"
        >
          <span className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-xs">
            {cartCount}
          </span>
          <span>View cart</span>
          <span className="ml-auto tabular-nums">{fmtMoney(total)}</span>
        </button>
      )}
      {mobileCartOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileCartOpen(false)}
        />
      )}

      {/* Dialogs */}
      <VariantPicker
        product={variantProduct}
        open={!!variantProduct}
        onClose={() => setVariantProduct(null)}
        onAdd={({ variantId, variantName, price, qty, image_1920 }) => {
          if (!variantProduct) return
          addProductToCart(variantProduct, {
            variantId,
            variantName,
            price,
            qty,
            image: image_1920,
          })
        }}
      />

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        total={total}
        lineCount={cart.reduce((s, l) => s + l.qty, 0)}
        methods={paymentMethods}
        payments={paymentLines}
        onChangePayments={setPaymentLines}
        onValidate={validatePayment}
        submitting={submitting}
      />

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => { clearCart(); setConfirmClear(false) }}
        title="Clear cart?"
        message="All items in the current order will be removed. This can't be undone."
        confirmLabel="Clear"
        variant="danger"
      />
    </div>
  )
}

// ── Small inline subcomponents ──────────────────────────────────────────────

function CategoryPill({
  label, active, onClick, color,
}: { label: string; active: boolean; onClick: () => void; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 h-8 rounded-xl px-3 text-xs font-semibold transition-all duration-200 flex items-center gap-2 ${
        active
          ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
          : 'bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground'
      }`}
    >
      {color && (
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: color }}
          aria-hidden
        />
      )}
      {label}
    </button>
  )
}

function SecondaryAction({
  icon, label, onClick,
}: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-10 rounded-xl bg-muted/30 border border-border/30 text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground flex items-center justify-center gap-1.5 transition-all duration-200"
    >
      {icon}
      {label}
    </button>
  )
}
