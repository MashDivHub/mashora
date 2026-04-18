import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Input, Button, Badge, Skeleton, Textarea,
  Tabs, TabsList, TabsTrigger, TabsContent,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@mashora/design-system'
import { Save, X, Pencil, ScanBarcode } from 'lucide-react'
import { PageHeader, M2OInput, toast } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'
import type { M2OValue } from '@/components/shared/OrderLinesEditor'

interface MoveLineRow {
  id: number
  date?: string | false
  picking_id?: [number, string] | false
  location_id?: [number, string] | false
  location_dest_id?: [number, string] | false
  qty_done?: number
  product_uom_id?: [number, string] | false
}

interface QuantRow {
  id: number
  location_id?: [number, string] | false
  quantity?: number
  reserved_quantity?: number
}

interface LotForm {
  name: string
  ref: string
  product_id: M2OValue
  expiration_date: string
  removal_date: string
  use_date: string
  alert_date: string
  note: string
}

const EMPTY: LotForm = {
  name: '', ref: '', product_id: false,
  expiration_date: '', removal_date: '', use_date: '', alert_date: '',
  note: '',
}

const LOT_FIELDS = [
  'id', 'name', 'ref', 'product_id', 'product_qty', 'company_id',
  'expiration_date', 'removal_date', 'alert_date', 'use_date', 'note',
]

const MOVE_LINE_FIELDS = [
  'id', 'date', 'picking_id', 'location_id', 'location_dest_id', 'qty_done', 'product_uom_id',
]

const QUANT_FIELDS = ['id', 'location_id', 'quantity', 'reserved_quantity']

function fmtDate(v: string | undefined | false) {
  if (!v) return '—'
  try { return new Date(v).toLocaleDateString() } catch { return String(v) }
}

function dateInputVal(v: unknown): string {
  if (!v || v === false) return ''
  // Odoo/Mashora dates may be 'YYYY-MM-DD' or include time
  const s = String(v)
  return s.length >= 10 ? s.slice(0, 10) : s
}

