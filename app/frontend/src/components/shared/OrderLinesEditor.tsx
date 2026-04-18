import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Input, Button, Badge,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  cn,
} from '@mashora/design-system'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import M2OInput from './M2OInput'
import ConfirmDialog from './ConfirmDialog'
import { toast } from './Toast'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

/** M2O value shape: [id, display_name] tuple, or false when unset */
export type M2OValue = [number, string] | false | null | undefined

/** A line row coming back from the server (read response) */
export interface ServerLine {
  id: number
  product_id?: M2OValue
  name?: string
  account_id?: M2OValue
  price_unit?: number
  discount?: number
  display_type?: string | false
  price_subtotal?: number
  qty_delivered?: number
  qty_received?: number
  qty_invoiced?: number
  /** Tax write responses from the backend can be: [id, ...] | [[id, name], ...] | [{id,name}, ...] */
  tax_ids?: unknown[]
  tax_id?: unknown[]
  sequence?: number
  customer_lead?: number
  [key: string]: unknown
}

export interface OrderLinesEditorProps {
  /** Existing lines from backend */
  lines: ServerLine[]
  /** Parent record id (order id or move id). null for new unsaved parent */
  parentId: number | null
  /** Field on the line linking to the parent ('order_id' / 'move_id') */
  parentField: string
  /** Line model name */
  lineModel: string
  /** Quantity field name */
  qtyField: string
  /** Show discount column (sales/invoice) */
  showDiscount?: boolean
  /** Show delivered column (sales) */
  showDelivered?: boolean
  /** Show received column (purchase) */
  showReceived?: boolean
  /** Show invoiced column (sales/purchase) */
  showInvoiced?: boolean
  /** Show account column (invoice) */
  showAccount?: boolean
  /** Show customer lead time column (sales) */
  showLeadTime?: boolean
  /** Currency symbol */
  currencySymbol?: string
  /** Locked - render as read-only display */
  readonly?: boolean
  /** Called after any successful create/update/delete to refresh parent + totals */
  onChanged: () => void
  /**
   * Local-buffer mode for unsaved parents.
   * When `parentId == null` and this callback is provided, lines are kept
   * entirely in local state (no API calls) and mirrored to the parent via
   * this callback on every change. The parent is expected to send them
   * alongside the create request for its own record.
   */
  onLocalLinesChange?: (lines: LocalLine[]) => void
}

export interface LocalLine {
  id?: number               // backend id once persisted
  _localId: string          // local row key
  _isNew?: boolean          // not yet saved
  _saving?: boolean
  _dirty?: boolean
  product_id?: M2OValue     // [id, name] | false
  name?: string
  account_id?: M2OValue     // [id, name] | false (invoice only)
  price_unit?: number
  discount?: number
  display_type?: string | false
  price_subtotal?: number
  qty_delivered?: number
  qty_received?: number
  qty_invoiced?: number
  tax_ids?: unknown[]       // [[6,0,[ids...]]] from backend; or [id, name] tuples in read responses
  sequence?: number
  customer_lead?: number
  // qty stored under qtyField key dynamically — accessed via [qtyField]
  [key: string]: unknown
}

let localIdCounter = 1
const nextLocalId = () => `local-${localIdCounter++}`

const m2oId = (v: unknown): number | null =>
  Array.isArray(v) ? (typeof v[0] === 'number' ? v[0] : null) : (typeof v === 'number' ? v : null)

const m2oName = (v: unknown): string =>
  Array.isArray(v) ? (typeof v[1] === 'string' ? v[1] : '') : ''

/**
 * Normalize tax_ids from backend.
 * Read response: [[id, name], ...] or [id, ...]
 * Returns: array of {id, name}
 */
function normalizeTaxes(tax_ids: unknown): { id: number; name: string }[] {
  if (!Array.isArray(tax_ids)) return []
  return tax_ids
    .map((t): { id: number; name: string } | null => {
      if (Array.isArray(t) && t.length >= 2) return { id: Number(t[0]), name: String(t[1]) }
      if (typeof t === 'number') return { id: t, name: `Tax ${t}` }
      if (t && typeof t === 'object' && 'id' in t) {
        const obj = t as { id: number; name?: string }
        return { id: obj.id, name: obj.name || `Tax ${obj.id}` }
      }
      return null
    })
    .filter((x): x is { id: number; name: string } => x !== null)
}

