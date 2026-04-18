import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge, Button, Input, Label, Textarea, Skeleton,
  Tabs, TabsList, TabsTrigger, TabsContent,
  Card, CardContent,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  cn,
} from '@mashora/design-system'
import { ArrowLeft, Package, Save, Star, Upload, X, Plus, Trash2, Loader2, Boxes, BarChart3, ShoppingCart, CreditCard, RefreshCw, ArrowDownToLine, ArrowUpFromLine, ExternalLink, Printer, Sliders } from 'lucide-react'
import JsBarcode from 'jsbarcode'
import { jsPDF } from 'jspdf'
import { PageHeader, FieldHelp, LoadingState } from '@/components/shared'
import { toast } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

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

interface ProductVariant {
  id: number
  name?: string
  default_code?: string | false
  barcode?: string | false
  standard_price?: number
}

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
  service_tracking: 'no', sequence: 0,
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

function SelectField({ id, label, value, onChange, options, hint, help }: {
  id: string; label: string; value: string; hint?: string; help?: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <Label htmlFor={id}>{label}</Label>
        {help && <FieldHelp text={help} />}
      </div>
      <select id={id} value={value} onChange={e => onChange(e.target.value)} className={selectCls}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

type M2OOption = { id: number; display_name: string }

function normalizeM2OResponse(data: unknown): M2OOption[] {
  let arr: unknown[]
  if (Array.isArray(data)) arr = data
  else if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown[] }).results)) {
    arr = (data as { results: unknown[] }).results
  } else {
    arr = []
  }
  return arr.map((r): M2OOption => {
    if (Array.isArray(r)) return { id: Number(r[0]), display_name: String(r[1] ?? '') }
    const obj = (r && typeof r === 'object' ? r : {}) as { id?: number; display_name?: string; name?: string }
    return {
      id: Number(obj.id ?? 0),
      display_name: obj.display_name ?? obj.name ?? String(obj.id ?? ''),
    }
  })
}

// Per-model defaults sent alongside `{name: ...}` when creating inline.
// Only needed when the model has additional NOT NULL columns.
const M2O_CREATE_EXTRAS: Record<string, Record<string, unknown>> = {
  'uom.uom': { relative_factor: 1 },
}
// Models where inline-create is not feasible (too many required fields);
// we show a helpful message instead of a broken "+ Create" button.
const M2O_CREATE_DISABLED = new Set<string>(['res.company'])