export default function LotSerialDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id || id === 'new'
  const recordId = isNew ? null : parseInt(id || '0')
  const [editing, setEditing] = useState(isNew)
  const [form, setForm] = useState<LotForm>(EMPTY)
  const [tab, setTab] = useState('info')

  const { data: lot, isLoading } = useQuery({
    queryKey: ['stock-lot', recordId],
    queryFn: async () => {
      if (!recordId) return null
      const { data } = await erpClient.raw.get(`/model/stock.lot/${recordId}`)
      return data
    },
    enabled: !!recordId,
  })

  useEffect(() => {
    if (lot) {
      setForm({
        name: lot.name || '',
        ref: lot.ref || '',
        product_id: lot.product_id || false,
        expiration_date: dateInputVal(lot.expiration_date),
        removal_date: dateInputVal(lot.removal_date),
        use_date: dateInputVal(lot.use_date),
        alert_date: dateInputVal(lot.alert_date),
        note: lot.note || '',
      })
    }
  }, [lot])

  const setField = useCallback(<K extends keyof LotForm>(k: K, v: LotForm[K]) => {
    setForm(p => ({ ...p, [k]: v }))
  }, [])

  // Traceability — stock move lines
  const { data: moveLines } = useQuery({
    queryKey: ['stock-lot-moves', recordId],
    queryFn: async () => {
      if (!recordId) return { records: [], total: 0 }
      const { data } = await erpClient.raw.post('/model/stock.move.line', {
        domain: [['lot_id', '=', recordId]],
        fields: MOVE_LINE_FIELDS,
        order: 'date desc',
        limit: 200,
      })
      return data
    },
    enabled: !!recordId,
  })

  // Quants
  const { data: quants } = useQuery({
    queryKey: ['stock-lot-quants', recordId],
    queryFn: async () => {
      if (!recordId) return { records: [], total: 0 }
      const { data } = await erpClient.raw.post('/model/stock.quant', {
        domain: [['lot_id', '=', recordId]],
        fields: QUANT_FIELDS,
        order: 'location_id asc',
        limit: 200,
      })
      return data
    },
    enabled: !!recordId,
  })

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('Name is required')
      const productId = Array.isArray(form.product_id) ? form.product_id[0] : form.product_id
      if (!productId) throw new Error('Product is required')

      const vals: Record<string, unknown> = {
        name: form.name.trim(),
        ref: form.ref || false,
        product_id: productId,
        expiration_date: form.expiration_date || false,
        removal_date: form.removal_date || false,
        use_date: form.use_date || false,
        alert_date: form.alert_date || false,
        note: form.note || false,
      }

      if (isNew) {
        const { data } = await erpClient.raw.post('/inventory/lots/create', { vals })
        return data
      }
      const { data } = await erpClient.raw.put(`/model/stock.lot/${recordId}`, { vals })
      return data
    },
    onSuccess: (data) => {
      toast.success('Saved', 'Lot/Serial saved successfully')
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['stock-lot'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-lots'] })
      if (isNew && data?.id) navigate(`/admin/inventory/lots/${data.id}`, { replace: true })
    },
    onError: (e: unknown) => {
      toast.error('Save Failed', extractErrorMessage(e))
    },
  })

  if (recordId && isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  const productName = Array.isArray(form.product_id) ? form.product_id[1] : ''
  const totalQty = Number(lot?.product_qty ?? 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title={isNew ? 'New Lot / Serial' : (form.name || 'Lot / Serial')}
        backTo="/admin/inventory/lots"
        actions={
          <div className="flex items-center gap-2">
            {!isNew && !editing && (
              <Badge variant="secondary" className="text-xs">
                On Hand: <span className="ml-1 font-mono">{totalQty.toFixed(2)}</span>
              </Badge>
            )}
            {editing ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-xl gap-1.5"
                  onClick={() => {
                    if (isNew) { navigate(-1); return }
                    setEditing(false)
                  }}
                  disabled={saveMut.isPending}
                >
                  <X className="h-3.5 w-3.5" /> Discard
                </Button>
                <Button
                  size="sm"
                  className="rounded-xl gap-1.5"
                  onClick={() => saveMut.mutate()}
                  disabled={saveMut.isPending}
                >
                  <Save className="h-3.5 w-3.5" />
                  {saveMut.isPending ? 'Saving...' : 'Save'}
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

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="info">Information</TabsTrigger>
          <TabsTrigger value="trace" disabled={isNew}>Traceability</TabsTrigger>
          <TabsTrigger value="quants" disabled={isNew}>Quants</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-5">
              <div className="space-y-5">
                <Field label="Name" required>
                  {editing ? (
                    <Input
                      value={form.name}
                      onChange={e => setField('name', e.target.value)}
                      className="rounded-xl h-9"
                      placeholder="Lot or Serial number"
                    />
                  ) : (
                    <span className="text-sm font-mono">{form.name || '—'}</span>
                  )}
                </Field>
                <Field label="Internal Reference">
                  {editing ? (
                    <Input
                      value={form.ref}
                      onChange={e => setField('ref', e.target.value)}
                      className="rounded-xl h-9"
                    />
                  ) : (
                    <span className="text-sm">{form.ref || '—'}</span>
                  )}
                </Field>
                <Field label="Product" required>
                  {editing ? (
                    <M2OInput
                      value={form.product_id}
                      model="product.product"
                      onChange={v => setField('product_id', v)}
                      placeholder="Select product..."
                    />
                  ) : (
                    <span className="text-sm">{productName || '—'}</span>
                  )}
                </Field>
              </div>

              <div className="space-y-5">
                <Field label="Expiration Date">
                  {editing ? (
                    <Input
                      type="date"
                      value={form.expiration_date}
                      onChange={e => setField('expiration_date', e.target.value)}
                      className="rounded-xl h-9"
                    />
                  ) : (
                    <span className="text-sm">{fmtDate(form.expiration_date)}</span>
                  )}
                </Field>
                <Field label="Best Before Date (Use Date)">
                  {editing ? (
                    <Input
                      type="date"
                      value={form.use_date}
                      onChange={e => setField('use_date', e.target.value)}
                      className="rounded-xl h-9"
                    />
                  ) : (
                    <span className="text-sm">{fmtDate(form.use_date)}</span>
                  )}
                </Field>
                <Field label="Removal Date">
                  {editing ? (
                    <Input
                      type="date"
                      value={form.removal_date}
                      onChange={e => setField('removal_date', e.target.value)}
                      className="rounded-xl h-9"
                    />
                  ) : (
                    <span className="text-sm">{fmtDate(form.removal_date)}</span>
                  )}
                </Field>
                <Field label="Alert Date">
                  {editing ? (
                    <Input
                      type="date"
                      value={form.alert_date}
                      onChange={e => setField('alert_date', e.target.value)}
                      className="rounded-xl h-9"
                    />
                  ) : (
                    <span className="text-sm">{fmtDate(form.alert_date)}</span>
                  )}
                </Field>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-border/30">
              <Field label="Note">
                {editing ? (
                  <Textarea
                    value={form.note}
                    onChange={e => setField('note', e.target.value)}
                    className="rounded-xl min-h-[100px]"
                    placeholder="Internal notes..."
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{form.note || '—'}</p>
                )}
              </Field>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="trace" className="mt-4">
          <div className="rounded-2xl border border-border/30 bg-card/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/40">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Date</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Reference</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">From</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">To</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!moveLines?.records?.length ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2 py-4">
                        <ScanBarcode className="h-6 w-6 opacity-40" />
                        <span className="text-sm">No movement history</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (moveLines.records as MoveLineRow[]).map((ml) => (
                  <TableRow key={ml.id} className="border-border/30 hover:bg-muted/10">
                    <TableCell className="text-sm">{fmtDate(ml.date)}</TableCell>
                    <TableCell className="text-sm">
                      {Array.isArray(ml.picking_id) ? ml.picking_id[1] : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {Array.isArray(ml.location_id) ? ml.location_id[1] : ''}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {Array.isArray(ml.location_dest_id) ? ml.location_dest_id[1] : ''}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {Number(ml.qty_done || 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="quants" className="mt-4">
          <div className="rounded-2xl border border-border/30 bg-card/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/40">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Location</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Quantity</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Reserved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!quants?.records?.length ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-20 text-center text-muted-foreground">
                      No stock for this lot
                    </TableCell>
                  </TableRow>
                ) : (quants.records as QuantRow[]).map((q) => (
                  <TableRow key={q.id} className="border-border/30 hover:bg-muted/10">
                    <TableCell className="text-sm">
                      {Array.isArray(q.location_id) ? q.location_id[1] : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {Number(q.quantity || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">
                      {Number(q.reserved_quantity || 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
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
