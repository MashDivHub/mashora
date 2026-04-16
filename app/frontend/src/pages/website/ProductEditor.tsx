import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge, Button, Input, Label, Textarea, Skeleton,
  Tabs, TabsList, TabsTrigger, TabsContent,
  Card, CardContent,
  cn,
} from '@mashora/design-system'
import { ArrowLeft, Package, Save, Star, Upload, X } from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { toast } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

// ─── Constants ──────────────────────────────────────────────────────────────

const PRODUCT_TYPES = [
  { value: 'consu', label: 'Consumable' },
  { value: 'service', label: 'Service' },
  { value: 'product', label: 'Storable Product' },
]

const TRACKING_OPTIONS = [
  { value: 'none', label: 'No Tracking' },
  { value: 'lot', label: 'By Lots' },
  { value: 'serial', label: 'By Unique Serial Number' },
]

const INVOICE_POLICIES = [
  { value: 'order', label: 'Ordered quantities' },
  { value: 'delivery', label: 'Delivered quantities' },
]

const PURCHASE_METHODS = [
  { value: 'receive', label: 'On ordered quantities' },
  { value: 'purchase', label: 'On received quantities' },
]

const SERVICE_TRACKING = [
  { value: 'no', label: 'Nothing' },
  { value: 'task_global_project', label: 'Task' },
  { value: 'task_in_project', label: 'Project & Task' },
  { value: 'project_only', label: 'Project' },
]

// ─── Form type ──────────────────────────────────────────────────────────────

interface ProductForm {
  name: string
  default_code: string
  barcode: string
  type: string
  list_price: number
  volume: number
  weight: number
  categ_id: number | null
  uom_id: number | null
  company_id: number | null
  description_sale: string
  description_purchase: string
  description: string
  sale_ok: boolean
  purchase_ok: boolean
  active: boolean
  is_favorite: boolean
  is_storable: boolean
  website_published: boolean
  tracking: string
  invoice_policy: string
  purchase_method: string
  service_tracking: string
  sale_delay: number
  sequence: number
}

const EMPTY: ProductForm = {
  name: '', default_code: '', barcode: '', type: 'consu',
  list_price: 0, volume: 0, weight: 0,
  categ_id: null, uom_id: null, company_id: null,
  description_sale: '', description_purchase: '', description: '',
  sale_ok: true, purchase_ok: true, active: true,
  is_favorite: false, is_storable: false, website_published: false,
  tracking: 'none', invoice_policy: 'order', purchase_method: 'receive',
  service_tracking: 'no', sale_delay: 0, sequence: 0,
}

// ─── Shared field components ────────────────────────────────────────────────

const selectCls = 'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors appearance-none'

function PriceInput({ id, label, value, onChange, currency = '$' }: {
  id: string; label: string; value: number; onChange: (v: number) => void; currency?: string
}) {
  const [focused, setFocused] = useState(false)
  const [raw, setRaw] = useState('')

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)

  function handleFocus() {
    setFocused(true)
    setRaw(value === 0 ? '' : value.toString())
  }

  function handleBlur() {
    setFocused(false)
    const parsed = parseFloat(raw.replace(/,/g, ''))
    onChange(isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    // Allow digits, dots, commas, minus
    if (/^[-\d.,]*$/.test(v)) setRaw(v)
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">{currency}</span>
        <Input
          id={id}
          className="pl-7 font-mono tabular-nums text-right"
          value={focused ? raw : formatted}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="0.00"
          inputMode="decimal"
        />
      </div>
    </div>
  )
}

