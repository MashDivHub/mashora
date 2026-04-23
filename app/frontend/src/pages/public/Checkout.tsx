import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  cn,
} from '@mashora/design-system'
import {
  ChevronRight,
  CreditCard,
  Lock,
  Mail,
  MapPin,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react'
import { toast } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { useCart } from './Cart'

const COUNTRIES: { value: string; label: string }[] = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'ES', label: 'Spain' },
  { value: 'JP', label: 'Japan' },
]

type PaymentMethod = 'card' | 'paypal' | 'bank'

interface CheckoutForm {
  email: string
  firstName: string
  lastName: string
  address1: string
  city: string
  region: string
  postalCode: string
  country: string
  phone: string
  payment: PaymentMethod
  cardNumber: string
  cardExpiry: string
  cardCvv: string
}

type FormErrors = Partial<Record<keyof CheckoutForm, string>>

function formatPrice(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '$0.00'
  return `$${n.toFixed(2)}`
}

function imageUrl(image: string | undefined | null): string | null {
  if (!image) return null
  if (typeof image !== 'string') return null
  if (image.startsWith('data:') || image.startsWith('http')) return image
  return `data:image/png;base64,${image}`
}

function maskCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 19)
  return digits.replace(/(.{4})/g, '$1 ').trim()
}

function maskExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

function maskCvv(value: string): string {
  return value.replace(/\D/g, '').slice(0, 4)
}

