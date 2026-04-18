import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  Badge, Button, Input, Label, Skeleton,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Card, CardContent, cn,
  type BadgeVariant,
} from '@mashora/design-system'
import { Layers, Pencil, Save, X, Plus, Trash2, Loader2 } from 'lucide-react'
import { PageHeader, M2OInput, toast } from '@/components/shared'
import type { M2OValue } from '@/components/shared/OrderLinesEditor'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BomLine {
  id: number
  product_id: [number, string] | false
  product_qty: number
  product_uom_id: [number, string] | false
  sequence: number
}

interface BomDetailData {
  id: number
  code: string | false
  product_tmpl_id: [number, string]
  product_qty: number
  product_uom_id: [number, string]
  type: 'normal' | 'phantom' | 'subcontract'
  ready_to_produce?: 'all_available' | 'asap'
  sequence?: number
  company_id: [number, string]
  lines: BomLine[]
}

interface BomForm {
  code: string
  product_tmpl_id: number | null
  product_qty: number
  type: 'normal' | 'phantom' | 'subcontract'
  ready_to_produce: 'all_available' | 'asap'
  sequence: number
}

const TYPE_OPTIONS: { value: BomForm['type']; label: string }[] = [
  { value: 'normal',      label: 'Manufacture' },
  { value: 'phantom',     label: 'Kit' },
  { value: 'subcontract', label: 'Subcontract' },
]

const READY_OPTIONS: { value: BomForm['ready_to_produce']; label: string }[] = [
  { value: 'all_available', label: 'When all components are available' },
  { value: 'asap',          label: 'When components for first operation are available' },
]

const TYPE_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  normal:      { label: 'Manufacture', variant: 'default' },
  phantom:     { label: 'Kit',         variant: 'info' },
  subcontract: { label: 'Subcontract', variant: 'warning' },
}

const m2oId = (v: unknown): number | null =>
  Array.isArray(v) ? (v[0] as number) : (typeof v === 'number' ? v : null)
const m2oTuple = (v: unknown): [number, string] | false =>
  Array.isArray(v) ? (v as [number, string]) : false

function m2oName(val: [number, string] | false | undefined): string {
  return Array.isArray(val) ? val[1] : '—'
}

// ─── BomLinesEditor (inline, simpler than OrderLinesEditor) ───────────────────

interface LocalLine {
  _localId: string
  _isNew?: boolean
  id?: number
  product_id?: M2OValue
  product_qty?: number
  product_uom_id?: M2OValue
  sequence?: number
}

let _localCounter = 1
const nextLocal = () => `local-${_localCounter++}`

const selectCls = 'flex h-9 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors appearance-none'

