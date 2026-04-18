import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Input, Button, Badge, Skeleton, Switch, Label,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@mashora/design-system'
import { Save, X, Pencil, Plus, Trash2, DollarSign } from 'lucide-react'
import { PageHeader, M2OInput, toast } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'
import type { M2OValue } from '@/components/shared/OrderLinesEditor'

const PRICELIST_FIELDS = ['id', 'name', 'currency_id', 'active', 'sequence']
const ITEM_FIELDS = [
  'id', 'pricelist_id', 'applied_on', 'product_tmpl_id', 'product_id', 'categ_id',
  'min_quantity', 'date_start', 'date_end', 'compute_price',
  'fixed_price', 'price_discount', 'price_round', 'price_min_margin', 'price_max_margin',
  'base', 'base_pricelist_id',
]

const APPLIED_ON_OPTIONS = [
  { value: '3_global', label: 'Global' },
  { value: '2_product_category', label: 'Category' },
  { value: '1_product', label: 'Product Template' },
  { value: '0_product_variant', label: 'Variant' },
]

const COMPUTE_OPTIONS = [
  { value: 'fixed', label: 'Fixed Price' },
  { value: 'percentage', label: 'Discount %' },
  { value: 'formula', label: 'Formula' },
]

const BASE_OPTIONS = [
  { value: 'list_price', label: 'Sales Price' },
  { value: 'standard_price', label: 'Cost' },
  { value: 'pricelist', label: 'Other Pricelist' },
]

const selectCls =
  'flex h-9 w-full rounded-xl border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors'

interface ItemForm {
  id?: number
  applied_on: string
  product_tmpl_id?: M2OValue
  product_id?: M2OValue
  categ_id?: M2OValue
  min_quantity: number
  date_start: string
  date_end: string
  compute_price: string
  fixed_price: number
  price_discount: number
  base: string
  base_pricelist_id?: M2OValue
  /** Local-only flag for unsaved rows */
  _new?: boolean
  /** Marker for rows pending delete */
  _deleted?: boolean
  /** Marker for dirty rows */
  _dirty?: boolean
}

interface ServerItem {
  id: number
  applied_on?: string
  product_tmpl_id?: M2OValue
  product_id?: M2OValue
  categ_id?: M2OValue
  min_quantity?: number
  date_start?: string | false
  date_end?: string | false
  compute_price?: string
  fixed_price?: number
  price_discount?: number
  base?: string
  base_pricelist_id?: M2OValue
}

function dateInputVal(v: unknown): string {
  if (!v || v === false) return ''
  const s = String(v)
  return s.length >= 10 ? s.slice(0, 10) : s
}