function SelectField({ id, label, value, onChange, options, hint }: {
  id: string; label: string; value: string; hint?: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} value={value} onChange={e => onChange(e.target.value)} className={selectCls}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function M2OField({ label, model, value, onChange }: {
  label: string; model: string; value: number | null
  onChange: (id: number | null) => void
}) {
  const [search, setSearch] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [open, setOpen] = useState(false)

  const { data: options } = useQuery({
    queryKey: ['m2o', model, search],
    queryFn: async () => {
      const { data } = await erpClient.raw.post(`/model/${model}/name_search`, { name: search || '', limit: 10 })
      return (data || []) as [number, string][]
    },
    enabled: open,
  })

  useEffect(() => {
    if (value && !displayName) {
      erpClient.raw.post(`/model/${model}/name_search`, { name: '', limit: 1, args: [['id', '=', value]] })
        .then(({ data }) => { if (data?.[0]) setDisplayName(data[0][1]) })
        .catch(() => {})
    }
  }, [value, model, displayName])

  return (
    <div className="space-y-2 relative">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          value={open ? search : displayName}
          onChange={e => { setSearch(e.target.value); if (!open) setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder={`Search ${label.toLowerCase()}...`}
        />
        {value && (
          <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-destructive transition-colors" onClick={() => { onChange(null); setDisplayName('') }}>
            clear
          </button>
        )}
      </div>
      {open && options && options.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-lg border border-border/60 bg-popover shadow-lg max-h-48 overflow-y-auto">
          {options.map(([id, name]) => (
            <button key={id} type="button" className="w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors first:rounded-t-lg last:rounded-b-lg" onMouseDown={() => { onChange(id); setDisplayName(name); setOpen(false) }}>
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none group">
      <div className={cn(
        'flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors',
        checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input group-hover:border-muted-foreground'
      )}>
        {checked && <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><polyline points="20 6 9 17 4 12" /></svg>}
      </div>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only" />
      {label}
    </label>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function ProductEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id || id === 'new'
  const recordId = isNew ? null : Number(id)

  const [form, setForm] = useState<ProductForm>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10MB'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Extract base64 part after "data:image/...;base64,"
      const b64 = result.split(',')[1]
      setImageBase64(b64)
    }
    reader.readAsDataURL(file)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['product-editor', recordId],
    queryFn: () => erpClient.raw.get(`/website/products/${recordId}`).then(r => r.data),
    enabled: !!recordId && !isNaN(recordId!),
  })

  useEffect(() => {
    if (data) {
      const str = (v: any) => typeof v === 'object' && v ? (v?.en_US || Object.values(v)[0] || '') : (v || '')
      const m2oId = (v: any) => Array.isArray(v) ? v[0] : (v || null)
      setForm({
        name: str(data.name), default_code: data.default_code || '', barcode: data.barcode || '',
        type: data.type || 'consu', list_price: data.list_price ?? 0, volume: data.volume ?? 0, weight: data.weight ?? 0,
        categ_id: m2oId(data.categ_id), uom_id: m2oId(data.uom_id), company_id: m2oId(data.company_id),
        description_sale: str(data.description_sale), description_purchase: str(data.description_purchase), description: str(data.description),
        sale_ok: data.sale_ok !== false, purchase_ok: data.purchase_ok !== false, active: data.active !== false,
        is_favorite: !!data.is_favorite, is_storable: !!data.is_storable, website_published: !!data.website_published,
        tracking: data.tracking || 'none', invoice_policy: data.invoice_policy || 'order',
        purchase_method: data.purchase_method || 'receive', service_tracking: data.service_tracking || 'no',
        sale_delay: data.sale_delay ?? 0, sequence: data.sequence ?? 0,
      })
    }
  }, [data])

  function set<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Product name is required'); return }
    setSaving(true)
    try {
      const vals: Record<string, any> = { ...form }
      if (!vals.categ_id) delete vals.categ_id
      if (!vals.uom_id) delete vals.uom_id
      if (!vals.company_id) delete vals.company_id
      // Include image if changed
      if (imageBase64 !== null) {
        vals.image_1920 = imageBase64 || false  // empty string = remove, base64 = set
      }

      if (isNew) {
        const { data: created } = await erpClient.raw.post('/model/product.template/create', { vals })
        toast.success('Product created')
        const newId = created?.id || created?.record?.id
        navigate(newId ? `/admin/products/${newId}` : '/admin/website/products', { replace: true })
      } else {
        await erpClient.raw.put(`/model/product.template/${recordId}`, { vals })
        toast.success('Product saved')
        queryClient.invalidateQueries({ queryKey: ['product-editor', recordId] })
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // ── Loading / not found ──

  if (!isNew && isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2"><Skeleton className="h-3.5 w-20" /><Skeleton className="h-8 w-56" /></div>
        <Skeleton className="h-12 w-full rounded-xl" />
        <div className="grid gap-6 md:grid-cols-2"><Skeleton className="h-64 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>
      </div>
    )
  }

  if (!isNew && !data && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <Package className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium">Product not found.</p>
        <Button variant="outline" className="rounded-xl" onClick={() => navigate('/admin/website/products')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Products
        </Button>
      </div>
    )
  }

  // ── Render ──

  return (
    <div className="space-y-6">
      <PageHeader title={isNew ? 'New Product' : form.name || 'Product'} subtitle="products" backTo="/admin/products/list" />

      {/* ── Action bar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={handleSave} disabled={saving} className="rounded-xl">
          <Save className="h-4 w-4 mr-1.5" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <div className="flex items-center gap-2">
          {!isNew && (
            <>
              <Badge variant={form.website_published ? 'success' : 'secondary'} className="text-xs cursor-pointer select-none px-3 py-1" onClick={() => set('website_published', !form.website_published)}>
                {form.website_published ? 'Published' : 'Unpublished'}
              </Badge>
              <Badge variant={form.active ? 'outline' : 'destructive'} className="text-xs cursor-pointer select-none px-3 py-1" onClick={() => set('active', !form.active)}>
                {form.active ? 'Active' : 'Archived'}
              </Badge>
            </>
          )}
          <button onClick={() => set('is_favorite', !form.is_favorite)} className={cn('transition-colors', form.is_favorite ? 'text-amber-400' : 'text-muted-foreground hover:text-amber-400')}>
            <Star className={cn('h-5 w-5', form.is_favorite && 'fill-current')} />
          </button>
        </div>
      </div>

      {/* ── Hero section: name + price + type + image ── */}
      <Card className="rounded-2xl">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
            {/* Image */}
            <div className="shrink-0 relative group mx-auto sm:mx-0">
              <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleImageSelect} />
              <div
                className="flex w-32 h-32 items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/30 overflow-hidden cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/50"
                onClick={() => fileInputRef.current?.click()}
              >
                {(imageBase64 || data?.image_1920)
                  ? <img src={`data:image/png;base64,${imageBase64 || data.image_1920}`} alt={form.name} className="h-full w-full object-cover" />
                  : (
                    <div className="flex flex-col items-center gap-1.5 text-muted-foreground/50">
                      <Upload className="h-6 w-6" />
                      <span className="text-[10px] font-medium">Add image</span>
                    </div>
                  )
                }
              </div>
              {(imageBase64 || data?.image_1920) && (
                <button
                  type="button"
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); setImageBase64(''); }}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Fields */}
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name</Label>
                <Input id="name" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Wooden Chair" />
              </div>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                <PriceInput id="price" label="Sales Price" value={form.list_price} onChange={v => set('list_price', v)} />
                <SelectField id="type" label="Product Type" value={form.type} onChange={v => set('type', v)} options={PRODUCT_TYPES} />
                <div className="space-y-2">
                  <Label htmlFor="ref">Internal Reference</Label>
                  <Input id="ref" value={form.default_code} onChange={e => set('default_code', e.target.value)} placeholder="FURN-001" />
                </div>
              </div>
              <div className="flex flex-wrap gap-5 pt-1">
                <CheckField label="Can be Sold" checked={form.sale_ok} onChange={v => set('sale_ok', v)} />
                <CheckField label="Can be Purchased" checked={form.purchase_ok} onChange={v => set('purchase_ok', v)} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Tabs ── */}
      <Tabs defaultValue="general">
        <TabsList className="rounded-xl bg-muted/50 p-1">
          <TabsTrigger value="general" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">General</TabsTrigger>
          <TabsTrigger value="sales" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">Sales</TabsTrigger>
          <TabsTrigger value="purchase" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">Purchase</TabsTrigger>
          <TabsTrigger value="inventory" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">Inventory</TabsTrigger>
          <TabsTrigger value="notes" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card className="rounded-2xl mt-4">
            <CardContent className="p-4 sm:p-6">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="barcode">Barcode</Label>
                  <Input id="barcode" value={form.barcode} onChange={e => set('barcode', e.target.value)} placeholder="EAN13, UPC, ..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sequence">Sequence</Label>
                  <Input id="sequence" type="number" value={form.sequence} onChange={e => set('sequence', parseInt(e.target.value) || 0)} />
                </div>
                <M2OField label="Product Category" model="product.category" value={form.categ_id} onChange={id => set('categ_id', id)} />
                <M2OField label="Unit of Measure" model="uom.uom" value={form.uom_id} onChange={id => set('uom_id', id)} />
                <M2OField label="Company" model="res.company" value={form.company_id} onChange={id => set('company_id', id)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales">
          <Card className="rounded-2xl mt-4">
            <CardContent className="p-6 space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <SelectField id="invoice_policy" label="Invoicing Policy" value={form.invoice_policy} onChange={v => set('invoice_policy', v)} options={INVOICE_POLICIES} hint="How the product is invoiced" />
                <SelectField id="service_tracking" label="Service Tracking" value={form.service_tracking} onChange={v => set('service_tracking', v)} options={SERVICE_TRACKING} hint="Create tasks/projects on sale" />
                <div className="space-y-2">
                  <Label htmlFor="sale_delay">Customer Lead Time (days)</Label>
                  <Input id="sale_delay" type="number" min="0" value={form.sale_delay} onChange={e => set('sale_delay', parseInt(e.target.value) || 0)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc_sale">Sales Description</Label>
                <Textarea id="desc_sale" rows={4} value={form.description_sale} onChange={e => set('description_sale', e.target.value)} placeholder="Shown on quotations and sales orders..." />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="purchase">
          <Card className="rounded-2xl mt-4">
            <CardContent className="p-6 space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <SelectField id="purchase_method" label="Control Policy" value={form.purchase_method} onChange={v => set('purchase_method', v)} options={PURCHASE_METHODS} hint="When bills can be validated" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc_purchase">Purchase Description</Label>
                <Textarea id="desc_purchase" rows={4} value={form.description_purchase} onChange={e => set('description_purchase', e.target.value)} placeholder="Shown on purchase orders and RFQs..." />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory">
          <Card className="rounded-2xl mt-4">
            <CardContent className="p-4 sm:p-6">
              <div className="grid gap-5 md:grid-cols-2">
                <SelectField id="tracking" label="Tracking" value={form.tracking} onChange={v => set('tracking', v)} options={TRACKING_OPTIONS} hint="Lot/serial traceability" />
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input id="weight" type="number" step="0.01" min="0" value={form.weight} onChange={e => set('weight', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="volume">Volume (m³)</Label>
                  <Input id="volume" type="number" step="0.001" min="0" value={form.volume} onChange={e => set('volume', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="flex items-end pb-1">
                  <CheckField label="Is Storable" checked={form.is_storable} onChange={v => set('is_storable', v)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card className="rounded-2xl mt-4">
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-2">
                <Label htmlFor="desc_internal">Internal Notes</Label>
                <Textarea id="desc_internal" rows={6} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Internal notes about this product..." />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Variants (existing products only) ── */}
      {!isNew && data?.variants?.length > 0 && (
        <Card className="rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border/40 bg-muted/20">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Variants ({data.variants.length})</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/10">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Variant</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reference</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Barcode</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {data.variants.map((v: any) => (
                <tr key={v.id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-6 py-3 font-medium">{v.name || `#${v.id}`}</td>
                  <td className="px-6 py-3 font-mono text-muted-foreground">{v.default_code || '—'}</td>
                  <td className="px-6 py-3 font-mono text-muted-foreground">{v.barcode || '—'}</td>
                  <td className="px-6 py-3 text-right font-mono">{typeof v.standard_price === 'number' ? `$${v.standard_price.toFixed(2)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