function M2OField({ label, model, value, onChange, hint, allowCreate = true }: {
  label: string; model: string; value: number | null
  onChange: (id: number | null) => void
  hint?: string
  allowCreate?: boolean
}) {
  const [search, setSearch] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const queryClient = useQueryClient()
  const createEnabled = allowCreate && !M2O_CREATE_DISABLED.has(model)

  const { data: options } = useQuery({
    queryKey: ['m2o', model, search],
    queryFn: async () => {
      const { data } = await erpClient.raw.post(`/model/${model}/name_search`, { name: search || '', limit: 10 })
      return normalizeM2OResponse(data)
    },
    enabled: open,
  })

  useEffect(() => {
    if (value && !displayName) {
      erpClient.raw.post(`/model/${model}/name_search`, { name: '', limit: 1, domain: [['id', '=', value]] })
        .then(({ data }) => {
          const opts = normalizeM2OResponse(data)
          if (opts[0]) setDisplayName(opts[0].display_name)
        })
        .catch(() => {})
    }
  }, [value, model, displayName])

  const trimmed = search.trim()
  const hasExact = !!options?.some(o => o.display_name.toLowerCase() === trimmed.toLowerCase())
  const canCreate = createEnabled && open && trimmed.length > 0 && !hasExact && !creating
  const showCreateHint = createEnabled && open && trimmed.length === 0 // passive discoverability

  async function createNew() {
    if (!trimmed) return
    setCreating(true)
    try {
      const vals = { name: trimmed, ...(M2O_CREATE_EXTRAS[model] || {}) }
      const { data } = await erpClient.raw.post(`/model/${model}/create`, { vals })
      const newId = data?.id
      if (newId) {
        onChange(newId)
        setDisplayName(trimmed)
        setOpen(false)
        setSearch('')
        queryClient.invalidateQueries({ queryKey: ['m2o', model] })
        toast.success('Created', `${label}: "${trimmed}"`)
      }
    } catch (e: unknown) {
      toast.error('Create failed', extractErrorMessage(e, "Could not create record"))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          value={open ? search : displayName}
          onChange={e => { setSearch(e.target.value); if (!open) setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder={createEnabled ? `Search or type a new ${label.toLowerCase()}...` : `Search ${label.toLowerCase()}...`}
        />
        {value && (
          <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-destructive transition-colors" onClick={() => { onChange(null); setDisplayName('') }}>
            clear
          </button>
        )}
        {open && (options?.length || canCreate || showCreateHint) && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border border-border/60 bg-popover shadow-lg max-h-48 overflow-y-auto">
          {options?.map(o => (
            <button key={o.id} type="button" className="w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors first:rounded-t-lg" onMouseDown={() => { onChange(o.id); setDisplayName(o.display_name); setOpen(false) }}>
              {o.display_name}
            </button>
          ))}
          {showCreateHint && !options?.length && (
            <div className="px-3 py-2 text-xs text-muted-foreground italic border-t border-border/40">
              Type a name to create a new one
            </div>
          )}
          {showCreateHint && !!options?.length && (
            <div className="px-3 py-1.5 text-[11px] text-muted-foreground italic border-t border-border/40 bg-muted/20">
              Type a new name to add it
            </div>
          )}
          {canCreate && (
            <button
              type="button"
              className="w-full px-3 py-2 text-sm text-left border-t border-border/40 bg-accent/30 hover:bg-accent transition-colors last:rounded-b-lg font-medium"
              onMouseDown={e => { e.preventDefault(); createNew() }}
            >
              + Create "{trimmed}"
            </button>
          )}
          </div>
        )}
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

function CheckField({ label, checked, onChange, help }: { label: string; checked: boolean; onChange: (v: boolean) => void; help?: string }) {
  return (
    <span className="inline-flex items-center gap-1">
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
      {help && <FieldHelp text={help} />}
    </span>
  )
}

// ─── Vendor picker (M2O for res.partner) ────────────────────────────────────

function VendorPicker({ value, displayName, onChange, placeholder = 'Search vendor...' }: {
  value: number | null
  displayName: string
  onChange: (id: number | null, name: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const { data: options } = useQuery({
    queryKey: ['vendor-search', search],
    queryFn: async () => {
      const { data } = await erpClient.raw.post(`/model/res.partner/name_search`, {
        name: search || '',
        domain: [['supplier_rank', '>', 0]],
        limit: 10,
      })
      return normalizeM2OResponse(data)
    },
    enabled: open,
  })

  return (
    <div className="relative">
      <Input
        value={open ? search : displayName}
        onChange={e => { setSearch(e.target.value); if (!open) setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder={placeholder}
        className="h-8 text-sm"
      />
      {open && options && options.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-lg border border-border/60 bg-popover shadow-lg max-h-48 overflow-y-auto">
          {options.map(o => (
            <button
              key={o.id}
              type="button"
              className="w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors first:rounded-t-lg last:rounded-b-lg"
              onMouseDown={() => { onChange(o.id, o.display_name); setOpen(false); setSearch('') }}
            >
              {o.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Suppliers section (product.supplierinfo) ───────────────────────────────

interface SupplierRow {
  id?: number
  _localId?: string
  _isNew?: boolean
  partner_id: number | null
  partner_name: string
  price: number
  min_qty: number
  delay: number
}

let supplierLocalCounter = 1

function SuppliersSection({ productTmplId }: { productTmplId: number | null }) {
  const queryClient = useQueryClient()
  const [newRows, setNewRows] = useState<SupplierRow[]>([])
  const [savingKey, setSavingKey] = useState<string | number | null>(null)

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['product-suppliers', productTmplId],
    queryFn: async () => {
      if (!productTmplId) return []
      const { data } = await erpClient.raw.post('/model/product.supplierinfo', {
        domain: [['product_tmpl_id', '=', productTmplId]],
        fields: ['id', 'partner_id', 'price', 'min_qty', 'delay', 'sequence'],
        order: 'sequence asc, id asc',
        limit: 100,
      })
      return (data.records || []) as Array<Record<string, unknown>>
    },
    enabled: !!productTmplId,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['product-suppliers', productTmplId] })

  const addRow = () => {
    setNewRows(prev => [...prev, {
      _localId: `new-${supplierLocalCounter++}`,
      _isNew: true,
      partner_id: null,
      partner_name: '',
      price: 0,
      min_qty: 1,
      delay: 1,
    }])
  }

  const saveNew = async (row: SupplierRow) => {
    if (!row.partner_id || !productTmplId) return
    setSavingKey(row._localId!)
    try {
      await erpClient.raw.post('/model/product.supplierinfo/create', {
        vals: {
          product_tmpl_id: productTmplId,
          partner_id: row.partner_id,
          price: Number(row.price) || 0,
          min_qty: Number(row.min_qty) || 0,
          delay: Number(row.delay) || 0,
        },
      })
      setNewRows(prev => prev.filter(r => r._localId !== row._localId))
      refresh()
    } catch (e: unknown) {
      toast.error('Failed to add vendor', extractErrorMessage(e, "Unknown error"))
    } finally {
      setSavingKey(null)
    }
  }

  const updateExisting = async (id: number, vals: Record<string, any>) => {
    setSavingKey(id)
    try {
      await erpClient.raw.put(`/model/product.supplierinfo/${id}`, { vals })
      refresh()
    } catch (e: unknown) {
      toast.error('Failed to update vendor', extractErrorMessage(e, "Unknown error"))
    } finally {
      setSavingKey(null)
    }
  }

  const deleteRow = async (id: number) => {
    if (!confirm('Remove this vendor from the product?')) return
    setSavingKey(id)
    try {
      await erpClient.raw.delete(`/model/product.supplierinfo/${id}`)
      refresh()
    } catch (e: unknown) {
      toast.error('Failed to delete vendor', extractErrorMessage(e, "Unknown error"))
    } finally {
      setSavingKey(null)
    }
  }

  const vendorName = (v: unknown): string => Array.isArray(v) ? String(v[1] ?? '') : ''
  const vendorId = (v: unknown): number | null =>
    Array.isArray(v) ? (typeof v[0] === 'number' ? v[0] : null) : (typeof v === 'number' ? v : null)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Vendors</Label>
        {!productTmplId && (
          <span className="text-xs text-muted-foreground">Save the product first to add vendors</span>
        )}
      </div>

      <div className="rounded-xl border border-border/50 overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/30">
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-3 py-2 w-[38%]">Vendor</th>
              <th className="text-right px-3 py-2 w-[18%]">Price</th>
              <th className="text-right px-3 py-2 w-[14%]">Min Qty</th>
              <th className="text-right px-3 py-2 w-[18%]">Lead (days)</th>
              <th className="w-[6%]"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground"><LoadingState label="Loading vendors..." /></td></tr>
            )}

            {!isLoading && suppliers.length === 0 && newRows.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                {productTmplId ? 'No vendors yet — click "Add vendor" below' : 'No vendors'}
              </td></tr>
            )}

            {suppliers.map((s) => {
              const sid = typeof s.id === 'number' ? s.id : Number(s.id)
              return (
                <ExistingSupplierRow
                  key={sid}
                  row={s}
                  saving={savingKey === sid}
                  onChange={(patch) => updateExisting(sid, patch)}
                  onDelete={() => deleteRow(sid)}
                  vendorName={vendorName}
                  vendorId={vendorId}
                />
              )
            })}

            {newRows.map(row => (
              <tr key={row._localId} className="bg-emerald-50/30 dark:bg-emerald-950/10 border-t border-border/30">
                <td className="px-3 py-2">
                  <VendorPicker
                    value={row.partner_id}
                    displayName={row.partner_name}
                    onChange={(id, name) => {
                      setNewRows(prev => prev.map(r => r._localId === row._localId ? { ...r, partner_id: id, partner_name: name } : r))
                      if (id && productTmplId) {
                        setTimeout(() => saveNew({ ...row, partner_id: id, partner_name: name }), 0)
                      }
                    }}
                  />
                </td>
                <td className="px-3 py-2">
                  <Input type="number" step="0.01" min="0" value={row.price}
                    onChange={e => setNewRows(prev => prev.map(r => r._localId === row._localId ? { ...r, price: parseFloat(e.target.value) || 0 } : r))}
                    onBlur={() => saveNew(row)}
                    className="h-8 text-sm text-right font-mono" />
                </td>
                <td className="px-3 py-2">
                  <Input type="number" step="1" min="0" value={row.min_qty}
                    onChange={e => setNewRows(prev => prev.map(r => r._localId === row._localId ? { ...r, min_qty: parseFloat(e.target.value) || 0 } : r))}
                    onBlur={() => saveNew(row)}
                    className="h-8 text-sm text-right font-mono" />
                </td>
                <td className="px-3 py-2">
                  <Input type="number" step="1" min="0" value={row.delay}
                    onChange={e => setNewRows(prev => prev.map(r => r._localId === row._localId ? { ...r, delay: parseInt(e.target.value) || 0 } : r))}
                    onBlur={() => saveNew(row)}
                    className="h-8 text-sm text-right font-mono" />
                </td>
                <td className="px-3 py-2 text-center">
                  {savingKey === row._localId ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-muted-foreground" />
                  ) : (
                    <button type="button" onClick={() => setNewRows(prev => prev.filter(r => r._localId !== row._localId))}
                      className="text-muted-foreground/60 hover:text-destructive transition-colors" title="Discard">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button type="button" variant="outline" size="sm" className="rounded-xl gap-1.5"
        onClick={addRow} disabled={!productTmplId}
        title={!productTmplId ? 'Save the product first to add vendors' : 'Add a new vendor'}>
        <Plus className="h-3.5 w-3.5" /> Add vendor
      </Button>
    </div>
  )
}

function ExistingSupplierRow({ row, saving, onChange, onDelete, vendorName, vendorId }: {
  row: Record<string, unknown>
  saving: boolean
  onChange: (patch: Record<string, unknown>) => void
  onDelete: () => void
  vendorName: (v: unknown) => string
  vendorId: (v: unknown) => number | null
}) {
  const [price, setPrice] = useState(Number(row.price) || 0)
  const [minQty, setMinQty] = useState(Number(row.min_qty) || 0)
  const [delay, setDelay] = useState(Number(row.delay) || 0)
  const [vendorEditing, setVendorEditing] = useState(false)

  useEffect(() => {
    setPrice(Number(row.price) || 0)
    setMinQty(Number(row.min_qty) || 0)
    setDelay(Number(row.delay) || 0)
  }, [row.id, row.price, row.min_qty, row.delay])

  const currentVendorId = vendorId(row.partner_id)
  const currentVendorName = vendorName(row.partner_id)

  return (
    <tr className="border-t border-border/30 hover:bg-muted/10">
      <td className="px-3 py-2">
        {vendorEditing ? (
          <VendorPicker
            value={currentVendorId}
            displayName={currentVendorName}
            onChange={(id) => { if (id) onChange({ partner_id: id }); setVendorEditing(false) }}
          />
        ) : (
          <button type="button" onClick={() => setVendorEditing(true)}
            className="text-left text-sm hover:underline">
            {currentVendorName || <span className="text-muted-foreground italic">(no vendor)</span>}
          </button>
        )}
      </td>
      <td className="px-3 py-2">
        <Input type="number" step="0.01" min="0" value={price}
          onChange={e => setPrice(parseFloat(e.target.value) || 0)}
          onBlur={() => { if (price !== Number(row.price)) onChange({ price }) }}
          className="h-8 text-sm text-right font-mono" />
      </td>
      <td className="px-3 py-2">
        <Input type="number" step="1" min="0" value={minQty}
          onChange={e => setMinQty(parseFloat(e.target.value) || 0)}
          onBlur={() => { if (minQty !== Number(row.min_qty)) onChange({ min_qty: minQty }) }}
          className="h-8 text-sm text-right font-mono" />
      </td>
      <td className="px-3 py-2">
        <Input type="number" step="1" min="0" value={delay}
          onChange={e => setDelay(parseInt(e.target.value) || 0)}
          onBlur={() => { if (delay !== Number(row.delay)) onChange({ delay }) }}
          className="h-8 text-sm text-right font-mono" />
      </td>
      <td className="px-3 py-2 text-center">
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-muted-foreground" />
        ) : (
          <button type="button" onClick={onDelete}
            className="text-muted-foreground/60 hover:text-destructive transition-colors" title="Remove vendor" aria-label="Remove vendor">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </td>
    </tr>
  )
}

// ─── Smart buttons bar (product stats) ──────────────────────────────────────

interface ProductStats {
  on_hand: number
  reserved: number
  forecasted: number
  sold: number
  purchased: number
  in_count: number
  out_count: number
  reordering_count: number
}

function SmartButton({ icon, label, value, unit, onClick, tone = 'default' }: {
  icon: React.ReactNode
  label: string
  value: string | number
  unit?: string
  onClick?: () => void
  tone?: 'default' | 'success' | 'warning' | 'info'
}) {
  const toneCls = {
    default: 'text-foreground',
    success: 'text-emerald-500 dark:text-emerald-400',
    warning: 'text-amber-500 dark:text-amber-400',
    info: 'text-blue-500 dark:text-blue-400',
  }[tone]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'flex items-center gap-2.5 rounded-xl border border-border/50 bg-background px-3 py-2 text-left transition-colors',
        onClick ? 'hover:bg-accent/60 cursor-pointer' : 'opacity-70 cursor-default',
      )}
    >
      <div className={cn('shrink-0', toneCls)}>{icon}</div>
      <div className="flex flex-col">
        <span className={cn('text-xs font-semibold leading-tight', toneCls)}>{label}</span>
        <span className="text-[11px] text-muted-foreground leading-tight">
          {value}{unit ? ` ${unit}` : ''}
        </span>
      </div>
    </button>
  )
}

// ─── Update Quantity dialog ─────────────────────────────────────────────────

interface QuantRow {
  id: number
  product_id: [number, string]
  location_id: [number, string]
  lot_id: [number, string] | false
  quantity: number
  reserved_quantity: number
  available_quantity: number
}

function UpdateQuantityDialog({ open, onClose, productTmplId }: { open: boolean; onClose: () => void; productTmplId: number }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [newProductId, setNewProductId] = useState<number | null>(null)
  const [newProductName, setNewProductName] = useState('')
  const [newLocationId, setNewLocationId] = useState<number | null>(null)
  const [newLocationName, setNewLocationName] = useState('')
  const [newQty, setNewQty] = useState('')

  const { data: quants = [], isLoading } = useQuery<QuantRow[]>({
    queryKey: ['product-quants', productTmplId],
    queryFn: async () => (await erpClient.raw.get(`/inventory/products/${productTmplId}/quants`)).data,
    enabled: open,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['product-quants', productTmplId] })

  async function apply(row: QuantRow) {
    const val = draft[row.id]
    if (val === undefined || val === '') return
    const n = parseFloat(val)
    if (isNaN(n)) return
    const productId = Array.isArray(row.product_id) ? row.product_id[0] : row.product_id
    const locationId = Array.isArray(row.location_id) ? row.location_id[0] : row.location_id
    setSaving(row.id)
    try {
      await erpClient.raw.post('/inventory/products/update-quantity', {
        product_id: productId,
        location_id: locationId,
        inventory_quantity: n,
        lot_id: Array.isArray(row.lot_id) ? row.lot_id[0] : null,
      })
      toast.success('Quantity updated')
      setDraft(prev => { const next = { ...prev }; delete next[row.id]; return next })
      refresh()
    } catch (e: unknown) {
      toast.error('Update failed', extractErrorMessage(e))
    } finally {
      setSaving(null)
    }
  }

  async function addNew() {
    if (!newProductId || !newLocationId || !newQty) return
    const n = parseFloat(newQty)
    if (isNaN(n)) return
    setAdding(true)
    try {
      await erpClient.raw.post('/inventory/products/update-quantity', {
        product_id: newProductId,
        location_id: newLocationId,
        inventory_quantity: n,
      })
      toast.success('Quantity set')
      setNewProductId(null); setNewProductName('')
      setNewLocationId(null); setNewLocationName('')
      setNewQty('')
      refresh()
    } catch (e: unknown) {
      toast.error('Add failed', extractErrorMessage(e))
    } finally {
      setAdding(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-500/10 text-blue-500">
              <Sliders className="h-4 w-4" />
            </span>
            Update Quantity
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">Adjust on-hand stock per variant & location.</p>
        </DialogHeader>

        {/* Existing quants — only this list scrolls; add-section stays fixed below so its dropdowns aren't clipped */}
        <div className="rounded-xl border border-border/60 flex flex-col min-h-0 max-h-[40vh] shrink-0">
          <div className="hidden sm:grid grid-cols-[1.3fr_1.2fr_0.7fr_0.9fr_auto] gap-2 bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground rounded-t-xl">
            <div>Variant</div>
            <div>Location</div>
            <div className="text-right">On Hand</div>
            <div className="text-right">Counted</div>
            <div className="w-14" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading && (
              <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            )}
            {!isLoading && quants.length === 0 && (
              <div className="px-3 py-10 text-center text-sm text-muted-foreground">
                No existing stock records — add one below.
              </div>
            )}
            {!isLoading && quants.map(q => {
              const dirty = draft[q.id] !== undefined && draft[q.id] !== ''
              return (
                <div key={q.id}
                  className="grid grid-cols-2 sm:grid-cols-[1.3fr_1.2fr_0.7fr_0.9fr_auto] gap-2 items-center border-t border-border/40 px-3 py-2.5 first:border-t-0 sm:first:border-t">
                  <div className="text-sm font-medium truncate col-span-2 sm:col-auto">
                    {Array.isArray(q.product_id) ? q.product_id[1] : '—'}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground truncate col-span-2 sm:col-auto -mt-1 sm:mt-0">
                    {Array.isArray(q.location_id) ? q.location_id[1] : '—'}
                  </div>
                  <div className="text-right font-mono text-sm tabular-nums">
                    <span className="sm:hidden text-[10px] uppercase text-muted-foreground mr-1">On hand</span>
                    {Number(q.quantity || 0).toFixed(2)}
                  </div>
                  <Input type="number" step="0.01" value={draft[q.id] ?? ''}
                    onChange={e => setDraft(prev => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder={Number(q.quantity || 0).toFixed(2)}
                    className="h-8 text-sm text-right font-mono tabular-nums" />
                  <div className="flex justify-end">
                    {saving === q.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Button type="button" size="sm" variant={dirty ? 'default' : 'ghost'}
                        className="h-7 px-3 text-xs rounded-lg"
                        onClick={() => apply(q)} disabled={!dirty}>
                        Apply
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Add new quant — outside scroll area so dropdowns aren't clipped */}
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-4 space-y-3 shrink-0">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-semibold m-0">Add Quantity at Location</Label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_110px_auto] gap-2 items-end">
            <ModelPicker model="product.product" domain={[['product_tmpl_id', '=', productTmplId]]}
              value={newProductId} displayName={newProductName}
              onChange={(id, name) => { setNewProductId(id); setNewProductName(name) }}
              placeholder="Pick variant..." />
            <ModelPicker model="stock.location" domain={[['usage', '=', 'internal']]}
              value={newLocationId} displayName={newLocationName}
              onChange={(id, name) => { setNewLocationId(id); setNewLocationName(name) }}
              placeholder="Pick location..." />
            <Input type="number" step="0.01" value={newQty} onChange={e => setNewQty(e.target.value)}
              placeholder="Qty" className="h-9 text-sm text-right font-mono tabular-nums" />
            <Button type="button" onClick={addNew} disabled={adding || !newProductId || !newLocationId || !newQty}
              className="rounded-xl gap-1.5">
              {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Add
            </Button>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-border/40 pt-4 -mx-6 px-6">
          <Button variant="ghost" onClick={onClose} className="rounded-xl">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Generic model picker — lightweight wrapper around name_search used in dialogs
function ModelPicker({ model, domain, value, displayName, onChange, placeholder }: {
  model: string
  domain?: unknown[]
  value: number | null
  displayName: string
  onChange: (id: number | null, name: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const { data: options } = useQuery({
    queryKey: ['model-picker', model, search, JSON.stringify(domain || [])],
    queryFn: async () => {
      const { data } = await erpClient.raw.post(`/model/${model}/name_search`, {
        name: search || '', domain: domain || [], limit: 10,
      })
      return normalizeM2OResponse(data)
    },
    enabled: open,
  })

  return (
    <div className="relative">
      <Input
        value={open ? search : displayName}
        onChange={e => { setSearch(e.target.value); if (!open) setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder={placeholder}
        className="h-9 text-sm"
      />
      {open && options && options.length > 0 && (
        <div className="absolute z-[60] top-full left-0 right-0 mt-1 rounded-lg border border-border/60 bg-popover shadow-xl max-h-48 overflow-y-auto">
          {options.map(o => (
            <button key={o.id} type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors first:rounded-t-lg last:rounded-b-lg"
              onMouseDown={() => { onChange(o.id, o.display_name); setOpen(false); setSearch('') }}>
              {o.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Replenish dialog ────────────────────────────────────────────────────────

function ReplenishDialog({ open, onClose, productTmplId, productName }: { open: boolean; onClose: () => void; productTmplId: number; productName: string }) {
  const [variantId, setVariantId] = useState<number | null>(null)
  const [variantName, setVariantName] = useState('')
  const [warehouseId, setWarehouseId] = useState<number | null>(null)
  const [warehouseName, setWarehouseName] = useState('')
  const [qty, setQty] = useState('1')
  const [minQty, setMinQty] = useState('')
  const [maxQty, setMaxQty] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Auto-pick first variant when dialog opens
  useEffect(() => {
    if (!open) return
    if (variantId) return
    erpClient.raw.post('/model/product.product/name_search', {
      name: '', domain: [['product_tmpl_id', '=', productTmplId]], limit: 1,
    }).then(({ data }) => {
      const opts = normalizeM2OResponse(data)
      if (opts[0]) { setVariantId(opts[0].id); setVariantName(opts[0].display_name) }
    }).catch(() => {})
  }, [open, productTmplId, variantId])

  async function submit() {
    if (!variantId) { toast.error('Pick a variant'); return }
    const q = parseFloat(qty)
    if (isNaN(q) || q <= 0) { toast.error('Enter a valid quantity'); return }
    setSubmitting(true)
    try {
      const body: Record<string, any> = { product_id: variantId, qty: q }
      if (warehouseId) body.warehouse_id = warehouseId
      if (minQty !== '') body.min_qty = parseFloat(minQty)
      if (maxQty !== '') body.max_qty = parseFloat(maxQty)
      const { data } = await erpClient.raw.post('/inventory/products/replenish', body)
      toast.success(data.created ? 'Reordering rule created' : 'Reordering rule updated', `${q} unit(s) queued for replenishment`)
      onClose()
    } catch (e: unknown) {
      toast.error('Replenish failed', extractErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5 text-emerald-400" /> Replenish — {productName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Variant</Label>
            <ModelPicker model="product.product" domain={[['product_tmpl_id', '=', productTmplId]]}
              value={variantId} displayName={variantName}
              onChange={(id, name) => { setVariantId(id); setVariantName(name) }}
              placeholder="Pick variant..." />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Warehouse (optional)</Label>
            <ModelPicker model="stock.warehouse"
              value={warehouseId} displayName={warehouseName}
              onChange={(id, name) => { setWarehouseId(id); setWarehouseName(name) }}
              placeholder="Default warehouse" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Qty to Order *</Label>
              <Input type="number" min="0" step="1" value={qty} onChange={e => setQty(e.target.value)}
                className="h-9 text-sm text-right font-mono" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Min Qty</Label>
              <Input type="number" min="0" step="1" value={minQty} onChange={e => setMinQty(e.target.value)}
                placeholder="0" className="h-9 text-sm text-right font-mono" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Max Qty</Label>
              <Input type="number" min="0" step="1" value={maxQty} onChange={e => setMaxQty(e.target.value)}
                placeholder="—" className="h-9 text-sm text-right font-mono" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            This creates or updates a reordering rule. Run the replenishment scheduler or open the rule to procure.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} className="rounded-xl" disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || !variantId || !qty} className="rounded-xl">
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            Replenish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Print Labels dialog ────────────────────────────────────────────────────

interface VariantLabelRow {
  id: number
  default_code: string | null
  barcode: string | null
  combo_label: string
}

function PrintLabelsDialog({ open, onClose, productTmplId, productName }: { open: boolean; onClose: () => void; productTmplId: number; productName: string }) {
  const [copies, setCopies] = useState<Record<number, number>>({})
  const [generating, setGenerating] = useState(false)

  const { data: variants = [] } = useQuery<VariantLabelRow[]>({
    queryKey: ['product-variants', productTmplId],
    queryFn: async () => (await erpClient.raw.get(`/website/products/${productTmplId}/variants`)).data,
    enabled: open,
  })

  function generatePDF() {
    setGenerating(true)
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      // Layout: 3 columns x 10 rows = 30 labels per page
      const pageWidth = 210
      const pageHeight = 297
      const cols = 3
      const rows = 10
      const labelW = pageWidth / cols
      const labelH = pageHeight / rows

      let idx = 0
      let page = 1

      const labels: { code: string; name: string; combo: string }[] = []
      for (const v of variants) {
        const n = copies[v.id] ?? 0
        const code = v.barcode || v.default_code || `P${productTmplId}V${v.id}`
        for (let i = 0; i < n; i++) {
          labels.push({ code, name: productName, combo: v.combo_label || '' })
        }
      }

      if (labels.length === 0) {
        toast.error('No labels', 'Set copies > 0 for at least one variant')
        return
      }

      for (const label of labels) {
        const col = idx % cols
        const row = Math.floor(idx / cols) % rows
        if (idx > 0 && col === 0 && row === 0) { doc.addPage(); page++ }

        const x = col * labelW
        const y = row * labelH

        // Generate barcode as dataURL
        const canvas = document.createElement('canvas')
        try {
          JsBarcode(canvas, label.code, { format: 'CODE128', width: 2, height: 40, displayValue: false, margin: 0 })
          const dataUrl = canvas.toDataURL('image/png')
          // Layout: name top, barcode center, code bottom
          doc.setFontSize(8)
          doc.text(label.name.slice(0, 30), x + labelW / 2, y + 5, { align: 'center' })
          if (label.combo) {
            doc.setFontSize(6)
            doc.text(label.combo.slice(0, 40), x + labelW / 2, y + 9, { align: 'center' })
          }
          doc.addImage(dataUrl, 'PNG', x + 4, y + 11, labelW - 8, labelH - 20)
          doc.setFontSize(7)
          doc.text(label.code, x + labelW / 2, y + labelH - 3, { align: 'center' })
        } catch (err) {
          doc.setFontSize(8)
          doc.text(`Invalid code: ${label.code}`, x + 2, y + labelH / 2)
        }
        idx++
      }

      const filename = `labels_${productName.replace(/[^a-z0-9]/gi, '_').slice(0, 30)}.pdf`
      doc.save(filename)
      toast.success('Labels generated', `${labels.length} label(s) across ${page} page(s)`)
      onClose()
    } catch (e: unknown) {
      toast.error('PDF generation failed', extractErrorMessage(e))
    } finally {
      setGenerating(false)
    }
  }

  const totalCopies = Object.values(copies).reduce((a, b) => a + (b || 0), 0)

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Printer className="h-5 w-5 text-violet-400" /> Print Labels — {productName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-80 overflow-y-auto">
          <p className="text-xs text-muted-foreground">3 × 10 grid on A4 per page. Uses barcode or internal reference; falls back to a synthetic code if neither is set.</p>
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/30">
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="text-left px-3 py-2">Variant</th>
                  <th className="text-left px-3 py-2 w-[28%]">Code</th>
                  <th className="text-right px-3 py-2 w-[22%]">Copies</th>
                </tr>
              </thead>
              <tbody>
                {variants.length === 0 && <tr><td colSpan={3} className="px-3 py-6 text-center text-sm text-muted-foreground">No variants</td></tr>}
                {variants.map(v => (
                  <tr key={v.id} className="border-t border-border/30">
                    <td className="px-3 py-2 text-sm">{v.combo_label || <span className="text-muted-foreground italic">Default</span>}</td>
                    <td className="px-3 py-2 text-sm font-mono text-muted-foreground">{v.barcode || v.default_code || `P${productTmplId}V${v.id}`}</td>
                    <td className="px-3 py-2">
                      <Input type="number" min="0" step="1" value={copies[v.id] ?? 0}
                        onChange={e => setCopies(prev => ({ ...prev, [v.id]: parseInt(e.target.value) || 0 }))}
                        className="h-8 text-sm text-right font-mono" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Total labels: <strong className="text-foreground">{totalCopies}</strong></span>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs rounded-lg"
                onClick={() => setCopies(Object.fromEntries(variants.map(v => [v.id, 1])))}>
                1 per variant
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs rounded-lg"
                onClick={() => setCopies({})}>Clear</Button>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} className="rounded-xl" disabled={generating}>Cancel</Button>
          <Button onClick={generatePDF} disabled={generating || totalCopies === 0} className="rounded-xl">
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Printer className="h-3.5 w-3.5 mr-1.5" />}
            Generate PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SmartButtonsBar({ productTmplId, productName, websitePublished }: {
  productTmplId: number | null
  productName: string
  websitePublished: boolean
}) {
  const navigate = useNavigate()
  const { data: stats } = useQuery<ProductStats>({
    queryKey: ['product-stats', productTmplId],
    queryFn: async () => {
      const { data } = await erpClient.raw.get(`/website/products/${productTmplId}/stats`)
      return data
    },
    enabled: !!productTmplId,
  })

  const qs = productTmplId
    ? new URLSearchParams({ product_tmpl_id: String(productTmplId), product_name: productName })
    : null
  // When the product isn't saved yet, buttons render but don't navigate.
  const go = (path: string) => {
    if (!productTmplId || !qs) return
    navigate(`${path}?${qs.toString()}`)
  }
  const makeOnClick = (path: string) => (productTmplId ? () => go(path) : undefined)
  const fmt = (n: number) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })

  return (
    <div className="flex gap-2 flex-wrap">
      {!productTmplId && (
        <div className="w-full text-xs text-muted-foreground italic mb-1">
          Save the product first to see live stats — the counters below become clickable afterwards.
        </div>
      )}
      <SmartButton
        icon={<Boxes className="h-4 w-4" />}
        label="On Hand"
        value={fmt(stats?.on_hand ?? 0)}
        unit="units"
        onClick={makeOnClick('/admin/inventory/stock')}
      />
      <SmartButton
        icon={<BarChart3 className="h-4 w-4" />}
        label="Forecasted"
        value={fmt(stats?.forecasted ?? 0)}
        unit="units"
        tone={(stats?.forecasted ?? 0) < 0 ? 'warning' : 'default'}
        onClick={makeOnClick('/admin/inventory/stock')}
      />
      <SmartButton
        icon={<ShoppingCart className="h-4 w-4" />}
        label="Sold"
        value={fmt(stats?.sold ?? 0)}
        unit="units"
        tone="info"
        onClick={makeOnClick('/admin/sales/orders')}
      />
      <SmartButton
        icon={<CreditCard className="h-4 w-4" />}
        label="Purchased"
        value={fmt(stats?.purchased ?? 0)}
        unit="units"
        tone="info"
        onClick={makeOnClick('/admin/purchase/orders')}
      />
      <SmartButton
        icon={<ArrowDownToLine className="h-4 w-4" />}
        label="In"
        value={stats?.in_count ?? 0}
        unit="transfers"
        tone="success"
        onClick={makeOnClick('/admin/inventory/transfers')}
      />
      <SmartButton
        icon={<ArrowUpFromLine className="h-4 w-4" />}
        label="Out"
        value={stats?.out_count ?? 0}
        unit="transfers"
        tone="warning"
        onClick={makeOnClick('/admin/inventory/transfers')}
      />
      <SmartButton
        icon={<RefreshCw className="h-4 w-4" />}
        label="Reordering"
        value={stats?.reordering_count ?? 0}
        unit="rules"
        onClick={makeOnClick('/admin/inventory/replenishment')}
      />
      {productTmplId && websitePublished && (
        <SmartButton
          icon={<ExternalLink className="h-4 w-4" />}
          label="Website"
          value="View"
          onClick={() => window.open(`/shop/${productTmplId}`, '_blank')}
        />
      )}
    </div>
  )
}

// ─── Attributes & Variants section ──────────────────────────────────────────

interface AttributeValueLite { id: number; name: string; html_color?: string | null }
interface AttributeLite {
  id: number
  name: string
  create_variant: string
  display_type: string
  values: AttributeValueLite[]
}
interface AttributeLine {
  id: number
  attribute_id: number
  attribute_name: string
  value_ids: AttributeValueLite[]
  sequence: number
}
// Used when product isn't saved yet — buffered in parent state, flushed after save.
export interface PendingAttributeLine {
  tempId: string
  attribute_id: number
  attribute_name: string
  value_ids: AttributeValueLite[]
}
let _pendingAttrCounter = 1
const _nextPendingAttrId = () => `tmp-${_pendingAttrCounter++}`
interface VariantPtav { ptav_id: number; attribute: string; value: string; price_extra: number }
interface VariantRow {
  id: number
  default_code?: string | null
  barcode?: string | null
  active: boolean
  combo_label: string
  price_extra: number
  ptav_entries: VariantPtav[]
}

function AttributesSection({ productTmplId, pendingLines, setPendingLines }: {
  productTmplId: number | null
  pendingLines: PendingAttributeLine[]
  setPendingLines: (next: PendingAttributeLine[]) => void
}) {
  const queryClient = useQueryClient()
  const [regenerating, setRegenerating] = useState(false)
  const [showWarning, setShowWarning] = useState(true)
  const pendingMode = !productTmplId

  const { data: attributes = [] } = useQuery<AttributeLite[]>({
    queryKey: ['product-attributes'],
    queryFn: async () => {
      const { data } = await erpClient.raw.get('/website/attributes')
      return data
    },
  })

  const { data: serverLines = [], isLoading } = useQuery<AttributeLine[]>({
    queryKey: ['product-attribute-lines', productTmplId],
    queryFn: async () => {
      if (!productTmplId) return []
      const { data } = await erpClient.raw.get(`/website/products/${productTmplId}/attribute-lines`)
      return data
    },
    enabled: !!productTmplId,
  })

  const { data: variants = [] } = useQuery<VariantRow[]>({
    queryKey: ['product-variants', productTmplId],
    queryFn: async () => {
      if (!productTmplId) return []
      const { data } = await erpClient.raw.get(`/website/products/${productTmplId}/variants`)
      return data
    },
    enabled: !!productTmplId,
  })

  // Unified line shape for rendering — union of server + pending
  type DisplayLine = { key: string; attribute_id: number; attribute_name: string; value_ids: AttributeValueLite[] }
  const lines: DisplayLine[] = pendingMode
    ? pendingLines.map(p => ({ key: p.tempId, attribute_id: p.attribute_id, attribute_name: p.attribute_name, value_ids: p.value_ids }))
    : serverLines.map(s => ({ key: String(s.id), attribute_id: s.attribute_id, attribute_name: s.attribute_name, value_ids: s.value_ids }))

  const refreshLines = () => queryClient.invalidateQueries({ queryKey: ['product-attribute-lines', productTmplId] })
  const refreshVariants = () => queryClient.invalidateQueries({ queryKey: ['product-variants', productTmplId] })
  const refreshAttrs = () => queryClient.invalidateQueries({ queryKey: ['product-attributes'] })

  async function addLine(attributeId: number) {
    if (pendingMode) {
      const attr = attributes.find(a => a.id === attributeId)
      setPendingLines([...pendingLines, {
        tempId: _nextPendingAttrId(),
        attribute_id: attributeId,
        attribute_name: attr?.name || '',
        value_ids: [],
      }])
      return
    }
    try {
      await erpClient.raw.post(`/website/products/${productTmplId}/attribute-lines`, {
        attribute_id: attributeId,
        value_ids: [],
      })
      refreshLines()
    } catch (e: unknown) {
      toast.error('Failed to add attribute', extractErrorMessage(e))
    }
  }

  async function toggleValue(line: DisplayLine, value: AttributeValueLite) {
    const current = new Set(line.value_ids.map(v => v.id))
    const nextIds = new Set(current)
    if (current.has(value.id)) nextIds.delete(value.id)
    else nextIds.add(value.id)

    if (pendingMode) {
      // Find attribute + all its values so we can populate full objects
      const attr = attributes.find(a => a.id === line.attribute_id)
      const nextValueObjs = (attr?.values || []).filter(v => nextIds.has(v.id))
      setPendingLines(pendingLines.map(p => p.tempId === line.key
        ? { ...p, value_ids: nextValueObjs }
        : p))
      return
    }
    try {
      await erpClient.raw.put(`/website/products/attribute-lines/${line.key}`, {
        value_ids: Array.from(nextIds),
      })
      refreshLines()
    } catch (e: unknown) {
      toast.error('Failed to update values', extractErrorMessage(e))
    }
  }

  async function removeLine(line: DisplayLine) {
    if (!confirm('Remove this attribute? Variants will need to be regenerated.')) return
    if (pendingMode) {
      setPendingLines(pendingLines.filter(p => p.tempId !== line.key))
      return
    }
    try {
      await erpClient.raw.delete(`/website/products/attribute-lines/${line.key}`)
      refreshLines()
    } catch (e: unknown) {
      toast.error('Failed to remove attribute', extractErrorMessage(e))
    }
  }

  async function regenerate() {
    if (!productTmplId) return
    if (!confirm('This will delete and recreate all variants for this product. Continue?')) return
    setRegenerating(true)
    try {
      const { data } = await erpClient.raw.post(`/website/products/${productTmplId}/regenerate-variants`)
      toast.success('Variants regenerated', `${data.variants_created} variant(s) created`)
      refreshVariants()
    } catch (e: unknown) {
      toast.error('Regeneration failed', extractErrorMessage(e))
    } finally {
      setRegenerating(false)
    }
  }

  const usedAttributeIds = new Set(lines.map(l => l.attribute_id))
  const availableAttributes = attributes.filter(a => !usedAttributeIds.has(a.id))

  return (
    <div className="space-y-4">
      {showWarning && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 p-3 text-xs flex items-start gap-2">
          <span className="font-semibold">Warning:</span>
          <span className="flex-1">Adding, changing, or deleting attributes will require regenerating variants, which deletes existing variants and their customizations.</span>
          <button type="button" onClick={() => setShowWarning(false)} className="shrink-0 hover:text-amber-900 dark:hover:text-amber-200">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Attribute lines table */}
      <div className="rounded-xl border border-border/50 overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/30">
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-3 py-2 w-[25%]">Attribute</th>
              <th className="text-left px-3 py-2">Values</th>
              <th className="w-[6%]"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={3} className="px-3 py-6 text-center text-sm text-muted-foreground"><LoadingState label="Loading attributes..." /></td></tr>
            )}
            {!isLoading && lines.length === 0 && (
              <tr><td colSpan={3} className="px-3 py-6 text-center text-sm text-muted-foreground">No attributes yet</td></tr>
            )}
            {lines.map(line => {
              const attr = attributes.find(a => a.id === line.attribute_id)
              const selectedIds = new Set(line.value_ids.map(v => v.id))
              return (
                <tr key={line.key} className="border-t border-border/30">
                  <td className="px-3 py-2 text-sm font-medium align-top">{line.attribute_name}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      {(attr?.values || []).map(v => {
                        const selected = selectedIds.has(v.id)
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => toggleValue(line, v)}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors',
                              selected
                                ? 'border-primary bg-primary/10 text-primary font-medium'
                                : 'border-border/50 text-muted-foreground hover:bg-accent'
                            )}
                          >
                            {v.html_color && (
                              <span className="inline-block h-3 w-3 rounded-full border border-border/40" style={{ backgroundColor: v.html_color }} />
                            )}
                            {v.name}
                          </button>
                        )
                      })}
                      {(!attr || attr.values.length === 0) && (
                        <span className="text-xs text-muted-foreground italic">No values defined for this attribute</span>
                      )}
                      <InlineAddValue attributeId={line.attribute_id} onCreated={() => refreshAttrs()} />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center align-top">
                    <button type="button" onClick={() => removeLine(line)}
                      className="text-muted-foreground/60 hover:text-destructive transition-colors" title="Remove attribute">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Add attribute picker */}
      <div className="flex items-center gap-2 flex-wrap">
        {availableAttributes.length > 0 ? (
          <>
            <span className="text-xs text-muted-foreground">Add attribute:</span>
            {availableAttributes.map(a => (
              <button key={a.id} type="button" onClick={() => addLine(a.id)}
                className="rounded-full border border-border/50 px-3 py-1 text-xs hover:bg-accent transition-colors">
                <Plus className="h-3 w-3 inline mr-1" />{a.name}
              </button>
            ))}
          </>
        ) : attributes.length === 0 ? (
          <span className="text-xs text-muted-foreground">No attributes defined.</span>
        ) : (
          <span className="text-xs text-muted-foreground">All attributes added.</span>
        )}
        <InlineAddAttribute onCreated={() => refreshAttrs()} />
      </div>

      {/* Regenerate variants */}
      <div className="border-t border-border/40 pt-4 flex items-center justify-between">
        <div>
          <Label className="text-sm font-semibold">Variants</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            {pendingMode
              ? 'Variants will be generated automatically when you save the product.'
              : `${variants.length} variant(s) exist`}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="rounded-xl gap-1.5"
          onClick={regenerate} disabled={regenerating || pendingMode}
          title={pendingMode ? 'Save the product first' : ''}>
          {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Regenerate
        </Button>
      </div>

      {!pendingMode && variants.length > 0 && (
        <>
          {/* Explainer */}
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 text-blue-700 dark:text-blue-400 p-3 text-xs">
            <strong>How pricing works:</strong> every variant starts at the base product price.
            Add a <strong>+ extra</strong> to a specific attribute value (e.g. "XL" costs +$5) and it gets added to every variant that uses that value.
          </div>

          {/* Price-extra editor by ptav */}
          <PriceExtraEditor variants={variants} onChanged={refreshVariants} />

          {/* Generated variants list */}
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/30">
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="text-left px-3 py-2">Combination</th>
                  <th className="text-right px-3 py-2 w-[15%]">Extra Price</th>
                  <th className="text-left px-3 py-2 w-[18%]">Internal Ref</th>
                  <th className="text-left px-3 py-2 w-[18%]">Barcode</th>
                </tr>
              </thead>
              <tbody>
                {variants.map(v => (
                  <tr key={v.id} className="border-t border-border/30">
                    <td className="px-3 py-2 text-sm">{v.combo_label || <span className="text-muted-foreground italic">(no combination)</span>}</td>
                    <td className="px-3 py-2 text-right font-mono text-sm">
                      {v.price_extra > 0
                        ? <span className="text-emerald-600 dark:text-emerald-400">+${v.price_extra.toFixed(2)}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2 text-sm font-mono text-muted-foreground">{v.default_code || '—'}</td>
                    <td className="px-3 py-2 text-sm font-mono text-muted-foreground">{v.barcode || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Per-value extra-price editor ───────────────────────────────────────────
// Variants can't have their own price in this data model; price extras live
// on attribute values (e.g. "Size: L = +$5"). This table surfaces those
// ptavs uniquely, so the user sees one row per distinct value.

function PriceExtraEditor({ variants, onChanged }: { variants: VariantRow[]; onChanged: () => void }) {
  // Flatten unique ptavs across all variants
  const ptavMap = new Map<number, VariantPtav>()
  for (const v of variants) {
    for (const e of v.ptav_entries || []) {
      if (!ptavMap.has(e.ptav_id)) ptavMap.set(e.ptav_id, e)
    }
  }
  const ptavs = Array.from(ptavMap.values()).sort((a, b) =>
    a.attribute.localeCompare(b.attribute) || a.value.localeCompare(b.value)
  )

  const [draft, setDraft] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState<number | null>(null)

  async function save(ptav: VariantPtav) {
    const raw = draft[ptav.ptav_id]
    if (raw === undefined) return
    const n = parseFloat(raw)
    if (isNaN(n) || n === ptav.price_extra) return
    setSaving(ptav.ptav_id)
    try {
      await erpClient.raw.put(`/website/products/attribute-values/${ptav.ptav_id}/price-extra`, { price_extra: n })
      setDraft(prev => { const next = { ...prev }; delete next[ptav.ptav_id]; return next })
      onChanged()
    } catch (e: unknown) {
      toast.error('Failed to update price', extractErrorMessage(e))
    } finally {
      setSaving(null)
    }
  }

  if (ptavs.length === 0) return null

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <div className="bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Extra price by attribute value
      </div>
      <table className="w-full">
        <thead className="bg-muted/10">
          <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <th className="text-left px-3 py-2 w-[30%]">Attribute</th>
            <th className="text-left px-3 py-2">Value</th>
            <th className="text-right px-3 py-2 w-[28%]">+ Extra Price</th>
          </tr>
        </thead>
        <tbody>
          {ptavs.map(p => {
            const displayed = draft[p.ptav_id] ?? String(p.price_extra)
            return (
              <tr key={p.ptav_id} className="border-t border-border/30">
                <td className="px-3 py-2 text-sm font-medium">{p.attribute}</td>
                <td className="px-3 py-2 text-sm">{p.value}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-xs text-muted-foreground">$</span>
                    <Input type="number" step="0.01" value={displayed}
                      onChange={e => setDraft(prev => ({ ...prev, [p.ptav_id]: e.target.value }))}
                      onBlur={() => save(p)}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      className="h-8 w-24 text-right font-mono text-sm" />
                    {saving === p.ptav_id && <Loader2 className="h-3 w-3 animate-spin" />}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function InlineAddValue({ attributeId, onCreated }: { attributeId: number; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function create() {
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      await erpClient.raw.post('/website/attributes/values', { attribute_id: attributeId, name: trimmed })
      setName('')
      setOpen(false)
      onCreated()
    } catch (e: unknown) {
      toast.error('Failed to add value', extractErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-border/50 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors">
        <Plus className="h-3 w-3" /> Add value
      </button>
    )
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Input autoFocus value={name} onChange={e => setName(e.target.value)}
        disabled={saving}
        onKeyDown={e => { if (e.key === 'Enter' && !saving) create(); if (e.key === 'Escape') { setOpen(false); setName('') } }}
        placeholder="New value..." aria-label="New attribute value" className="h-6 text-xs w-32 rounded-full" />
      <Button type="button" size="sm" className="h-6 px-2 rounded-full text-xs" onClick={create} disabled={saving}>
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
      </Button>
    </span>
  )
}

function InlineAddAttribute({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function create() {
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      await erpClient.raw.post('/website/attributes', { name: trimmed })
      setName('')
      setOpen(false)
      onCreated()
    } catch (e: unknown) {
      toast.error('Failed to create attribute', extractErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="rounded-full border border-dashed border-border/50 px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors">
        <Plus className="h-3 w-3 inline mr-1" /> New attribute
      </button>
    )
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Input autoFocus value={name} onChange={e => setName(e.target.value)}
        disabled={saving}
        onKeyDown={e => { if (e.key === 'Enter' && !saving) create(); if (e.key === 'Escape') { setOpen(false); setName('') } }}
        placeholder="Attribute name..." aria-label="New attribute name" className="h-6 text-xs w-40 rounded-full" />
      <Button type="button" size="sm" className="h-6 px-2 rounded-full text-xs" onClick={create} disabled={saving}>
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Create'}
      </Button>
    </span>
  )
}

// ─── eCommerce section (tags + optional products) ───────────────────────────

interface TagLite { id: number; name: string; color?: string | null }
interface OptionalProductLite { id: number; name: string; list_price: number }

function EcommerceSection({ productTmplId }: { productTmplId: number | null }) {
  if (!productTmplId) {
    return <div className="text-sm text-muted-foreground py-4 text-center">Save the product first to manage eCommerce settings.</div>
  }
  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-5">
          <LinkedProductsPicker productTmplId={productTmplId} kind="optional" label="Optional Products" hint="Recommended when 'Adding to Cart' or quotation" />
          <LinkedProductsPicker productTmplId={productTmplId} kind="accessory" label="Accessory Products" hint="Suggested accessories in the eCommerce cart" />
          <LinkedProductsPicker productTmplId={productTmplId} kind="alternative" label="Alternative Products" hint="Displayed at the bottom of product pages" />
        </div>
        <div className="space-y-5">
          <TagsPicker productTmplId={productTmplId} />
          <PublicCategoriesPicker productTmplId={productTmplId} />
          <OutOfStockSection productTmplId={productTmplId} />
        </div>
      </div>
      <div className="pt-4 border-t border-border/40">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">eCommerce Media</div>
        <MediaGallery productTmplId={productTmplId} />
      </div>
    </div>
  )
}

function TagsPicker({ productTmplId }: { productTmplId: number }) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  const { data: allTags = [] } = useQuery<TagLite[]>({
    queryKey: ['product-tags-all'],
    queryFn: async () => (await erpClient.raw.get('/website/tags')).data,
  })

  const { data: productTags = [] } = useQuery<TagLite[]>({
    queryKey: ['product-tags', productTmplId],
    queryFn: async () => (await erpClient.raw.get(`/website/products/${productTmplId}/tags`)).data,
  })

  async function update(next: TagLite[]) {
    try {
      await erpClient.raw.put(`/website/products/${productTmplId}/tags`, { tag_ids: next.map(t => t.id) })
      queryClient.invalidateQueries({ queryKey: ['product-tags', productTmplId] })
    } catch (e: unknown) {
      toast.error('Failed to update tags', extractErrorMessage(e))
    }
  }

  async function addTag(tag: TagLite) {
    if (productTags.some(t => t.id === tag.id)) return
    await update([...productTags, tag])
    setSearch('')
    setOpen(false)
  }

  async function removeTag(tagId: number) {
    await update(productTags.filter(t => t.id !== tagId))
  }

  async function createTag() {
    const name = search.trim()
    if (!name) return
    setCreating(true)
    try {
      const { data: newTag } = await erpClient.raw.post('/website/tags', { name })
      queryClient.invalidateQueries({ queryKey: ['product-tags-all'] })
      await update([...productTags, { id: newTag.id, name: newTag.name, color: newTag.color }])
      setSearch('')
      setOpen(false)
    } catch (e: unknown) {
      toast.error('Failed to create tag', extractErrorMessage(e))
    } finally {
      setCreating(false)
    }
  }

  const currentIds = new Set(productTags.map(t => t.id))
  const trimmed = search.trim().toLowerCase()
  const suggestions = allTags.filter(t =>
    !currentIds.has(t.id) && (!trimmed || t.name.toLowerCase().includes(trimmed))
  )
  const hasExact = allTags.some(t => t.name.toLowerCase() === trimmed)
  const canCreate = trimmed.length > 0 && !hasExact && !creating

  return (
    <div className="space-y-2">
      <Label>Tags</Label>
      <div className="rounded-lg border border-input bg-background p-2 flex flex-wrap gap-1.5 items-center">
        {productTags.map(t => (
          <span key={t.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs">
            {t.name}
            <button type="button" onClick={() => removeTag(t.id)} className="hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <div className="relative flex-1 min-w-[150px]">
          <Input
            value={search}
            onChange={e => { setSearch(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder={productTags.length === 0 ? 'Add a tag...' : ''}
            className="h-6 border-0 shadow-none focus-visible:ring-0 p-0 text-sm"
          />
          {open && (suggestions.length > 0 || canCreate) && (
            <div className="absolute z-50 top-full mt-1 left-0 w-full min-w-[200px] rounded-lg border border-border/60 bg-popover shadow-lg max-h-48 overflow-y-auto">
              {suggestions.map(t => (
                <button key={t.id} type="button"
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors first:rounded-t-lg"
                  onMouseDown={() => addTag(t)}>
                  {t.name}
                </button>
              ))}
              {canCreate && (
                <button type="button"
                  className="w-full px-3 py-1.5 text-left text-sm border-t border-border/40 bg-accent/30 hover:bg-accent transition-colors last:rounded-b-lg font-medium"
                  onMouseDown={e => { e.preventDefault(); createTag() }}>
                  + Create "{search.trim()}"
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

type LinkedKind = 'optional' | 'accessory' | 'alternative'
const LINKED_ENDPOINT: Record<LinkedKind, string> = {
  optional: 'optional-products',
  accessory: 'accessory-products',
  alternative: 'alternative-products',
}

function LinkedProductsPicker({ productTmplId, kind, label, hint }: { productTmplId: number; kind: LinkedKind; label: string; hint?: string }) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const endpoint = LINKED_ENDPOINT[kind]

  const { data: current = [] } = useQuery<OptionalProductLite[]>({
    queryKey: [`product-${kind}`, productTmplId],
    queryFn: async () => (await erpClient.raw.get(`/website/products/${productTmplId}/${endpoint}`)).data,
  })

  const { data: suggestions = [] } = useQuery<{ id: number; display_name: string }[]>({
    queryKey: [`product-search-${kind}`, search],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/product.template/name_search', { name: search || '', limit: 10 })
      return normalizeM2OResponse(data)
    },
    enabled: open,
  })

  async function update(nextIds: number[]) {
    try {
      await erpClient.raw.put(`/website/products/${productTmplId}/${endpoint}`, { product_ids: nextIds })
      queryClient.invalidateQueries({ queryKey: [`product-${kind}`, productTmplId] })
    } catch (e: unknown) {
      toast.error(`Failed to update ${label.toLowerCase()}`, extractErrorMessage(e))
    }
  }

  async function add(id: number) {
    if (id === productTmplId || current.some(p => p.id === id)) return
    await update([...current.map(p => p.id), id])
    setSearch('')
    setOpen(false)
  }

  async function remove(id: number) {
    await update(current.filter(p => p.id !== id).map(p => p.id))
  }

  const currentIds = new Set(current.map(p => p.id))
  const filtered = suggestions.filter(s => s.id !== productTmplId && !currentIds.has(s.id))

  return (
    <div className="space-y-2">
      <Label>{label}{hint && <span className="text-xs text-muted-foreground font-normal"> — {hint}</span>}</Label>
      <div className="rounded-lg border border-input bg-background divide-y divide-border/40">
        {current.length === 0 && (
          <div className="px-3 py-2 text-xs text-muted-foreground italic">None linked</div>
        )}
        {current.map(p => (
          <div key={p.id} className="flex items-center justify-between px-3 py-1.5">
            <span className="text-sm">{p.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">${p.list_price.toFixed(2)}</span>
              <button type="button" onClick={() => remove(p.id)}
                className="text-muted-foreground/60 hover:text-destructive transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        <div className="relative p-2">
          <Input
            value={search}
            onChange={e => { setSearch(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder="Search a product to add..."
            className="h-8 text-sm"
          />
          {open && filtered.length > 0 && (
            <div className="absolute z-50 top-full mt-1 left-2 right-2 rounded-lg border border-border/60 bg-popover shadow-lg max-h-48 overflow-y-auto">
              {filtered.map(s => (
                <button key={s.id} type="button"
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors first:rounded-t-lg last:rounded-b-lg"
                  onMouseDown={() => add(s.id)}>
                  {s.display_name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Public categories picker ---

interface PublicCategoryLite { id: number; name: string; parent_id?: number | null; display_name?: string }

function PublicCategoriesPicker({ productTmplId }: { productTmplId: number }) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  const { data: all = [] } = useQuery<PublicCategoryLite[]>({
    queryKey: ['public-categories'],
    queryFn: async () => (await erpClient.raw.get('/website/public-categories')).data,
  })

  const { data: current = [] } = useQuery<PublicCategoryLite[]>({
    queryKey: ['product-public-categories', productTmplId],
    queryFn: async () => (await erpClient.raw.get(`/website/products/${productTmplId}/public-categories`)).data,
  })

  async function update(next: PublicCategoryLite[]) {
    try {
      await erpClient.raw.put(`/website/products/${productTmplId}/public-categories`, { category_ids: next.map(c => c.id) })
      queryClient.invalidateQueries({ queryKey: ['product-public-categories', productTmplId] })
    } catch (e: unknown) {
      toast.error('Failed to update categories', extractErrorMessage(e))
    }
  }

  async function addCat(c: PublicCategoryLite) {
    if (current.some(x => x.id === c.id)) return
    await update([...current, c])
    setSearch('')
    setOpen(false)
  }

  async function removeCat(id: number) {
    await update(current.filter(c => c.id !== id))
  }

  async function createCat() {
    const name = search.trim()
    if (!name) return
    setCreating(true)
    try {
      const { data: newCat } = await erpClient.raw.post('/website/public-categories', { name })
      queryClient.invalidateQueries({ queryKey: ['public-categories'] })
      await update([...current, { id: newCat.id, name: newCat.name, display_name: newCat.display_name }])
      setSearch('')
      setOpen(false)
    } catch (e: unknown) {
      toast.error('Failed to create category', extractErrorMessage(e))
    } finally {
      setCreating(false)
    }
  }

  const currentIds = new Set(current.map(c => c.id))
  const trimmed = search.trim().toLowerCase()
  const suggestions = all.filter(c =>
    !currentIds.has(c.id) && (!trimmed || (c.display_name || c.name).toLowerCase().includes(trimmed))
  )
  const hasExact = all.some(c => (c.display_name || c.name).toLowerCase() === trimmed)
  const canCreate = trimmed.length > 0 && !hasExact && !creating

  return (
    <div className="space-y-2">
      <Label>Categories <span className="text-xs text-muted-foreground font-normal">— storefront hierarchy</span></Label>
      <div className="rounded-lg border border-input bg-background p-2 flex flex-wrap gap-1.5 items-center">
        {current.map(c => (
          <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs">
            {c.display_name || c.name}
            <button type="button" onClick={() => removeCat(c.id)} className="hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <div className="relative flex-1 min-w-[150px]">
          <Input
            value={search}
            onChange={e => { setSearch(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder={current.length === 0 ? 'Add a category...' : ''}
            className="h-6 border-0 shadow-none focus-visible:ring-0 p-0 text-sm"
          />
          {open && (suggestions.length > 0 || canCreate) && (
            <div className="absolute z-50 top-full mt-1 left-0 w-full min-w-[220px] rounded-lg border border-border/60 bg-popover shadow-lg max-h-48 overflow-y-auto">
              {suggestions.map(c => (
                <button key={c.id} type="button"
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors first:rounded-t-lg"
                  onMouseDown={() => addCat(c)}>
                  {c.display_name || c.name}
                </button>
              ))}
              {canCreate && (
                <button type="button"
                  className="w-full px-3 py-1.5 text-left text-sm border-t border-border/40 bg-accent/30 hover:bg-accent transition-colors last:rounded-b-lg font-medium"
                  onMouseDown={e => { e.preventDefault(); createCat() }}>
                  + Create "{search.trim()}"
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Out-of-stock + availability settings ---

interface StockSettings {
  allow_out_of_stock_order: boolean
  out_of_stock_message: string
  available_threshold: number | null
  show_availability: boolean
}

function OutOfStockSection({ productTmplId }: { productTmplId: number }) {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery<StockSettings>({
    queryKey: ['product-stock-settings', productTmplId],
    queryFn: async () => (await erpClient.raw.get(`/website/products/${productTmplId}/stock-settings`)).data,
  })

  async function update(patch: Partial<StockSettings>) {
    try {
      await erpClient.raw.put(`/website/products/${productTmplId}/stock-settings`, patch)
      queryClient.invalidateQueries({ queryKey: ['product-stock-settings', productTmplId] })
    } catch (e: unknown) {
      toast.error('Failed to update stock settings', extractErrorMessage(e))
    }
  }

  if (isLoading || !data) return <LoadingState label="Loading stock settings..." className="py-6" />

  return (
    <div className="space-y-3">
      <Label>Out-of-Stock Behavior</Label>
      <CheckField label="Continue Selling when out of stock"
        checked={data.allow_out_of_stock_order}
        onChange={v => update({ allow_out_of_stock_order: v })} />
      <CheckField label="Show Available Quantity"
        checked={data.show_availability}
        onChange={v => update({ show_availability: v })} />
      {data.show_availability && (
        <div className="space-y-1 pl-6">
          <Label htmlFor="avail-threshold" className="text-xs">Availability Threshold</Label>
          <Input id="avail-threshold" type="number" min="0" step="1"
            defaultValue={data.available_threshold ?? ''}
            onBlur={e => {
              const v = e.target.value === '' ? null : parseFloat(e.target.value)
              if (v !== (data.available_threshold ?? null)) update({ available_threshold: v })
            }}
            placeholder="Hide exact qty above this"
            className="h-8 text-sm max-w-[180px]" />
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="oos-msg" className="text-xs">Out-of-Stock Message</Label>
        <Textarea id="oos-msg" rows={2}
          defaultValue={data.out_of_stock_message}
          onBlur={e => {
            if (e.target.value !== data.out_of_stock_message) update({ out_of_stock_message: e.target.value })
          }}
          placeholder="Shown on storefront when product is out of stock..."
          className="text-sm" />
      </div>
    </div>
  )
}

// --- eCommerce media gallery ---

interface MediaItem {
  id: number
  sequence: number
  name: string
  video_url: string | null
  has_image: boolean
}

function MediaGallery({ productTmplId }: { productTmplId: number }) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')

  const { data: media = [] } = useQuery<MediaItem[]>({
    queryKey: ['product-media', productTmplId],
    queryFn: async () => (await erpClient.raw.get(`/website/products/${productTmplId}/media`)).data,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['product-media', productTmplId] })

  async function uploadImage(file: File) {
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10MB'); return }
    setUploading(true)
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const r = reader.result as string
          resolve(r.split(',')[1])
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      await erpClient.raw.post(`/website/products/${productTmplId}/media`, { name: file.name, image_b64: b64 })
      refresh()
    } catch (e: unknown) {
      toast.error('Upload failed', extractErrorMessage(e))
    } finally {
      setUploading(false)
    }
  }

  const [addingVideo, setAddingVideo] = useState(false)
  async function addVideo() {
    const url = videoUrl.trim()
    if (!url || addingVideo) return
    setAddingVideo(true)
    try {
      await erpClient.raw.post(`/website/products/${productTmplId}/media`, { video_url: url, name: 'Video' })
      setVideoUrl('')
      refresh()
    } catch (e: unknown) {
      toast.error('Failed to add video', extractErrorMessage(e))
    } finally {
      setAddingVideo(false)
    }
  }

  async function removeItem(id: number) {
    if (!confirm('Remove this media item?')) return
    try {
      await erpClient.raw.delete(`/website/products/media/${id}`)
      refresh()
    } catch (e: unknown) {
      toast.error('Delete failed', extractErrorMessage(e))
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {media.map(m => (
          <div key={m.id} className="relative group w-24 h-24 rounded-lg overflow-hidden border border-border/50 bg-muted/30 flex items-center justify-center">
            {m.has_image ? (
              <img src={`/api/v1/website/products/media/${m.id}/image`} alt={m.name} className="w-full h-full object-cover" />
            ) : m.video_url ? (
              <div className="text-[10px] text-muted-foreground text-center px-1 break-all">{m.video_url.slice(0, 40)}...</div>
            ) : (
              <div className="text-[10px] text-muted-foreground">{m.name}</div>
            )}
            <button type="button" onClick={() => removeItem(m.id)}
              className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
          className="w-24 h-24 rounded-lg border border-dashed border-border/60 bg-muted/20 hover:bg-muted/40 flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-5 w-5" />}
          <span className="text-[10px] font-medium">{uploading ? 'Uploading' : 'Add image'}</span>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="sr-only"
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = '' }} />
      </div>
      <div className="flex items-center gap-2">
        <Input value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
          placeholder="Video URL (YouTube, Vimeo, ...)" aria-label="Video URL"
          className="h-8 text-sm max-w-md"
          disabled={addingVideo}
          onKeyDown={e => { if (e.key === 'Enter' && !addingVideo) addVideo() }} />
        <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={addVideo} disabled={!videoUrl.trim() || addingVideo}>
          {addingVideo ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
          {addingVideo ? 'Adding...' : 'Add video'}
        </Button>
      </div>
    </div>
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
  const [updateQtyOpen, setUpdateQtyOpen] = useState(false)
  const [replenishOpen, setReplenishOpen] = useState(false)
  const [printLabelsOpen, setPrintLabelsOpen] = useState(false)
  // Pre-save attribute lines buffer — flushed when the product is created.
  const [pendingAttributeLines, setPendingAttributeLines] = useState<PendingAttributeLine[]>([])

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
      const str = (v: unknown): string => {
        if (typeof v === 'string') return v
        if (v && typeof v === 'object') {
          const obj = v as Record<string, unknown>
          const en = obj.en_US
          if (typeof en === 'string') return en
          const first = Object.values(obj)[0]
          return typeof first === 'string' ? first : ''
        }
        return v ? String(v) : ''
      }
      const m2oId = (v: unknown): number | null => Array.isArray(v) ? (typeof v[0] === 'number' ? v[0] : null) : (typeof v === 'number' ? v : null)
      setForm({
        name: str(data.name), default_code: data.default_code || '', barcode: data.barcode || '',
        type: data.type || 'consu', list_price: data.list_price ?? 0, volume: data.volume ?? 0, weight: data.weight ?? 0,
        categ_id: m2oId(data.categ_id), uom_id: m2oId(data.uom_id), company_id: m2oId(data.company_id),
        description_sale: str(data.description_sale), description_purchase: str(data.description_purchase), description: str(data.description),
        sale_ok: data.sale_ok !== false, purchase_ok: data.purchase_ok !== false, active: data.active !== false,
        is_favorite: !!data.is_favorite, is_storable: !!data.is_storable, website_published: !!data.website_published,
        tracking: data.tracking || 'none', invoice_policy: data.invoice_policy || 'order',
        purchase_method: data.purchase_method || 'receive', service_tracking: data.service_tracking || 'no',
        sequence: data.sequence ?? 0,
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
      const vals: Record<string, unknown> = { ...form }
      if (!vals.categ_id) delete vals.categ_id
      if (!vals.uom_id) delete vals.uom_id
      if (!vals.company_id) delete vals.company_id
      // Image is saved separately (stored in ir_attachment, not on product_template)
      delete vals.image_1920

      let savedId: number | null = recordId
      if (isNew) {
        const { data: created } = await erpClient.raw.post('/model/product.template/create', { vals })
        savedId = created?.id || created?.record?.id || null
        toast.success('Product created')

        // Flush any pre-save attribute lines, then regenerate variants
        if (savedId && pendingAttributeLines.length > 0) {
          try {
            for (const line of pendingAttributeLines) {
              await erpClient.raw.post(`/website/products/${savedId}/attribute-lines`, {
                attribute_id: line.attribute_id,
                value_ids: line.value_ids.map(v => v.id),
              })
            }
            const anyValues = pendingAttributeLines.some(l => l.value_ids.length > 0)
            if (anyValues) {
              const { data: regen } = await erpClient.raw.post(`/website/products/${savedId}/regenerate-variants`)
              toast.success('Variants generated', `${regen?.variants_created ?? 0} variant(s) created`)
            }
            setPendingAttributeLines([])
          } catch (e: unknown) {
            toast.error('Product saved, but attribute setup failed', extractErrorMessage(e))
          }
        }
      } else {
        await erpClient.raw.put(`/model/product.template/${recordId}`, { vals })
        toast.success('Product saved')
        queryClient.invalidateQueries({ queryKey: ['product-editor', recordId] })
      }

      // Push image change (if any) to the dedicated image endpoint
      if (savedId && imageBase64 !== null) {
        try {
          await erpClient.raw.put(`/website/products/${savedId}/image`, {
            image_b64: imageBase64 || null,  // null = clear
          })
          setImageBase64(null)
          // Bust the <img> cache by invalidating the query so a reload refetches
          queryClient.invalidateQueries({ queryKey: ['product-editor', savedId] })
        } catch (e: unknown) {
          toast.error('Image not saved', extractErrorMessage(e))
        }
      }

      if (isNew) {
        navigate(savedId ? `/admin/products/${savedId}` : '/admin/website/products', { replace: true })
      }
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, "Save failed"))
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
        <Button variant="outline" size="sm" className="rounded-xl gap-1.5"
          onClick={() => setUpdateQtyOpen(true)}
          disabled={isNew || !recordId}
          title={isNew ? 'Save the product first' : ''}>
          <Sliders className="h-3.5 w-3.5" /> Update Quantity
        </Button>
        <Button variant="outline" size="sm" className="rounded-xl gap-1.5"
          onClick={() => setReplenishOpen(true)}
          disabled={isNew || !recordId}
          title={isNew ? 'Save the product first' : ''}>
          <RefreshCw className="h-3.5 w-3.5" /> Replenish
        </Button>
        <Button variant="outline" size="sm" className="rounded-xl gap-1.5"
          onClick={() => setPrintLabelsOpen(true)}
          disabled={isNew || !recordId}
          title={isNew ? 'Save the product first' : ''}>
          <Printer className="h-3.5 w-3.5" /> Print Labels
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

      {/* ── Per-product action dialogs ── */}
      {!isNew && recordId && (
        <>
          <UpdateQuantityDialog open={updateQtyOpen} onClose={() => setUpdateQtyOpen(false)} productTmplId={recordId} />
          <ReplenishDialog open={replenishOpen} onClose={() => setReplenishOpen(false)} productTmplId={recordId} productName={form.name || `#${recordId}`} />
          <PrintLabelsDialog open={printLabelsOpen} onClose={() => setPrintLabelsOpen(false)} productTmplId={recordId} productName={form.name || `#${recordId}`} />
        </>
      )}

      {/* ── Smart buttons ── (render even for new products, disabled until saved) */}
      <SmartButtonsBar
        productTmplId={recordId}
        productName={form.name || (recordId ? `#${recordId}` : 'New product')}
        websitePublished={!!form.website_published}
      />

      {/* ── Hero section: name + price + type + image ── */}
      <Card className="rounded-2xl">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
            {/* Image — backed by ir_attachment; show pending base64 preview if user picked a new file, else the server URL */}
            {(() => {
              // Three states:
              //  imageBase64 === null → no pending change; show server image if data.has_image
              //  imageBase64 === ''   → user cleared; show placeholder
              //  imageBase64 truthy    → preview newly-picked file
              const serverImageUrl = recordId && data?.has_image ? `/api/v1/website/products/${recordId}/image` : null
              const previewSrc = imageBase64 ? `data:image/png;base64,${imageBase64}` : null
              const shownSrc = previewSrc || (imageBase64 === null ? serverImageUrl : null)
              return (
                <div className="shrink-0 relative group mx-auto sm:mx-0">
                  <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleImageSelect} />
                  <div
                    className="flex w-32 h-32 items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/30 overflow-hidden cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/50"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {shownSrc
                      ? <img src={shownSrc} alt={form.name} className="h-full w-full object-cover" />
                      : (
                        <div className="flex flex-col items-center gap-1.5 text-muted-foreground/50">
                          <Upload className="h-6 w-6" />
                          <span className="text-[10px] font-medium">Add image</span>
                        </div>
                      )
                    }
                  </div>
                  {shownSrc && (
                    <button
                      type="button"
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); setImageBase64(''); }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )
            })()}

            {/* Fields */}
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name</Label>
                <Input id="name" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Wooden Chair" />
              </div>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                <PriceInput id="price" label="Sales Price" value={form.list_price} onChange={v => set('list_price', v)} />
                <SelectField id="type" label="Product Type" value={form.type} onChange={v => set('type', v)} options={PRODUCT_TYPES}
                  help="Consumable: no inventory tracking. Storable: tracks stock levels. Service: intangible (e.g. consulting, delivery)." />
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="ref">Internal Reference</Label>
                    <FieldHelp text="Your own SKU or part number. Used for search and reports; not shown to customers." />
                  </div>
                  <Input id="ref" value={form.default_code} onChange={e => set('default_code', e.target.value)} placeholder="FURN-001" />
                </div>
              </div>
              <div className="flex flex-wrap gap-5 pt-1">
                <CheckField label="Can be Sold" checked={form.sale_ok} onChange={v => set('sale_ok', v)}
                  help="Show this product on sales orders, quotations, and (if published) the storefront." />
                <CheckField label="Can be Purchased" checked={form.purchase_ok} onChange={v => set('purchase_ok', v)}
                  help="Show this product on purchase orders (RFQs) and vendor bills." />
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
          <TabsTrigger value="attributes" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">Attributes</TabsTrigger>
          <TabsTrigger value="notes" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card className="rounded-2xl mt-4">
            <CardContent className="p-4 sm:p-6">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="barcode">Barcode</Label>
                    <FieldHelp text="Scannable code (EAN-13, UPC, Code128). Used by POS scanners and label printing." />
                  </div>
                  <Input id="barcode" value={form.barcode} onChange={e => set('barcode', e.target.value)} placeholder="EAN13, UPC, ..." />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="sequence">Sequence</Label>
                    <FieldHelp text="Controls display order in product lists. Lower numbers appear first." />
                  </div>
                  <Input id="sequence" type="number" value={form.sequence} onChange={e => set('sequence', parseInt(e.target.value) || 0)} />
                </div>
                <M2OField label="Product Category" model="product.category" value={form.categ_id} onChange={id => set('categ_id', id)}
                  hint="Internal grouping used for reporting and accounting rules." />
                <M2OField label="Unit of Measure" model="uom.uom" value={form.uom_id} onChange={id => set('uom_id', id)}
                  hint="How this product is measured — pieces, kg, hours, etc." />
                {/* Company field hidden — only relevant for multi-company installations. The product
                    stays shared (company_id = null) across all companies, which is the correct
                    default for single-company setups. Restore by un-commenting if you go multi-company. */}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales">
          <Card className="rounded-2xl mt-4">
            <CardContent className="p-6 space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <SelectField id="invoice_policy" label="Invoicing Policy" value={form.invoice_policy} onChange={v => set('invoice_policy', v)} options={INVOICE_POLICIES}
                  help="Ordered quantities: customer is invoiced for what they ordered. Delivered quantities: invoice only for what you actually shipped (use this for services or partial deliveries)." />
                <SelectField id="service_tracking" label="Service Tracking" value={form.service_tracking} onChange={v => set('service_tracking', v)} options={SERVICE_TRACKING}
                  help="For service products: automatically create a project or task when the service is sold, so your team knows to deliver it." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc_sale">Sales Description</Label>
                <Textarea id="desc_sale" rows={4} value={form.description_sale} onChange={e => set('description_sale', e.target.value)} placeholder="Shown on quotations and sales orders..." />
              </div>
              <div className="pt-4 border-t border-border/40">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">eCommerce</div>
                <EcommerceSection productTmplId={recordId} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="purchase">
          <Card className="rounded-2xl mt-4">
            <CardContent className="p-6 space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <SelectField id="purchase_method" label="Control Policy" value={form.purchase_method} onChange={v => set('purchase_method', v)} options={PURCHASE_METHODS}
                  help="Ordered qty: the vendor's bill can match the PO as soon as it's confirmed. Received qty: only bill for what you actually received (use this if deliveries are often partial)." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc_purchase">Purchase Description</Label>
                <Textarea id="desc_purchase" rows={4} value={form.description_purchase} onChange={e => set('description_purchase', e.target.value)} placeholder="Shown on purchase orders and RFQs..." />
              </div>
              <div className="pt-2 border-t border-border/40">
                <SuppliersSection productTmplId={recordId} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory">
          <Card className="rounded-2xl mt-4">
            <CardContent className="p-4 sm:p-6">
              <div className="grid gap-5 md:grid-cols-2">
                <SelectField id="tracking" label="Tracking" value={form.tracking} onChange={v => set('tracking', v)} options={TRACKING_OPTIONS}
                  help="No Tracking: just a running stock count. By Lots: track batches (e.g. food with expiry dates). By Unique Serial Number: track each individual unit (e.g. electronics, vehicles)." />
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input id="weight" type="number" step="0.01" min="0" value={form.weight} onChange={e => set('weight', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="volume">Volume (m³)</Label>
                  <Input id="volume" type="number" step="0.001" min="0" value={form.volume} onChange={e => set('volume', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="flex items-end pb-1">
                  <CheckField label="Is Storable" checked={form.is_storable} onChange={v => set('is_storable', v)}
                    help="When on, the system keeps a stock count for this product and you can receive/deliver it. Turn off for services or consumables that don't need inventory tracking." />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attributes">
          <Card className="rounded-2xl mt-4">
            <CardContent className="p-4 sm:p-6">
              <AttributesSection productTmplId={recordId}
                pendingLines={pendingAttributeLines}
                setPendingLines={setPendingAttributeLines} />
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
              {(data.variants as ProductVariant[]).map((v) => (
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