export default function PricelistDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id || id === 'new'
  const recordId = isNew ? null : parseInt(id || '0')
  const [editing, setEditing] = useState(isNew)
  const [headerForm, setHeaderForm] = useState<{
    name: string
    currency_id: [number, string] | false | number | null
    active: boolean
    sequence: number
  }>({
    name: '',
    currency_id: false,
    active: true,
    sequence: 0,
  })
  const [items, setItems] = useState<ItemForm[]>([])
  const [busy, setBusy] = useState(false)

  // Fetch pricelist
  const { data: pl, isLoading } = useQuery({
    queryKey: ['pricelist', recordId],
    queryFn: async () => {
      if (!recordId) return null
      const { data } = await erpClient.raw.get(`/model/product.pricelist/${recordId}`)
      return data
    },
    enabled: !!recordId,
  })

  // Fetch items
  const { data: itemsData } = useQuery({
    queryKey: ['pricelist-items', recordId],
    queryFn: async () => {
      if (!recordId) return { records: [] }
      const { data } = await erpClient.raw.post('/model/product.pricelist.item', {
        domain: [['pricelist_id', '=', recordId]],
        fields: ITEM_FIELDS,
        limit: 500,
        order: 'sequence asc, id asc',
      })
      return data
    },
    enabled: !!recordId,
  })

  useEffect(() => {
    if (pl) {
      setHeaderForm({
        name: pl.name || '',
        currency_id: pl.currency_id || false,
        active: pl.active !== false,
        sequence: pl.sequence ?? 0,
      })
    }
  }, [pl])

  useEffect(() => {
    if (itemsData?.records) {
      setItems((itemsData.records as ServerItem[]).map((r) => ({
        id: r.id,
        applied_on: r.applied_on || '3_global',
        product_tmpl_id: r.product_tmpl_id || false,
        product_id: r.product_id || false,
        categ_id: r.categ_id || false,
        min_quantity: Number(r.min_quantity ?? 0),
        date_start: dateInputVal(r.date_start),
        date_end: dateInputVal(r.date_end),
        compute_price: r.compute_price || 'fixed',
        fixed_price: Number(r.fixed_price ?? 0),
        price_discount: Number(r.price_discount ?? 0),
        base: r.base || 'list_price',
        base_pricelist_id: r.base_pricelist_id || false,
      })))
    }
  }, [itemsData])

  const updateItem = useCallback((idx: number, patch: Partial<ItemForm>) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch, _dirty: true } : it))
  }, [])

  const addRow = () => {
    setItems(prev => [...prev, {
      applied_on: '3_global',
      min_quantity: 1,
      date_start: '',
      date_end: '',
      compute_price: 'fixed',
      fixed_price: 0,
      price_discount: 0,
      base: 'list_price',
      _new: true,
      _dirty: true,
    }])
  }

  const removeRow = (idx: number) => {
    setItems(prev => {
      const it = prev[idx]
      if (!it.id) {
        // Unsaved row - just drop
        return prev.filter((_, i) => i !== idx)
      }
      // Mark for delete
      return prev.map((r, i) => i === idx ? { ...r, _deleted: true } : r)
    })
  }

  const itemValsForSave = (it: ItemForm, plId: number) => {
    const vals: Record<string, unknown> = {
      pricelist_id: plId,
      applied_on: it.applied_on,
      min_quantity: it.min_quantity,
      date_start: it.date_start || false,
      date_end: it.date_end || false,
      compute_price: it.compute_price,
      base: it.base,
    }
    // Only relevant target ID
    if (it.applied_on === '1_product') {
      vals.product_tmpl_id = Array.isArray(it.product_tmpl_id) ? it.product_tmpl_id[0] : (it.product_tmpl_id || false)
      vals.product_id = false
      vals.categ_id = false
    } else if (it.applied_on === '0_product_variant') {
      vals.product_id = Array.isArray(it.product_id) ? it.product_id[0] : (it.product_id || false)
      vals.product_tmpl_id = false
      vals.categ_id = false
    } else if (it.applied_on === '2_product_category') {
      vals.categ_id = Array.isArray(it.categ_id) ? it.categ_id[0] : (it.categ_id || false)
      vals.product_id = false
      vals.product_tmpl_id = false
    } else {
      vals.product_id = false
      vals.product_tmpl_id = false
      vals.categ_id = false
    }
    if (it.compute_price === 'fixed') {
      vals.fixed_price = it.fixed_price
    } else if (it.compute_price === 'percentage') {
      vals.price_discount = it.price_discount
    }
    if (it.base === 'pricelist') {
      vals.base_pricelist_id = Array.isArray(it.base_pricelist_id) ? it.base_pricelist_id[0] : (it.base_pricelist_id || false)
    }
    return vals
  }

  async function handleSave() {
    if (!headerForm.name.trim()) {
      toast.error('Validation', 'Name is required')
      return
    }
    setBusy(true)
    try {
      // 1) Save header
      const headerVals: Record<string, unknown> = {
        name: headerForm.name.trim(),
        active: headerForm.active,
        sequence: Number(headerForm.sequence) || 0,
      }
      const currencyId = Array.isArray(headerForm.currency_id) ? headerForm.currency_id[0] : headerForm.currency_id
      if (currencyId) headerVals.currency_id = currencyId

      let plId = recordId
      if (isNew) {
        const { data } = await erpClient.raw.post('/model/product.pricelist/create', { vals: headerVals })
        plId = data?.id
        if (!plId) throw new Error('Failed to create pricelist')
      } else {
        await erpClient.raw.put(`/model/product.pricelist/${recordId}`, { vals: headerVals })
      }

      // 2) Item CRUD
      for (const it of items) {
        if (it._deleted && it.id) {
          await erpClient.raw.delete(`/model/product.pricelist.item/${it.id}`)
        } else if (it._new && !it._deleted) {
          await erpClient.raw.post('/model/product.pricelist.item/create', { vals: itemValsForSave(it, plId!) })
        } else if (it._dirty && it.id) {
          await erpClient.raw.put(`/model/product.pricelist.item/${it.id}`, { vals: itemValsForSave(it, plId!) })
        }
      }

      toast.success('Saved', 'Pricelist saved')
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['pricelist'] })
      queryClient.invalidateQueries({ queryKey: ['pricelist-items'] })
      queryClient.invalidateQueries({ queryKey: ['pricelists'] })
      if (isNew && plId) navigate(`/admin/products/pricelists/${plId}`, { replace: true })
    } catch (e: unknown) {
      toast.error('Save Failed', extractErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (recordId && isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  const visibleItems = items.filter(it => !it._deleted)

  return (
    <div className="space-y-6">
      <PageHeader
        title={isNew ? 'New Pricelist' : (headerForm.name || 'Pricelist')}
        backTo="/admin/products/pricelists"
        actions={
          <div className="flex items-center gap-2">
            {!editing && !isNew && (
              <Badge variant={headerForm.active ? 'success' : 'secondary'} className="text-xs">
                {headerForm.active ? 'Active' : 'Archived'}
              </Badge>
            )}
            {editing ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-xl gap-1.5"
                  onClick={() => isNew ? navigate(-1) : setEditing(false)}
                  disabled={busy}
                >
                  <X className="h-3.5 w-3.5" /> Discard
                </Button>
                <Button size="sm" className="rounded-xl gap-1.5" onClick={handleSave} disabled={busy}>
                  <Save className="h-3.5 w-3.5" /> {busy ? 'Saving...' : 'Save'}
                </Button>
              </>
            ) : (
              <Button size="sm" className="rounded-xl gap-1.5" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
          </div>
        }
      />

      {/* Header form */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-5">
          <Field label="Name" required>
            {editing ? (
              <Input
                value={headerForm.name}
                onChange={e => setHeaderForm(p => ({ ...p, name: e.target.value }))}
                className="rounded-xl h-9"
              />
            ) : (
              <span className="text-sm font-medium">{headerForm.name || '—'}</span>
            )}
          </Field>
          <Field label="Currency">
            {editing ? (
              <M2OInput
                value={headerForm.currency_id}
                model="res.currency"
                onChange={v => setHeaderForm(p => ({ ...p, currency_id: v }))}
                placeholder="Select currency..."
              />
            ) : (
              <span className="text-sm">
                {Array.isArray(headerForm.currency_id) ? headerForm.currency_id[1] : '—'}
              </span>
            )}
          </Field>
          <Field label="Sequence">
            {editing ? (
              <Input
                type="number"
                value={headerForm.sequence}
                onChange={e => setHeaderForm(p => ({ ...p, sequence: Number(e.target.value) }))}
                className="rounded-xl h-9 max-w-[120px]"
              />
            ) : (
              <span className="text-sm">{headerForm.sequence}</span>
            )}
          </Field>
          <Field label="Active">
            {editing ? (
              <div className="flex items-center gap-2 pt-1">
                <Switch
                  id="active"
                  checked={headerForm.active}
                  onCheckedChange={v => setHeaderForm(p => ({ ...p, active: v }))}
                />
                <Label htmlFor="active" className="text-sm">{headerForm.active ? 'Active' : 'Archived'}</Label>
              </div>
            ) : (
              <Badge variant={headerForm.active ? 'success' : 'secondary'} className="text-xs">
                {headerForm.active ? 'Active' : 'Archived'}
              </Badge>
            )}
          </Field>
        </div>
      </div>

      {/* Items table */}
      <div className="rounded-2xl border border-border/30 bg-card/50 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/30">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Pricing Rules</h2>
            <Badge variant="secondary" className="text-xs">{visibleItems.length}</Badge>
          </div>
          {editing && (
            <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={addRow}>
              <Plus className="h-3.5 w-3.5" /> Add Rule
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/40">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider w-[14%]">Applied On</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider w-[20%]">Target</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider w-[10%]">Min Qty</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider w-[12%]">From</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider w-[12%]">To</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider w-[12%]">Compute</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider w-[14%]">Price</TableHead>
                {editing && <TableHead className="w-[6%]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={editing ? 8 : 7} className="h-20 text-center text-muted-foreground">
                    No pricing rules. {editing && 'Click "Add Rule" to create one.'}
                  </TableCell>
                </TableRow>
              ) : visibleItems.map((it) => {
                const idx = items.indexOf(it)
                return (
                  <TableRow key={it.id ?? `new-${idx}`} className="border-border/30 hover:bg-muted/10 align-top">
                    {/* Applied On */}
                    <TableCell className="py-2">
                      {editing ? (
                        <select
                          className={selectCls}
                          value={it.applied_on}
                          onChange={e => updateItem(idx, { applied_on: e.target.value })}
                        >
                          {APPLIED_ON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : (
                        <span className="text-sm">
                          {APPLIED_ON_OPTIONS.find(o => o.value === it.applied_on)?.label ?? it.applied_on}
                        </span>
                      )}
                    </TableCell>
                    {/* Target M2O */}
                    <TableCell className="py-2">
                      {it.applied_on === '3_global' ? (
                        <span className="text-xs text-muted-foreground italic">All Products</span>
                      ) : editing ? (
                        it.applied_on === '1_product' ? (
                          <M2OInput
                            value={it.product_tmpl_id}
                            model="product.template"
                            onChange={v => updateItem(idx, { product_tmpl_id: v })}
                            placeholder="Product..."
                          />
                        ) : it.applied_on === '0_product_variant' ? (
                          <M2OInput
                            value={it.product_id}
                            model="product.product"
                            onChange={v => updateItem(idx, { product_id: v })}
                            placeholder="Variant..."
                          />
                        ) : (
                          <M2OInput
                            value={it.categ_id}
                            model="product.category"
                            onChange={v => updateItem(idx, { categ_id: v })}
                            placeholder="Category..."
                          />
                        )
                      ) : (
                        <span className="text-sm">
                          {it.applied_on === '1_product' ? (Array.isArray(it.product_tmpl_id) ? it.product_tmpl_id[1] : '—')
                            : it.applied_on === '0_product_variant' ? (Array.isArray(it.product_id) ? it.product_id[1] : '—')
                            : it.applied_on === '2_product_category' ? (Array.isArray(it.categ_id) ? it.categ_id[1] : '—')
                            : '—'}
                        </span>
                      )}
                    </TableCell>
                    {/* Min Qty */}
                    <TableCell className="py-2">
                      {editing ? (
                        <Input
                          type="number"
                          value={it.min_quantity}
                          onChange={e => updateItem(idx, { min_quantity: Number(e.target.value) })}
                          className="rounded-xl h-9"
                          min={0}
                        />
                      ) : <span className="text-sm font-mono">{it.min_quantity}</span>}
                    </TableCell>
                    {/* Date From */}
                    <TableCell className="py-2">
                      {editing ? (
                        <Input
                          type="date"
                          value={it.date_start}
                          onChange={e => updateItem(idx, { date_start: e.target.value })}
                          className="rounded-xl h-9"
                        />
                      ) : <span className="text-sm">{it.date_start || '—'}</span>}
                    </TableCell>
                    {/* Date To */}
                    <TableCell className="py-2">
                      {editing ? (
                        <Input
                          type="date"
                          value={it.date_end}
                          onChange={e => updateItem(idx, { date_end: e.target.value })}
                          className="rounded-xl h-9"
                        />
                      ) : <span className="text-sm">{it.date_end || '—'}</span>}
                    </TableCell>
                    {/* Compute Price */}
                    <TableCell className="py-2">
                      {editing ? (
                        <select
                          className={selectCls}
                          value={it.compute_price}
                          onChange={e => updateItem(idx, { compute_price: e.target.value })}
                        >
                          {COMPUTE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : (
                        <span className="text-sm">
                          {COMPUTE_OPTIONS.find(o => o.value === it.compute_price)?.label ?? it.compute_price}
                        </span>
                      )}
                    </TableCell>
                    {/* Price (conditional) */}
                    <TableCell className="py-2">
                      {editing ? (
                        it.compute_price === 'fixed' ? (
                          <Input
                            type="number"
                            value={it.fixed_price}
                            onChange={e => updateItem(idx, { fixed_price: Number(e.target.value) })}
                            className="rounded-xl h-9 font-mono"
                            step="0.01"
                          />
                        ) : it.compute_price === 'percentage' ? (
                          <div className="relative">
                            <Input
                              type="number"
                              value={it.price_discount}
                              onChange={e => updateItem(idx, { price_discount: Number(e.target.value) })}
                              className="rounded-xl h-9 pr-7 font-mono"
                              step="0.01"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Formula</span>
                        )
                      ) : (
                        <span className="text-sm font-mono">
                          {it.compute_price === 'fixed' ? it.fixed_price.toFixed(2)
                            : it.compute_price === 'percentage' ? `${it.price_discount}%`
                            : 'formula'}
                        </span>
                      )}
                    </TableCell>
                    {editing && (
                      <TableCell className="py-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 rounded-lg text-destructive hover:text-destructive"
                          onClick={() => removeRow(idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </p>
      <div>{children}</div>
    </div>
  )
}