function BomLinesEditor({
  lines,
  bomId,
  readonly,
  onChanged,
}: {
  lines: BomLine[]
  bomId: number | null
  readonly?: boolean
  onChanged: () => void
}) {
  const [newRows, setNewRows] = useState<LocalLine[]>([])
  const [edits, setEdits] = useState<Record<number, Partial<LocalLine>>>({})
  const [savingIds, setSavingIds] = useState<Set<string | number>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null)

  useEffect(() => {
    setNewRows([])
    setEdits({})
  }, [bomId])

  const setSaving = useCallback((key: string | number, on: boolean) => {
    setSavingIds(prev => {
      const next = new Set(prev)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])

  const createMut = useMutation({
    mutationFn: async (vals: Record<string, unknown>) => {
      const { data } = await erpClient.raw.post(`/model/mrp.bom.line/create`, { vals })
      return data
    },
  })
  const updateMut = useMutation({
    mutationFn: async ({ id, vals }: { id: number; vals: Record<string, unknown> }) => {
      const { data } = await erpClient.raw.put(`/model/mrp.bom.line/${id}`, { vals })
      return data
    },
  })
  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await erpClient.raw.delete(`/model/mrp.bom.line/${id}`)
    },
  })

  const handleAdd = () => {
    setNewRows(prev => [
      ...prev,
      {
        _localId: nextLocal(),
        _isNew: true,
        product_id: false,
        product_qty: 1,
        product_uom_id: false,
        sequence: 10 + (lines.length + prev.length),
      },
    ])
  }

  const saveNewRow = async (localId: string) => {
    const row = newRows.find(r => r._localId === localId)
    if (!row) return
    if (bomId == null) {
      toast.error('Save BOM first', 'Save the BOM before adding lines')
      return
    }
    const productId = m2oId(row.product_id)
    if (!productId) return
    setSaving(localId, true)
    try {
      const vals: Record<string, unknown> = {
        bom_id: bomId,
        product_id: productId,
        product_qty: Number(row.product_qty ?? 1) || 1,
        sequence: Number(row.sequence ?? 10) || 10,
      }
      const uomId = m2oId(row.product_uom_id)
      if (uomId) vals.product_uom_id = uomId
      await createMut.mutateAsync(vals)
      setNewRows(prev => prev.filter(r => r._localId !== localId))
      onChanged()
    } catch (e: unknown) {
      toast.error('Failed to add line', extractErrorMessage(e))
    } finally {
      setSaving(localId, false)
    }
  }

  const saveExistingRow = async (id: number) => {
    const patch = edits[id]
    if (!patch || Object.keys(patch).length === 0) return
    setSaving(id, true)
    try {
      const vals: Record<string, unknown> = {}
      if ('product_id' in patch) vals.product_id = m2oId(patch.product_id) || false
      if ('product_uom_id' in patch) vals.product_uom_id = m2oId(patch.product_uom_id) || false
      if ('product_qty' in patch) vals.product_qty = Number(patch.product_qty) || 0
      if ('sequence' in patch) vals.sequence = Number(patch.sequence) || 0
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

  const askDelete = (id: number, name: string) => setConfirmDelete({ id, name })

  const doDelete = async () => {
    if (!confirmDelete) return
    const { id } = confirmDelete
    setConfirmDelete(null)
    setSaving(id, true)
    try {
      await deleteMut.mutateAsync(id)
      onChanged()
    } catch (e: unknown) {
      toast.error('Failed to delete', extractErrorMessage(e))
    } finally {
      setSaving(id, false)
    }
  }

  const eff = (line: BomLine, field: string): unknown => {
    const e = edits[line.id] as Record<string, unknown> | undefined
    if (e && field in e) return e[field]
    return (line as unknown as Record<string, unknown>)[field]
  }
  const setEdit = (id: number, field: string, value: unknown) => {
    setEdits(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }))
  }
  const setNewField = (localId: string, field: string, value: unknown) => {
    setNewRows(prev => prev.map(r => r._localId === localId ? { ...r, [field]: value } : r))
  }

  const sorted = [...lines].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/40">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider w-[12%]">Seq</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider w-[45%]">Component</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-[15%]">Quantity</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider w-[20%]">UoM</TableHead>
              {!readonly && <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-center w-[8%]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 && newRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={readonly ? 4 : 5} className="h-20 text-center text-muted-foreground">
                  No components defined{!readonly && bomId != null ? ' — click "Add component" below' : ''}
                </TableCell>
              </TableRow>
            ) : (
              <>
                {sorted.map(line => {
                  const isSaving = savingIds.has(line.id)
                  const isDirty = !!edits[line.id]
                  return (
                    <TableRow key={line.id}
                      className={cn('border-border/30 hover:bg-muted/10', isDirty && 'bg-amber-50/40 dark:bg-amber-950/10')}>
                      <TableCell className="py-2 w-[12%]">
                        {readonly ? (
                          <span className="text-sm text-muted-foreground tabular-nums">{line.sequence ?? 0}</span>
                        ) : (
                          <Input
                            type="number"
                            value={(eff(line, 'sequence') as number | undefined) ?? 0}
                            onChange={e => setEdit(line.id, 'sequence', e.target.value)}
                            onBlur={() => saveExistingRow(line.id)}
                            className="rounded-lg h-8 text-sm tabular-nums"
                          />
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        {readonly ? (
                          <span className="text-sm font-medium">{m2oName(eff(line, 'product_id') as [number, string] | false | undefined)}</span>
                        ) : (
                          <M2OInput
                            value={eff(line, 'product_id') as M2OValue}
                            model="product.product"
                            onChange={v => setEdit(line.id, 'product_id', v)}
                            className="h-8 text-sm"
                            placeholder="Pick a component..."
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right py-2">
                        {readonly ? (
                          <span className="font-mono text-sm">{Number(line.product_qty).toFixed(2)}</span>
                        ) : (
                          <Input
                            type="number"
                            step="0.01"
                            value={(eff(line, 'product_qty') as number | undefined) ?? 0}
                            onChange={e => setEdit(line.id, 'product_qty', e.target.value)}
                            onBlur={() => saveExistingRow(line.id)}
                            className="rounded-lg h-8 text-sm text-right font-mono"
                          />
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        {readonly ? (
                          <span className="text-sm text-muted-foreground">{m2oName(line.product_uom_id)}</span>
                        ) : (
                          <M2OInput
                            value={eff(line, 'product_uom_id') as M2OValue}
                            model="uom.uom"
                            onChange={v => setEdit(line.id, 'product_uom_id', v)}
                            className="h-8 text-sm"
                            placeholder="UoM..."
                          />
                        )}
                      </TableCell>
                      {!readonly && (
                        <TableCell className="text-center py-2">
                          {isSaving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-muted-foreground" />
                          ) : (
                            <button
                              type="button"
                              onClick={() => askDelete(line.id, m2oName(eff(line, 'product_id') as [number, string] | false | undefined) || `Line #${line.id}`)}
                              className="text-muted-foreground/60 hover:text-destructive transition-colors"
                              title="Delete component"
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
                  return (
                    <TableRow key={row._localId} className="bg-emerald-50/30 dark:bg-emerald-950/10 border-border/30">
                      <TableCell className="py-2 w-[12%]">
                        <Input
                          type="number"
                          value={row.sequence ?? 0}
                          onChange={e => setNewField(row._localId, 'sequence', parseInt(e.target.value) || 0)}
                          className="rounded-lg h-8 text-sm tabular-nums"
                        />
                      </TableCell>
                      <TableCell className="py-2">
                        <M2OInput
                          value={row.product_id}
                          model="product.product"
                          onChange={v => {
                            setNewField(row._localId, 'product_id', v)
                            if (Array.isArray(v) && bomId != null) {
                              setTimeout(() => saveNewRow(row._localId), 0)
                            }
                          }}
                          className="h-8 text-sm"
                          placeholder="Pick a component..."
                        />
                      </TableCell>
                      <TableCell className="text-right py-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={row.product_qty ?? 1}
                          onChange={e => setNewField(row._localId, 'product_qty', parseFloat(e.target.value) || 0)}
                          onBlur={() => saveNewRow(row._localId)}
                          className="rounded-lg h-8 text-sm text-right font-mono"
                        />
                      </TableCell>
                      <TableCell className="py-2">
                        <M2OInput
                          value={row.product_uom_id}
                          model="uom.uom"
                          onChange={v => setNewField(row._localId, 'product_uom_id', v)}
                          className="h-8 text-sm"
                          placeholder="UoM..."
                        />
                      </TableCell>
                      <TableCell className="text-center py-2">
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

      {!readonly && (
        <div>
          <Button
            type="button" variant="outline" size="sm"
            className="rounded-xl gap-1.5"
            onClick={handleAdd}
            disabled={bomId == null}
            title={bomId == null ? 'Save the BOM first' : 'Add a component'}
          >
            <Plus className="h-3.5 w-3.5" /> Add component
          </Button>
        </div>
      )}

      {/* Tiny inline confirm */}
      {confirmDelete && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 flex items-center justify-between gap-3">
          <p className="text-sm">
            Remove <span className="font-medium">{confirmDelete.name}</span> from this BOM?
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button size="sm" variant="destructive" onClick={doDelete}>Delete</Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function BomDetailView({ id }: { id: number }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<BomForm>({
    code: '', product_tmpl_id: null, product_qty: 1,
    type: 'normal', ready_to_produce: 'all_available', sequence: 0,
  })
  const [productTmpl, setProductTmpl] = useState<any>(false)
  const [saving, setSaving] = useState(false)

  const { data: bom, isLoading } = useQuery<BomDetailData>({
    queryKey: ['bom', id],
    queryFn: () => erpClient.raw.get(`/manufacturing/boms/${id}`).then(r => r.data),
    enabled: !!id && id > 0,
  })

  useEffect(() => {
    if (!bom) return
    setForm({
      code: bom.code || '',
      product_tmpl_id: m2oId(bom.product_tmpl_id),
      product_qty: Number(bom.product_qty) || 1,
      type: (bom.type as BomForm['type']) || 'normal',
      ready_to_produce: (bom.ready_to_produce as BomForm['ready_to_produce']) || 'all_available',
      sequence: Number(bom.sequence) || 0,
    })
    setProductTmpl(m2oTuple(bom.product_tmpl_id))
  }, [bom])

  function set<K extends keyof BomForm>(key: K, value: BomForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!form.product_tmpl_id) {
      toast.error('Product required', 'Choose a product for this BOM')
      return
    }
    setSaving(true)
    try {
      const vals: Record<string, unknown> = {
        code: form.code || false,
        product_tmpl_id: form.product_tmpl_id,
        product_qty: form.product_qty,
        type: form.type,
        ready_to_produce: form.ready_to_produce,
        sequence: form.sequence,
      }
      await erpClient.raw.put(`/model/mrp.bom/${id}`, { vals })
      toast.success('BOM saved')
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['bom', id] })
    } catch (e: unknown) {
      toast.error('Save failed', extractErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || !bom) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  }

  const typeBadge = TYPE_BADGE[bom.type] || { label: bom.type, variant: 'secondary' as BadgeVariant }
  const title = bom.code
    ? `${m2oName(bom.product_tmpl_id)} · ${bom.code}`
    : m2oName(bom.product_tmpl_id)

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle="Bill of Materials"
        backTo="/admin/manufacturing/bom"
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={typeBadge.variant}>{typeBadge.label}</Badge>
            {!editing ? (
              <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            ) : (
              <>
                <Button size="sm" className="rounded-xl gap-1.5" onClick={handleSave} disabled={saving}>
                  <Save className="h-3.5 w-3.5" /> {saving ? 'Saving...' : 'Save'}
                </Button>
                <Button size="sm" variant="ghost" className="rounded-xl gap-1.5" onClick={() => {
                  setEditing(false)
                  if (bom) {
                    setForm({
                      code: bom.code || '',
                      product_tmpl_id: m2oId(bom.product_tmpl_id),
                      product_qty: Number(bom.product_qty) || 1,
                      type: (bom.type as BomForm['type']) || 'normal',
                      ready_to_produce: (bom.ready_to_produce as BomForm['ready_to_produce']) || 'all_available',
                      sequence: Number(bom.sequence) || 0,
                    })
                    setProductTmpl(m2oTuple(bom.product_tmpl_id))
                  }
                }}>
                  <X className="h-3.5 w-3.5" /> Cancel
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* General info card */}
      {editing ? (
        <Card className="rounded-2xl">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-sm font-semibold mb-1">General Information</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="code">Reference</Label>
                <Input id="code" value={form.code} onChange={e => set('code', e.target.value)} placeholder="BOM-001" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sequence">Sequence</Label>
                <Input id="sequence" type="number" value={form.sequence}
                  onChange={e => set('sequence', parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label>Product</Label>
                <M2OInput
                  value={productTmpl}
                  model="product.template"
                  onChange={v => { setProductTmpl(v); set('product_tmpl_id', m2oId(v)) }}
                  placeholder="Choose product..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product_qty">Quantity</Label>
                <Input id="product_qty" type="number" step="0.01" min="0"
                  value={form.product_qty}
                  onChange={e => set('product_qty', parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">BOM Type</Label>
                <select id="type" value={form.type}
                  onChange={e => set('type', e.target.value as BomForm['type'])}
                  className={selectCls}>
                  {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ready_to_produce">Ready to Produce</Label>
                <select id="ready_to_produce" value={form.ready_to_produce}
                  onChange={e => set('ready_to_produce', e.target.value as BomForm['ready_to_produce'])}
                  className={selectCls}>
                  {READY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            General Information
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <InfoLine label="Product">{m2oName(bom.product_tmpl_id)}</InfoLine>
              <InfoLine label="Reference">{bom.code || '—'}</InfoLine>
              <InfoLine label="Quantity">{bom.product_qty} {m2oName(bom.product_uom_id)}</InfoLine>
            </div>
            <div className="space-y-3">
              <InfoLine label="Type">
                <Badge variant={typeBadge.variant} className="rounded-full text-xs">
                  {typeBadge.label}
                </Badge>
              </InfoLine>
              <InfoLine label="Sequence">{bom.sequence ?? 0}</InfoLine>
              <InfoLine label="Company">{m2oName(bom.company_id)}</InfoLine>
            </div>
          </div>
        </div>
      )}

      {/* Components */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Components
          </p>
          {!editing && (bom.lines?.length ?? 0) === 0 && (
            <Layers className="h-4 w-4 opacity-30" />
          )}
        </div>
        <BomLinesEditor
          lines={bom.lines ?? []}
          bomId={bom.id}
          readonly={!editing}
          onChanged={() => queryClient.invalidateQueries({ queryKey: ['bom', id] })}
        />
      </div>

      <div className="text-xs text-muted-foreground">
        <button
          onClick={() => navigate('/admin/manufacturing/bom')}
          className="hover:text-foreground transition-colors"
        >
          ← All Bills of Materials
        </button>
      </div>
    </div>
  )
}

function InfoLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-1.5 border-b border-border/20 last:border-0">
      <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground pt-0.5">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  )
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function BomDetail() {
  const { id } = useParams<{ id: string }>()
  const numId = parseInt(id || '0')

  if (!numId) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <Layers className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Invalid Bill of Materials ID</p>
      </div>
    )
  }

  return <BomDetailView id={numId} />
}