export default function Checkout() {
  const navigate = useNavigate()
  const { items, subtotal, tax, total, count, clearCart } = useCart()

  const [form, setForm] = useState<CheckoutForm>({
    email: '',
    firstName: '',
    lastName: '',
    address1: '',
    city: '',
    region: '',
    postalCode: '',
    country: 'US',
    phone: '',
    payment: 'card',
    cardNumber: '',
    cardExpiry: '',
    cardCvv: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (items.length === 0 && !submitting) {
      navigate('/cart', { replace: true })
    }
  }, [items.length, submitting, navigate])

  const setField = <K extends keyof CheckoutForm>(key: K, value: CheckoutForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
    if (errors[key]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  const validate = (): FormErrors => {
    const e: FormErrors = {}
    if (!form.email.trim()) e.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Enter a valid email'
    if (!form.firstName.trim()) e.firstName = 'First name is required'
    if (!form.lastName.trim()) e.lastName = 'Last name is required'
    if (!form.address1.trim()) e.address1 = 'Address is required'
    if (!form.city.trim()) e.city = 'City is required'
    if (!form.region.trim()) e.region = 'State/region is required'
    if (!form.postalCode.trim()) e.postalCode = 'Postal code is required'
    if (!form.country.trim()) e.country = 'Country is required'
    if (!form.phone.trim()) e.phone = 'Phone is required'
    if (form.payment === 'card') {
      const digits = form.cardNumber.replace(/\D/g, '')
      if (digits.length < 12) e.cardNumber = 'Enter a valid card number'
      if (!/^\d{2}\/\d{2}$/.test(form.cardExpiry)) e.cardExpiry = 'MM/YY required'
      if (form.cardCvv.length < 3) e.cardCvv = 'CVV required'
    }
    return e
  }

  const handlePlaceOrder = async () => {
    const v = validate()
    if (Object.keys(v).length > 0) {
      setErrors(v)
      toast.error('Please complete the form', 'Fill in all required fields before placing your order.')
      return
    }
    setSubmitting(true)
    try {
      const lineSummary = items
        .map(it => `- ${it.quantity} x ${it.name} @ ${formatPrice(it.price)}`)
        .join('\n')
      const paymentLabel =
        form.payment === 'card'
          ? 'Credit card'
          : form.payment === 'paypal'
            ? 'PayPal'
            : 'Bank transfer'
      const description = [
        `Customer: ${form.firstName.trim()} ${form.lastName.trim()}`,
        `Email: ${form.email.trim()}`,
        `Phone: ${form.phone.trim()}`,
        '',
        'Shipping address:',
        form.address1.trim(),
        `${form.city.trim()}, ${form.region.trim()} ${form.postalCode.trim()}`,
        form.country,
        '',
        'Items:',
        lineSummary,
        '',
        `Subtotal: ${formatPrice(subtotal)}`,
        `Tax (10%): ${formatPrice(tax)}`,
        `Total: ${formatPrice(total)}`,
        '',
        `Payment method: ${paymentLabel}`,
      ].join('\n')

      await erpClient.raw.post('/crm/leads/create', {
        name: 'Website order',
        type: 'lead',
        contact_name: `${form.firstName.trim()} ${form.lastName.trim()}`,
        email_from: form.email.trim(),
        phone: form.phone.trim(),
        description,
      })

      clearCart()
      toast.success('Order placed!', 'We have received your order and will be in touch soon.')
      navigate('/order-success', { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Please try again.'
      toast.error('Could not place order', message)
    } finally {
      setSubmitting(false)
    }
  }

  const previewItems = useMemo(() => items.slice(0, 3), [items])
  const moreCount = Math.max(0, items.length - previewItems.length)

  if (items.length === 0) {
    return null
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="mb-8 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <ChevronRight className="size-3.5" />
        <Link to="/cart" className="hover:text-foreground">
          Cart
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">Checkout</span>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Checkout</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {count} {count === 1 ? 'item' : 'items'} in your cart
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* Left column */}
        <div className="space-y-6">
          {/* Contact */}
          <section className="rounded-2xl border border-border/60 bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <Mail className="size-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Contact</h2>
            </div>
            <div className="grid gap-4">
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={e => setField('email', e.target.value)}
                  placeholder="you@example.com"
                  aria-invalid={!!errors.email}
                  className={cn(errors.email && 'border-destructive')}
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-destructive">{errors.email}</p>
                )}
              </div>
            </div>
          </section>

          {/* Shipping address */}
          <section className="rounded-2xl border border-border/60 bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <MapPin className="size-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Shipping address</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="firstName">First name *</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={e => setField('firstName', e.target.value)}
                  aria-invalid={!!errors.firstName}
                  className={cn(errors.firstName && 'border-destructive')}
                />
                {errors.firstName && (
                  <p className="mt-1 text-xs text-destructive">{errors.firstName}</p>
                )}
              </div>
              <div>
                <Label htmlFor="lastName">Last name *</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={e => setField('lastName', e.target.value)}
                  aria-invalid={!!errors.lastName}
                  className={cn(errors.lastName && 'border-destructive')}
                />
                {errors.lastName && (
                  <p className="mt-1 text-xs text-destructive">{errors.lastName}</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="address1">Address *</Label>
                <Input
                  id="address1"
                  value={form.address1}
                  onChange={e => setField('address1', e.target.value)}
                  placeholder="Street address"
                  aria-invalid={!!errors.address1}
                  className={cn(errors.address1 && 'border-destructive')}
                />
                {errors.address1 && (
                  <p className="mt-1 text-xs text-destructive">{errors.address1}</p>
                )}
              </div>
              <div>
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={e => setField('city', e.target.value)}
                  aria-invalid={!!errors.city}
                  className={cn(errors.city && 'border-destructive')}
                />
                {errors.city && <p className="mt-1 text-xs text-destructive">{errors.city}</p>}
              </div>
              <div>
                <Label htmlFor="region">State / Region *</Label>
                <Input
                  id="region"
                  value={form.region}
                  onChange={e => setField('region', e.target.value)}
                  aria-invalid={!!errors.region}
                  className={cn(errors.region && 'border-destructive')}
                />
                {errors.region && (
                  <p className="mt-1 text-xs text-destructive">{errors.region}</p>
                )}
              </div>
              <div>
                <Label htmlFor="postalCode">Postal code *</Label>
                <Input
                  id="postalCode"
                  value={form.postalCode}
                  onChange={e => setField('postalCode', e.target.value)}
                  aria-invalid={!!errors.postalCode}
                  className={cn(errors.postalCode && 'border-destructive')}
                />
                {errors.postalCode && (
                  <p className="mt-1 text-xs text-destructive">{errors.postalCode}</p>
                )}
              </div>
              <div>
                <Label htmlFor="country">Country *</Label>
                <Select value={form.country} onValueChange={v => setField('country', v)}>
                  <SelectTrigger
                    id="country"
                    className={cn(errors.country && 'border-destructive')}
                  >
                    <SelectValue placeholder="Select a country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.country && (
                  <p className="mt-1 text-xs text-destructive">{errors.country}</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={e => setField('phone', e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  aria-invalid={!!errors.phone}
                  className={cn(errors.phone && 'border-destructive')}
                />
                {errors.phone && (
                  <p className="mt-1 text-xs text-destructive">{errors.phone}</p>
                )}
              </div>
            </div>
          </section>

          {/* Payment */}
          <section className="rounded-2xl border border-border/60 bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <CreditCard className="size-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Payment</h2>
            </div>

            <div className="grid gap-3">
              {(['card', 'paypal', 'bank'] as const).map(method => {
                const label =
                  method === 'card'
                    ? 'Credit / debit card'
                    : method === 'paypal'
                      ? 'PayPal'
                      : 'Bank transfer'
                const selected = form.payment === method
                return (
                  <label
                    key={method}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-xl border bg-background px-4 py-3 text-sm transition-colors',
                      selected
                        ? 'border-foreground ring-1 ring-foreground/20'
                        : 'border-border/60 hover:border-foreground/50',
                    )}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={method}
                      checked={selected}
                      onChange={() => setField('payment', method)}
                      className="size-4 accent-foreground"
                    />
                    <span className="font-medium">{label}</span>
                  </label>
                )
              })}
            </div>

            {form.payment === 'card' && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="cardNumber">Card number *</Label>
                  <Input
                    id="cardNumber"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="1234 5678 9012 3456"
                    value={form.cardNumber}
                    onChange={e => setField('cardNumber', maskCardNumber(e.target.value))}
                    aria-invalid={!!errors.cardNumber}
                    className={cn(errors.cardNumber && 'border-destructive')}
                  />
                  {errors.cardNumber && (
                    <p className="mt-1 text-xs text-destructive">{errors.cardNumber}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="cardExpiry">Expiry *</Label>
                  <Input
                    id="cardExpiry"
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    placeholder="MM/YY"
                    value={form.cardExpiry}
                    onChange={e => setField('cardExpiry', maskExpiry(e.target.value))}
                    aria-invalid={!!errors.cardExpiry}
                    className={cn(errors.cardExpiry && 'border-destructive')}
                  />
                  {errors.cardExpiry && (
                    <p className="mt-1 text-xs text-destructive">{errors.cardExpiry}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="cardCvv">CVV *</Label>
                  <Input
                    id="cardCvv"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    placeholder="123"
                    value={form.cardCvv}
                    onChange={e => setField('cardCvv', maskCvv(e.target.value))}
                    aria-invalid={!!errors.cardCvv}
                    className={cn(errors.cardCvv && 'border-destructive')}
                  />
                  {errors.cardCvv && (
                    <p className="mt-1 text-xs text-destructive">{errors.cardCvv}</p>
                  )}
                </div>
                <p className="sm:col-span-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="size-3.5" />
                  Demo checkout — your card will not be charged.
                </p>
              </div>
            )}

            {form.payment === 'paypal' && (
              <p className="mt-4 text-sm text-muted-foreground">
                You&apos;ll be prompted to complete payment with PayPal after placing your order.
              </p>
            )}
            {form.payment === 'bank' && (
              <p className="mt-4 text-sm text-muted-foreground">
                Our team will email you wire transfer instructions after placing your order.
              </p>
            )}
          </section>

          <Button
            size="lg"
            className="h-12 w-full text-base"
            disabled={submitting}
            onClick={handlePlaceOrder}
          >
            {submitting ? 'Placing order…' : `Place order — ${formatPrice(total)}`}
          </Button>
        </div>

        {/* Right column */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-6">
            <h2 className="text-lg font-semibold">Order summary</h2>

            <ul className="space-y-3">
              {previewItems.map(it => {
                const img = imageUrl(it.image)
                return (
                  <li
                    key={`${it.product_id}-${it.variant_id ?? 'none'}`}
                    className="flex items-center gap-3"
                  >
                    <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {img ? (
                        <img src={img} alt={it.name} className="size-full object-cover" />
                      ) : (
                        <div className="grid size-full place-items-center text-muted-foreground">
                          <ShoppingBag className="size-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{it.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Qty {it.quantity} · {formatPrice(it.price)}
                      </div>
                    </div>
                    <div className="text-sm font-semibold">
                      {formatPrice(it.price * it.quantity)}
                    </div>
                  </li>
                )
              })}
              {moreCount > 0 && (
                <li className="text-xs text-muted-foreground">+ {moreCount} more</li>
              )}
            </ul>

            <Separator />

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

            <div className="flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-4" />
              Secure checkout
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