function computeSubtotal(qty: unknown, price: unknown, discount: unknown): number {
  const q = Number(qty) || 0
  const p = Number(price) || 0
  const d = Number(discount) || 0
  return q * p * (1 - d / 100)
}

export default function OrderLinesEditor({
  lines: serverLines,
  parentId,
  parentField,
  lineModel,
  qtyField,
  showDiscount = false,
  showDelivered = false,
  showReceived = false,
  showInvoiced = false,
  showAccount = false,
  showLeadTime = false,
  currencySymbol = '$',
  readonly = false,
  onChanged,
  onLocalLinesChange,
}: OrderLinesEditorProps) {
  const localMode = parentId == null && !!onLocalLinesChange
  // Local state — unsaved new rows live here. Persisted rows come from serverLines.
  // We also keep an "edits" buffer per persisted row to allow inline edits before blur-save.
  const [newRows, setNewRows] = useState<LocalLine[]>([])
  const [edits, setEdits] = useState<Record<number, Partial<LocalLine>>>({})
  const [savingIds, setSavingIds] = useState<Set<number | string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null)

  // Reset local state when parentId changes
  useEffect(() => {
    setNewRows([])
    setEdits({})
  }, [parentId])

  // Mirror local-mode newRows to parent without re-firing when the callback
  // identity changes each render.
  const localCbRef = useRef(onLocalLinesChange)
  useEffect(() => { localCbRef.current = onLocalLinesChange })
  useEffect(() => {
    if (localMode && localCbRef.current) localCbRef.current(newRows)
  }, [newRows, localMode])

  // After a successful save, drop the saved row from edits/newRows so server data takes over.
  // We do this in mutation onSuccess via refs so multi-row editing works smoothly.

  const setSaving = useCallback((key: number | string, on: boolean) => {
    setSavingIds(prev => {
      const next = new Set(prev)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])

  // -------- Mutations --------

  const createMut = useMutation({
    mutationFn: async (vals: Record<string, unknown>) => {
      const { data } = await erpClient.raw.post(`/model/${lineModel}/create`, { vals })
      return data
    },
  })

  const updateMut = useMutation({
    mutationFn: async ({ id, vals }: { id: number; vals: Record<string, unknown> }) => {
      const { data } = await erpClient.raw.put(`/model/${lineModel}/${id}`, { vals })
      return data
    },
  })

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await erpClient.raw.delete(`/model/${lineModel}/${id}`)
      return id
    },
  })

  // -------- Add row --------

  const handleAddLine = () => {
    setNewRows(prev => [
      ...prev,
      {
        _localId: nextLocalId(),
        _isNew: true,
        product_id: false,
        name: '',
        [qtyField]: 1,
        price_unit: 0,
        discount: 0,
        sequence: 99 + prev.length,
      },
    ])
  }

  // -------- Save new row --------

  const buildVals = (row: LocalLine): Record<string, unknown> => {
    const productId = m2oId(row.product_id)
    const vals: Record<string, unknown> = {
      [parentField]: parentId,
      product_id: productId || false,
      name: row.name || (Array.isArray(row.product_id) ? row.product_id[1] : ''),
      [qtyField]: Number(row[qtyField] ?? 1) || 0,
      price_unit: Number(row.price_unit ?? 0) || 0,
    }
    if (showDiscount) vals.discount = Number(row.discount ?? 0) || 0
    if (showLeadTime) vals.customer_lead = Number(row.customer_lead ?? 0) || 0
    if (showAccount && row.account_id) {
      const accId = m2oId(row.account_id)
      if (accId) vals.account_id = accId
    }
    return vals
  }

  const saveNewRow = async (localId: string) => {
    const row = newRows.find(r => r._localId === localId)
    if (!row) return
    if (parentId == null) {
      // Local buffer mode — parent collects rows via onLocalLinesChange.
      // No toast, no API call; edits are already reflected in state.
      return
    }
    if (!m2oId(row.product_id)) {
      // still in-progress — don't auto-save until product set
      return
    }
    setSaving(localId, true)
    try {
      const data = await createMut.mutateAsync(buildVals(row))
      setNewRows(prev => prev.filter(r => r._localId !== localId))
      const newId: number | undefined = data?.id
      if (newId) {
        // Optimistically clear any edits for that id
        setEdits(prev => {
          const next = { ...prev }
          delete next[newId]
          return next
        })
      }
      onChanged()
    } catch (e: unknown) {
      toast.error('Failed to add line', extractErrorMessage(e))
    } finally {
      setSaving(localId, false)
    }
  }

  // -------- Save existing row --------

  const saveExistingRow = async (id: number) => {
    const patch = edits[id]
    if (!patch || Object.keys(patch).length === 0) return
    setSaving(id, true)
    try {
      const vals: Record<string, unknown> = {}
      for (const k of Object.keys(patch) as Array<keyof LocalLine>) {
        const v = patch[k]
        if (k === 'product_id') vals.product_id = m2oId(v) || false
        else if (k === 'account_id') vals.account_id = m2oId(v) || false
        else if (k === qtyField || k === 'price_unit' || k === 'discount' || k === 'customer_lead') vals[k] = Number(v ?? 0) || 0
        else vals[k] = v
      }
      await updateMut.mutateAsync({ id, vals })
      setEdits(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      onChanged()
    } catch (e: unknown) {
      toast.error('Failed to update line', extractErrorMessage(e))
    } finally {
      setSaving(id, false)
    }
  }

  // -------- Delete --------

  const askDelete = (id: number, name: string) => setConfirmDelete({ id, name })

  const doDelete = async () => {
    if (!confirmDelete) return
    const { id } = confirmDelete
    setConfirmDelete(null)
    setSaving(id, true)
    try {
      await deleteMut.mutateAsync(id)
      setEdits(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      onChanged()
    } catch (e: unknown) {
      toast.error('Failed to delete line', extractErrorMessage(e))
    } finally {
      setSaving(id, false)
    }
  }

  // -------- Helpers for cell rendering --------

  /** Get the effective value for a field on a persisted row (edits override server) */
  const eff = (line: ServerLine, field: string): unknown => {
    const e = edits[line.id] as Record<string, unknown> | undefined
    if (e && field in e) return e[field]
    return line[field]
  }

  const setEdit = (id: number, field: string, value: unknown) => {
    setEdits(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }))
  }

  const setNewRowField = (localId: string, field: string, value: unknown) => {
    setNewRows(prev => prev.map(r => r._localId === localId ? { ...r, [field]: value } : r))
  }

  // Compute total columns count for colspan
  const colCount = useMemo(() => {
    let n = 2 // product, qty
    if (showDelivered) n++
    if (showReceived) n++
    if (showInvoiced) n++
    if (showAccount) n++
    n += 2 // price, subtotal
    if (showDiscount) n++
    if (showLeadTime) n++
    if (!readonly) n++ // actions
    return n
  }, [showDiscount, showDelivered, showReceived, showInvoiced, showAccount, showLeadTime, readonly])

  const totals = useMemo(() => {
    const persisted = serverLines
      .filter(l => !l.display_type || l.display_type === 'product')
      .reduce((sum, l) => {
        const e = edits[l.id] as Record<string, unknown> | undefined
        if (e) {
          const qty = Number(e[qtyField] ?? l[qtyField] ?? 0)
          const price = Number(e.price_unit ?? l.price_unit ?? 0)
          const disc = showDiscount ? Number(e.discount ?? l.discount ?? 0) : 0
          return sum + computeSubtotal(qty, price, disc)
        }
        return sum + Number(l.price_subtotal ?? computeSubtotal(l[qtyField], l.price_unit, l.discount || 0))
      }, 0)
    const newSum = newRows.reduce((sum, r) => {
      if (!m2oId(r.product_id)) return sum
      return sum + computeSubtotal(r[qtyField], r.price_unit, r.discount || 0)
    }, 0)
    return persisted + newSum
  }, [serverLines, edits, newRows, qtyField, showDiscount])

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/40">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider w-[28%]">Product</TableHead>
              {showAccount && (
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider w-[18%]">Account</TableHead>
              )}
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-[8%]">Qty</TableHead>
              {showDelivered && (
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-[8%]">Delivered</TableHead>
              )}
              {showReceived && (
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-[8%]">Received</TableHead>
              )}
              {showInvoiced && (
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-[8%]">Invoiced</TableHead>
              )}
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-[10%]">Unit Price</TableHead>
              {showDiscount && (
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-[7%]">Disc.%</TableHead>
              )}
              {showLeadTime && (
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-[8%]">Lead (days)</TableHead>
              )}
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-[12%]">Subtotal</TableHead>
              {!readonly && (
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-center w-[5%]"></TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {serverLines.length === 0 && newRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="h-20 text-center text-muted-foreground">
                  No lines yet{!readonly && (parentId != null || localMode) ? ' — click "Add line" below' : ''}
                </TableCell>
              </TableRow>
            ) : (
              <>
                {serverLines.map(line => {
                  // Section/note rows are read-only display
                  if (line.display_type === 'line_section') {
                    return (
                      <TableRow key={`sec-${line.id}`} className="bg-muted/20 hover:bg-muted/30">
                        <TableCell colSpan={colCount} className="font-semibold text-sm py-2">
                          {line.name}
                        </TableCell>
                      </TableRow>
                    )
                  }
                  if (line.display_type === 'line_note') {
                    return (
                      <TableRow key={`note-${line.id}`} className="hover:bg-transparent">
                        <TableCell colSpan={colCount} className="text-sm text-muted-foreground italic py-1.5">
                          {line.name}
                        </TableCell>
                      </TableRow>
                    )
                  }

                  const isSaving = savingIds.has(line.id)
                  const isDirty = !!edits[line.id]
                  const taxes = normalizeTaxes(line.tax_ids || line.tax_id)
                  const productId = eff(line, 'product_id') as M2OValue
                  const descriptionRaw = eff(line, 'name')
                  const description = typeof descriptionRaw === 'string' ? descriptionRaw : ''
                  const qtyRaw = eff(line, qtyField)
                  const qtyVal: number | string = (typeof qtyRaw === 'number' || typeof qtyRaw === 'string') ? qtyRaw : 0
                  const priceRaw = eff(line, 'price_unit')
                  const priceVal: number | string = (typeof priceRaw === 'number' || typeof priceRaw === 'string') ? priceRaw : 0
                  const discRaw = showDiscount ? eff(line, 'discount') : 0
                  const discVal: number | string = (typeof discRaw === 'number' || typeof discRaw === 'string') ? discRaw : 0
                  const subtotal = isDirty
                    ? computeSubtotal(qtyVal, priceVal, discVal)
                    : Number(line.price_subtotal ?? computeSubtotal(qtyVal, priceVal, discVal))

                  return (
                    <TableRow
                      key={line.id}
                      className={cn(
                        'border-border/30 hover:bg-muted/10 align-top',
                        isDirty && 'bg-amber-50/40 dark:bg-amber-950/10'
                      )}
                    >
                      {/* Product + description */}
                      <TableCell className="py-1.5">
                        {readonly ? (
                          <>
                            <p className="text-sm font-medium">{m2oName(productId) || '—'}</p>
                            {description && description !== m2oName(productId) && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{description}</p>
                            )}
                            {taxes.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {taxes.map(t => (
                                  <Badge key={t.id} variant="outline" className="text-[10px] h-4 px-1.5 rounded-md">
                                    {t.name}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="space-y-1">
                            <M2OInput
                              value={productId}
                              model="product.product"
                              onChange={v => {
                                setEdit(line.id, 'product_id', v)
                                // Auto-fill description on product select if empty
                                if (Array.isArray(v) && (!description || description === m2oName(productId))) {
                                  setEdit(line.id, 'name', v[1])
                                }
                              }}
                              className="h-8 text-sm"
                            />
                            <Input
                              value={description}
                              onChange={e => setEdit(line.id, 'name', e.target.value)}
                              onBlur={() => saveExistingRow(line.id)}
                              placeholder="Description"
                              className="rounded-lg h-7 text-xs"
                            />
                            {taxes.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {taxes.map(t => (
                                  <Badge key={t.id} variant="outline" className="text-[10px] h-4 px-1.5 rounded-md">
                                    {t.name}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>

                      {/* Account (invoice only) */}
                      {showAccount && (
                        <TableCell className="py-1.5">
                          {readonly ? (
                            <span className="text-sm text-muted-foreground">{m2oName(eff(line, 'account_id'))}</span>
                          ) : (
                            <M2OInput
                              value={eff(line, 'account_id') as M2OValue}
                              model="account.account"
                              onChange={v => setEdit(line.id, 'account_id', v)}
                              className="h-8 text-sm"
                              placeholder="Account..."
                            />
                          )}
                        </TableCell>
                      )}

                      {/* Qty */}
                      <TableCell className="text-right py-1.5">
                        {readonly ? (
                          <span className="font-mono text-sm">{Number(qtyVal).toFixed(2)}</span>
                        ) : (
                          <Input
                            type="number"
                            step="0.01"
                            value={qtyVal}
                            onChange={e => setEdit(line.id, qtyField, e.target.value)}
                            onBlur={() => saveExistingRow(line.id)}
                            className="rounded-lg h-8 text-sm text-right font-mono"
                          />
                        )}
                      </TableCell>

                      {showDelivered && (
                        <TableCell className="text-right font-mono text-sm py-1.5 text-muted-foreground">
                          {Number(line.qty_delivered || 0).toFixed(2)}
                        </TableCell>
                      )}
                      {showReceived && (
                        <TableCell className="text-right font-mono text-sm py-1.5 text-muted-foreground">
                          {Number(line.qty_received || 0).toFixed(2)}
                        </TableCell>
                      )}
                      {showInvoiced && (
                        <TableCell className="text-right font-mono text-sm py-1.5 text-muted-foreground">
                          {Number(line.qty_invoiced || 0).toFixed(2)}
                        </TableCell>
                      )}

                      {/* Price */}
                      <TableCell className="text-right py-1.5">
                        {readonly ? (
                          <span className="font-mono text-sm">{currencySymbol}{Number(priceVal).toFixed(2)}</span>
                        ) : (
                          <Input
                            type="number"
                            step="0.01"
                            value={priceVal}
                            onChange={e => setEdit(line.id, 'price_unit', e.target.value)}
                            onBlur={() => saveExistingRow(line.id)}
                            className="rounded-lg h-8 text-sm text-right font-mono"
                          />
                        )}
                      </TableCell>

                      {/* Discount */}
                      {showDiscount && (
                        <TableCell className="text-right py-1.5">
                          {readonly ? (
                            <span className="font-mono text-sm text-muted-foreground">
                              {Number(discVal) ? `${Number(discVal)}%` : ''}
                            </span>
                          ) : (
                            <Input
                              type="number"
                              step="0.01"
                              value={discVal}
                              onChange={e => setEdit(line.id, 'discount', e.target.value)}
                              onBlur={() => saveExistingRow(line.id)}
                              className="rounded-lg h-8 text-sm text-right font-mono"
                            />
                          )}
                        </TableCell>
                      )}

                      {/* Lead time (days) */}
                      {showLeadTime && (
                        <TableCell className="text-right py-1.5">
                          {readonly ? (
                            <span className="font-mono text-sm text-muted-foreground">
                              {Number(eff(line, 'customer_lead')) || 0}
                            </span>
                          ) : (
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={(() => {
                                const v = eff(line, 'customer_lead')
                                return typeof v === 'number' || typeof v === 'string' ? v : 0
                              })()}
                              onChange={e => setEdit(line.id, 'customer_lead', e.target.value)}
                              onBlur={() => saveExistingRow(line.id)}
                              className="rounded-lg h-8 text-sm text-right font-mono"
                            />
                          )}
                        </TableCell>
                      )}

                      {/* Subtotal */}
                      <TableCell className="text-right font-mono text-sm font-medium py-1.5">
                        {currencySymbol}{Number(subtotal).toFixed(2)}
                      </TableCell>

                      {/* Actions */}
                      {!readonly && (
                        <TableCell className="text-center py-1.5">
                          {isSaving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-muted-foreground" />
                          ) : (
                            <button
                              type="button"
                              onClick={() => askDelete(line.id, m2oName(productId) || description || `Line #${line.id}`)}
                              className="text-muted-foreground/60 hover:text-destructive transition-colors"
                              title="Delete line"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}

                {/* New unsaved rows */}
                {!readonly && newRows.map(row => {
                  const isSaving = savingIds.has(row._localId)
                  const subtotal = computeSubtotal(row[qtyField], row.price_unit, row.discount || 0)
                  return (
                    <TableRow
                      key={row._localId}
                      className="bg-emerald-50/30 dark:bg-emerald-950/10 border-border/30 align-top"
                    >
                      <TableCell className="py-1.5">
                        <div className="space-y-1">
                          <M2OInput
                            value={row.product_id}
                            model="product.product"
                            onChange={v => {
                              setNewRowField(row._localId, 'product_id', v)
                              if (Array.isArray(v) && !row.name) {
                                setNewRowField(row._localId, 'name', v[1])
                              }
                              // Auto-save on product set if we have a parentId
                              if (Array.isArray(v) && parentId != null) {
                                // small delay so the state update flushes
                                setTimeout(() => saveNewRow(row._localId), 0)
                              }
                            }}
                            className="h-8 text-sm"
                            placeholder="Pick a product..."
                          />
                          <Input
                            value={row.name || ''}
                            onChange={e => setNewRowField(row._localId, 'name', e.target.value)}
                            onBlur={() => saveNewRow(row._localId)}
                            placeholder="Description"
                            className="rounded-lg h-7 text-xs"
                          />
                        </div>
                      </TableCell>

                      {showAccount && (
                        <TableCell className="py-1.5">
                          <M2OInput
                            value={row.account_id}
                            model="account.account"
                            onChange={v => setNewRowField(row._localId, 'account_id', v)}
                            className="h-8 text-sm"
                            placeholder="Account..."
                          />
                        </TableCell>
                      )}

                      <TableCell className="text-right py-1.5">
                        <Input
                          type="number"
                          step="0.01"
                          value={(() => { const v = row[qtyField]; return typeof v === 'number' || typeof v === 'string' ? v : '' })()}
                          onChange={e => setNewRowField(row._localId, qtyField, e.target.value)}
                          onBlur={() => saveNewRow(row._localId)}
                          className="rounded-lg h-8 text-sm text-right font-mono"
                        />
                      </TableCell>

                      {showDelivered && <TableCell />}
                      {showReceived && <TableCell />}
                      {showInvoiced && <TableCell />}

                      <TableCell className="text-right py-1.5">
                        <Input
                          type="number"
                          step="0.01"
                          value={row.price_unit ?? ''}
                          onChange={e => setNewRowField(row._localId, 'price_unit', e.target.value)}
                          onBlur={() => saveNewRow(row._localId)}
                          className="rounded-lg h-8 text-sm text-right font-mono"
                        />
                      </TableCell>

                      {showDiscount && (
                        <TableCell className="text-right py-1.5">
                          <Input
                            type="number"
                            step="0.01"
                            value={row.discount ?? 0}
                            onChange={e => setNewRowField(row._localId, 'discount', e.target.value)}
                            onBlur={() => saveNewRow(row._localId)}
                            className="rounded-lg h-8 text-sm text-right font-mono"
                          />
                        </TableCell>
                      )}

                      {showLeadTime && (
                        <TableCell className="text-right py-1.5">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={row.customer_lead ?? 0}
                            onChange={e => setNewRowField(row._localId, 'customer_lead', e.target.value)}
                            onBlur={() => saveNewRow(row._localId)}
                            className="rounded-lg h-8 text-sm text-right font-mono"
                          />
                        </TableCell>
                      )}

                      <TableCell className="text-right font-mono text-sm font-medium py-1.5">
                        {currencySymbol}{Number(subtotal).toFixed(2)}
                      </TableCell>

                      <TableCell className="text-center py-1.5">
                        {isSaving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-muted-foreground" />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setNewRows(prev => prev.filter(r => r._localId !== row._localId))}
                            className="text-muted-foreground/60 hover:text-destructive transition-colors"
                            title="Discard new line"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add line + total footer */}
      <div className="flex items-center justify-between gap-4">
        {!readonly ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl gap-1.5"
            onClick={handleAddLine}
            disabled={parentId == null && !localMode}
            title={parentId == null && !localMode ? 'Save the order first to add lines' : 'Add a new line'}
          >
            <Plus className="h-3.5 w-3.5" /> Add line
          </Button>
        ) : <div />}

        <div className="text-sm text-muted-foreground">
          Lines subtotal:{' '}
          <span className="font-mono font-medium text-foreground">
            {currencySymbol}{totals.toFixed(2)}
          </span>
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete line"
        message={confirmDelete ? `Remove "${confirmDelete.name}" from this document?` : ''}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  )
}
