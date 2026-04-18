import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input, Button, Skeleton } from '@mashora/design-system'
import { Send, CheckCircle, Printer, Eye, FileText, Truck, XCircle, Lock, Unlock, RotateCcw, FilePlus, PackageCheck, ThumbsUp } from 'lucide-react'
import { RecordForm, FormField, ReadonlyField, StatusBar, OrderLinesEditor, EmailComposer, AttachmentSection, PrintableReport, M2OInput, toast, type SmartButton, type FormTab } from '@/components/shared'
import Chatter from '@/components/Chatter'
import type { LocalLine } from '@/components/shared/OrderLinesEditor'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

interface PurchaseLine {
  id: number
  sequence?: number
  product_id?: [number, string] | false
  name?: string
  product_qty?: number
  qty_received?: number
  qty_invoiced?: number
  price_unit?: number
  price_subtotal?: number
  tax_ids?: number[]
  display_type?: string
  date_planned?: string | false
  [k: string]: unknown
}

interface PurchaseOrderForm {
  id?: number | null
  name?: string
  partner_id?: [number, string] | false | number
  state?: string
  date_order?: string | false
  date_planned?: string | false
  date_approve?: string | false
  amount_untaxed?: number
  amount_tax?: number
  amount_total?: number
  currency_id?: [number, string] | false
  user_id?: [number, string] | false | number
  payment_term_id?: [number, string] | false | number
  fiscal_position_id?: [number, string] | false | number
  partner_ref?: string
  origin?: string
  note?: string
  order_line?: number[]
  invoice_status?: string
  receipt_status?: string
  invoice_count?: number
  incoming_picking_count?: number
  picking_type_id?: [number, string] | false | number
  company_id?: [number, string] | false
  locked?: boolean
  [key: string]: unknown
}

interface NameSearchResult { id: number; display_name: string }

const FORM_FIELDS = [
  'id', 'name', 'partner_id', 'state', 'date_order', 'date_planned', 'date_approve',
  'amount_untaxed', 'amount_tax', 'amount_total', 'currency_id',
  'user_id', 'payment_term_id', 'fiscal_position_id',
  'partner_ref', 'origin', 'order_line',
  'invoice_status', 'receipt_status', 'invoice_count', 'incoming_picking_count',
  'picking_type_id', 'company_id',
]

const LINE_FIELDS = [
  'id', 'sequence', 'product_id', 'name', 'product_qty',
  'qty_received', 'qty_invoiced', 'price_unit', 'price_subtotal',
  'tax_ids', 'display_type', 'date_planned',
]

const STATES = [
  { key: 'draft', label: 'RFQ' },
  { key: 'sent', label: 'RFQ Sent' },
  { key: 'to approve', label: 'To Approve' },
  { key: 'purchase', label: 'Purchase Order', color: 'success' as const },
  { key: 'cancel', label: 'Cancelled' },
]

// Print-context colors. Inline styles are intentional for printable HTML
// (the print window does not always have Tailwind's theme vars available),
// so hexes stay as literals — consolidated here for a single source of truth.
const PRINT_COLORS = {
  muted: '#666',
  subtle: '#999',
} as const

export default function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id || id === 'new'
  const recordId = isNew ? null : parseInt(id || '0')
  const [editing, setEditing] = useState(isNew)
  const [form, setForm] = useState<PurchaseOrderForm>({})
  const [lines, setLines] = useState<PurchaseLine[]>([])
  // Lines buffered locally before the RFQ exists on the server.
  const [localLines, setLocalLines] = useState<LocalLine[]>([])
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (navTimerRef.current) clearTimeout(navTimerRef.current) }, [])

  const { data: record, isLoading } = useQuery<PurchaseOrderForm & { partner_email?: string; company_id?: [number, string] | false }>({
    queryKey: ['purchase-order', recordId],
    queryFn: async () => {
      if (isNew) {
        const { data } = await erpClient.raw.post('/model/purchase.order/defaults', { fields: FORM_FIELDS })
        return { ...data, id: null, state: 'draft', order_line: [] }
      }
      const { data } = await erpClient.raw.get(`/model/purchase.order/${recordId}`)
      return data
    },
  })

  const { data: lineData } = useQuery({
    queryKey: ['purchase-order-lines', recordId],
    queryFn: async () => {
      if (!recordId) return []
      const { data } = await erpClient.raw.post('/model/purchase.order.line', {
        domain: [['order_id', '=', recordId]], fields: LINE_FIELDS, order: 'sequence asc, id asc', limit: 200,
      })
      return data.records || []
    },
    enabled: !!recordId,
  })

  useEffect(() => { if (record) { setForm({ ...record }); setLines(lineData || []) } }, [record, lineData])
  const setField = useCallback((n: string, v: unknown) => { setForm(p => ({ ...p, [n]: v })) }, [])

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {}
    const partnerId = Array.isArray(form.partner_id) ? form.partner_id[0] : form.partner_id
    if (!partnerId) errs.partner_id = 'Vendor is required'
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      toast.error('Validation Error', Object.values(errs).join(', '))
      return false
    }
    return true
  }, [form])

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!validate()) throw new Error('Validation failed')
      const vals: Record<string, unknown> = {}
      for (const f of ['partner_ref', 'origin', 'date_planned']) {
        if (form[f] !== record?.[f]) vals[f] = form[f] ?? false
      }
      for (const f of ['partner_id', 'user_id', 'payment_term_id', 'fiscal_position_id', 'picking_type_id']) {
        const fv = form[f]
        const rv = record?.[f]
        const nv = Array.isArray(fv) ? fv[0] : fv
        const ov = Array.isArray(rv) ? rv[0] : rv
        if (nv !== ov) vals[f] = nv || false
      }
      if (isNew) {
        // Build a typed PurchaseOrderCreate payload so lines ride along.
        const partnerId = Array.isArray(form.partner_id) ? form.partner_id[0] : form.partner_id
        const body: Record<string, unknown> = {
          partner_id: partnerId,
          date_planned: form.date_planned || undefined,
          partner_ref: form.partner_ref || undefined,
          origin: form.origin || undefined,
          note: form.note || undefined,
          user_id: (Array.isArray(form.user_id) ? form.user_id[0] : form.user_id) || undefined,
          payment_term_id: (Array.isArray(form.payment_term_id) ? form.payment_term_id[0] : form.payment_term_id) || undefined,
          fiscal_position_id: (Array.isArray(form.fiscal_position_id) ? form.fiscal_position_id[0] : form.fiscal_position_id) || undefined,
          picking_type_id: (Array.isArray(form.picking_type_id) ? form.picking_type_id[0] : form.picking_type_id) || undefined,
        }
        for (const k of Object.keys(body)) if (body[k] === undefined) delete body[k]
        const linesPayload = localLines
          .map((r) => {
            const pid = Array.isArray(r.product_id) ? r.product_id[0] : r.product_id
            if (!pid) return null
            return {
              product_id: pid,
              name: r.name || (Array.isArray(r.product_id) ? r.product_id[1] : ''),
              product_qty: Number(r.product_qty ?? 1) || 0,
              price_unit: Number(r.price_unit ?? 0) || 0,
            }
          })
          .filter(Boolean)
        if (linesPayload.length > 0) body.lines = linesPayload
        const { data } = await erpClient.raw.post('/purchase/orders/create', body)
        return data
      }
      const { data } = await erpClient.raw.put(`/model/purchase.order/${recordId}`, { vals })
      return data
    },
    onSuccess: (data) => {
      setEditing(false)
      setErrors({})
      toast.success('Saved', 'Purchase order saved successfully')
      queryClient.invalidateQueries({ queryKey: ['purchase-order'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      if (isNew && data?.id) navigate(`/admin/purchase/orders/${data.id}`, { replace: true })
    },
    onError: (e: unknown) => {
      const msg = extractErrorMessage(e)
      if (msg !== 'Validation failed') {
        toast.error('Save Failed', msg)
      }
    },
  })

  // ---------- Action mutations ----------
  const callOrderAction = useCallback(async (action: string, label: string) => {
    if (!recordId) return null
    try {
      const { data } = await erpClient.raw.post(`/purchase/orders/${recordId}/${action}`)
      toast.success(label, `${label} executed successfully`)
      queryClient.invalidateQueries({ queryKey: ['purchase-order', recordId] })
      queryClient.invalidateQueries({ queryKey: ['purchase-order-lines', recordId] })
      return data
    } catch (e: unknown) {
      toast.error(`${label} Failed`, extractErrorMessage(e))
      return null
    }
  }, [recordId, queryClient])

  // Email composer state — replaces the old confirm-then-call backend flow
  // for sending RFQs (the backend's `/send` action sends a templated email
  // server-side; the composer lets users craft it interactively).
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailDefaults, setEmailDefaults] = useState<{ to: string[]; subject: string; body: string }>({ to: [], subject: '', body: '' })

  const [previewOpen, setPreviewOpen] = useState(false)

  const sendMut = useMutation({
    mutationFn: async () => callOrderAction('send', 'Send RFQ'),
  })
  const confirmMut = useMutation({
    mutationFn: async () => callOrderAction('confirm', 'Confirm Order'),
  })
  const approveMut = useMutation({
    mutationFn: async () => callOrderAction('approve', 'Approve'),
  })
  const cancelMut = useMutation({
    mutationFn: async () => callOrderAction('cancel', 'Cancel'),
  })
  const draftMut = useMutation({
    mutationFn: async () => callOrderAction('draft', 'Set to Draft'),
  })
  const lockMut = useMutation({
    mutationFn: async (lock: boolean) => callOrderAction(lock ? 'lock' : 'unlock', lock ? 'Lock' : 'Unlock'),
  })
  const createBillMut = useMutation({
    mutationFn: async () => {
      if (!recordId) throw new Error('No record')
      const { data } = await erpClient.raw.post(`/purchase/orders/${recordId}/create-bill`)
      return data
    },
    onSuccess: (data: unknown) => {
      const d = (data ?? {}) as { invoice_id?: number; id?: number; bill_id?: number; invoice_ids?: number[] }
      const billId = d.invoice_id || d.id || d.bill_id || (Array.isArray(d.invoice_ids) ? d.invoice_ids[0] : null)
      if (billId) {
        toast.success('Bill Created', `Bill #${billId} created — opening...`)
        if (navTimerRef.current) clearTimeout(navTimerRef.current)
        navTimerRef.current = setTimeout(() => navigate(`/admin/invoicing/invoices/${billId}`), 800)
      } else {
        toast.success('Bill Created', 'Vendor bill was created successfully')
      }
      queryClient.invalidateQueries({ queryKey: ['purchase-order', recordId] })
    },
    onError: (e: unknown) => toast.error('Bill Creation Failed', extractErrorMessage(e)),
  })

  const [m2oResults, setM2oResults] = useState<Record<string, NameSearchResult[]>>({})
  const searchM2o = useCallback(async (model: string, q: string, field: string) => {
    if (!q) { setM2oResults(p => ({ ...p, [field]: [] })); return }
    try {
      const { data } = await erpClient.raw.post(`/model/${model}/name_search`, { name: q, limit: 8 })
      setM2oResults(p => ({ ...p, [field]: data.results || [] }))
    } catch { setM2oResults(p => ({ ...p, [field]: [] })) }
  }, [])

  if (isLoading || !record) {
    return <div className="space-y-4"><Skeleton className="h-10 w-full rounded-xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>
  }

  const m2oVal = (v: unknown) => Array.isArray(v) ? String(v[1]) : ''
  const localUntaxed = localLines.reduce((s: number, r) => {
    const pid = Array.isArray(r.product_id) ? r.product_id[0] : r.product_id
    if (!pid) return s
    const q = Number(r.product_qty) || 0
    const p = Number(r.price_unit) || 0
    return s + q * p
  }, 0)
  const state = form.state || 'draft'
  const isDraft = state === 'draft'
  const isSent = state === 'sent'
  const isToApprove = state === 'to approve'
  const isPurchase = state === 'purchase'
  const isDone = state === 'done'
  const isCancel = state === 'cancel'
  const isLocked = !!form.locked

  const smartButtons: SmartButton[] = [
    (form.incoming_picking_count ?? 0) > 0 && { label: 'Receipts', value: form.incoming_picking_count!, icon: <Truck className="h-5 w-5" /> },
    (form.invoice_count ?? 0) > 0 && { label: 'Bills', value: form.invoice_count!, icon: <FileText className="h-5 w-5" /> },
  ].filter(Boolean) as SmartButton[]

  const M2O = ({ field, model, label, required, errorMsg, onSelect, help }: { field: string; model: string; label: string; required?: boolean; errorMsg?: string; onSelect?: () => void; help?: string }) => {
    if (!editing) return <ReadonlyField label={label} value={m2oVal(form[field])} />
    return (
      <FormField label={label} required={required} help={help}>
        <M2OInput
          value={form[field]}
          model={model}
          onChange={v => { setField(field, v); onSelect?.() }}
          className={errorMsg ? 'ring-2 ring-red-500/50' : ''}
        />
        {errorMsg && <p className="text-xs text-destructive mt-1">{errorMsg}</p>}
      </FormField>
    )
  }

  // TF is a render function (NOT a component) — called inline to avoid
  // React remounting the <Input> on every parent render (which would steal
  // focus after each keystroke).
  const TF = (field: string, label: string, opts: { type?: string; help?: string } = {}) => {
    const fv = form[field]
    const strVal = (typeof fv === 'string' || typeof fv === 'number') ? fv : ''
    if (!editing) return <ReadonlyField label={label} value={strVal || undefined} />
    return (
      <FormField label={label} help={opts.help}>
        <Input type={opts.type || 'text'} value={strVal} onChange={e => setField(field, e.target.value)} className="rounded-xl h-9" />
      </FormField>
    )
  }

  const linesLocked = state === 'cancel' || state === 'done' || isLocked

  const tabs: FormTab[] = [
    {
      key: 'lines', label: 'Products',
      content: (
        <div className="space-y-3">
          <OrderLinesEditor
            lines={isNew ? [] : lines}
            parentId={recordId}
            parentField="order_id"
            lineModel="purchase.order.line"
            qtyField="product_qty"
            showReceived={isPurchase}
            showInvoiced={isPurchase}
            readonly={linesLocked}
            onChanged={() => {
              queryClient.invalidateQueries({ queryKey: ['purchase-order', recordId] })
              queryClient.invalidateQueries({ queryKey: ['purchase-order-lines', recordId] })
            }}
            onLocalLinesChange={isNew ? setLocalLines : undefined}
          />
          <div className="flex justify-end">
            <div className="w-64 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Untaxed</span><span className="font-mono">${isNew ? localUntaxed.toFixed(2) : Number(form.amount_untaxed || 0).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Taxes</span><span className="font-mono">${isNew ? '0.00' : Number(form.amount_tax || 0).toFixed(2)}</span></div>
              <div className="flex justify-between border-t border-border/40 pt-1.5 font-semibold text-base"><span>Total</span><span className="font-mono">${isNew ? localUntaxed.toFixed(2) : Number(form.amount_total || 0).toFixed(2)}</span></div>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'other', label: 'Other Info',
      content: (
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-2">
          <div className="space-y-2">
            <M2O field="user_id" model="res.users" label="Buyer" help="Person responsible for this purchase. Used for approval workflows and buyer-performance reports." />
            {TF("origin", "Source Document", { help: "Reference to the document that triggered this PO (e.g. a sales order, a reordering rule)." })}
            {TF("partner_ref", "Vendor Reference", { help: "The vendor's own quote or order number — helpful when matching their future bill to your PO." })}
          </div>
          <div className="space-y-2">
            <M2O field="fiscal_position_id" model="account.fiscal.position" label="Fiscal Position" help="Overrides default tax and account mappings. Use for imports, tax-exempt purchases, or inter-company buys." />
            <M2O field="payment_term_id" model="account.payment.term" label="Payment Terms" help="When you must pay the vendor (e.g. 'Net 30'). Drives the bill's due date." />
            <M2O field="picking_type_id" model="stock.picking.type" label="Deliver To" help="Which warehouse/receiving operation will take delivery of these goods." />
          </div>
        </div>
      ),
    },
    {
      key: 'attachments', label: 'Attachments',
      content: <AttachmentSection resModel="purchase.order" resId={recordId} />,
    },
  ]

  const cancelWithConfirm = () => {
    if (!confirm('Cancel this purchase order?')) return
    cancelMut.mutate()
  }
  // Suppress "unused" of legacy direct-send mutation; the EmailComposer
  // handles actual delivery, but the backend `/send` endpoint still flips
  // the state to `sent` so we keep it for the post-send onSent callback.
  void sendMut

  const openEmailDialog = () => {
    const partnerEmail = record?.partner_email || ''
    const refLabel = form.name && form.name !== '/' ? form.name : ''
    setEmailDefaults({
      to: partnerEmail ? [partnerEmail] : [],
      subject: `Request for Quotation ${refLabel}`.trim(),
      body: `<p>Dear vendor,</p><p>Please find attached our request for quotation${refLabel ? ` ${refLabel}` : ''}.</p><p>Best regards,</p>`,
    })
    setEmailOpen(true)
  }

  return (
    <>
    <RecordForm
      editing={editing} onEdit={() => setEditing(true)} onSave={() => saveMut.mutate()}
      onDiscard={() => { if (isNew) navigate(-1); else { setForm({ ...record }); setLines(lineData || []); setEditing(false) } }}
      backTo="/admin/purchase/orders"
      statusBar={<StatusBar steps={STATES} current={state} />}
      headerActions={
        <>
          {/* Draft */}
          {isDraft && recordId && (
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={openEmailDialog}>
              <Send className="h-3.5 w-3.5" /> Send RFQ
            </Button>
          )}
          {(isSent || isPurchase) && recordId && (
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={openEmailDialog}>
              <Send className="h-3.5 w-3.5" /> Send by Email
            </Button>
          )}
          {isDraft && (
            <Button variant="default" size="sm" className="rounded-xl gap-1.5" onClick={() => confirmMut.mutate()} disabled={confirmMut.isPending}>
              <CheckCircle className="h-3.5 w-3.5" /> Confirm Order
            </Button>
          )}

          {/* Sent */}
          {isSent && (
            <Button variant="default" size="sm" className="rounded-xl gap-1.5" onClick={() => confirmMut.mutate()} disabled={confirmMut.isPending}>
              <CheckCircle className="h-3.5 w-3.5" /> Confirm Order
            </Button>
          )}

          {/* To Approve */}
          {isToApprove && (
            <Button variant="default" size="sm" className="rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => approveMut.mutate()} disabled={approveMut.isPending}>
              <ThumbsUp className="h-3.5 w-3.5" /> Approve
            </Button>
          )}

          {/* Purchase */}
          {isPurchase && recordId && (
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => navigate(`/admin/inventory/transfers?filter=receipts&po=${recordId}`)}>
              <PackageCheck className="h-3.5 w-3.5" /> Receive Products
            </Button>
          )}
          {isPurchase && (
            <Button variant="default" size="sm" className="rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => createBillMut.mutate()} disabled={createBillMut.isPending}>
              <FilePlus className="h-3.5 w-3.5" /> Create Bill
            </Button>
          )}
          {isPurchase && (
            <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-muted-foreground" onClick={() => lockMut.mutate(!isLocked)} disabled={lockMut.isPending}>
              {isLocked ? <><Unlock className="h-3.5 w-3.5" /> Unlock</> : <><Lock className="h-3.5 w-3.5" /> Lock</>}
            </Button>
          )}

          {/* Cancel: shown for Draft/Sent/ToApprove/Purchase */}
          {(isDraft || isSent || isToApprove || isPurchase) && recordId && (
            <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-destructive" onClick={cancelWithConfirm} disabled={cancelMut.isPending}>
              <XCircle className="h-3.5 w-3.5" /> Cancel
            </Button>
          )}

          {/* Done or Cancel: Set to Draft */}
          {(isDone || isCancel) && recordId && (
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => draftMut.mutate()} disabled={draftMut.isPending}>
              <RotateCcw className="h-3.5 w-3.5" /> Set to Draft
            </Button>
          )}

          {!isNew && (
            <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-muted-foreground" onClick={() => setPreviewOpen(true)}>
              <Eye className="h-3.5 w-3.5" /> Preview PDF
            </Button>
          )}
          {!isNew && (
            <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-muted-foreground" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
          )}
        </>
      }
      smartButtons={smartButtons}
      topContent={
        <div className="mb-2">
          <ReadonlyField label="Order Reference" value={<span className="text-lg font-bold">{!form.name || form.name === '/' ? 'New' : form.name}</span>} />
        </div>
      }
      leftFields={
        <>
          <M2O field="partner_id" model="res.partner" label="Vendor" required
            errorMsg={errors.partner_id}
            onSelect={() => setErrors(er => { const n = { ...er }; delete n.partner_id; return n })}
            help="The supplier you're buying from. Must be a contact marked as a vendor." />
          {TF("date_planned", "Expected Arrival", { type: "datetime-local", help: "When you expect the goods to arrive. Drives scheduling and sets the receipt's planned date." })}
        </>
      }
      rightFields={
        <>
          <ReadonlyField label="Order Date" value={form.date_order ? new Date(form.date_order).toLocaleString() : ''} />
          <M2O field="payment_term_id" model="account.payment.term" label="Payment Terms" help="When you must pay the vendor. Drives the bill's due date." />
        </>
      }
      tabs={tabs}
      chatter={recordId ? <Chatter model="purchase.order" resId={recordId} /> : undefined}
    />
    <EmailComposer
      open={emailOpen}
      onClose={() => setEmailOpen(false)}
      resModel="purchase.order"
      resId={recordId || undefined}
      defaultTo={emailDefaults.to}
      defaultSubject={emailDefaults.subject}
      defaultBody={emailDefaults.body}
      onSent={() => {
        // Mirror the legacy "send" workflow side-effect: flip state to `sent`.
        if (recordId) sendMut.mutate()
        else queryClient.invalidateQueries({ queryKey: ['purchase-order', recordId] })
      }}
    />

    <PrintableReport
      open={previewOpen}
      onClose={() => setPreviewOpen(false)}
      title={`Purchase Order ${form.name && form.name !== '/' ? form.name : 'New'}`}
    >
      <div className="header">
        <div>
          <h1>{(Array.isArray(record?.company_id) ? record.company_id[1] : '') || 'Mashora'}</h1>
          <p style={{ fontSize: 12, color: PRINT_COLORS.muted, margin: '4px 0' }}>Your Company Address Line 1</p>
          <p style={{ fontSize: 12, color: PRINT_COLORS.muted, margin: 0 }}>City, State ZIP</p>
        </div>
        <div className="right">
          <h1 style={{ textTransform: 'uppercase' }}>{isPurchase ? 'Purchase Order' : 'RFQ'}</h1>
          <p style={{ fontSize: 14, margin: '4px 0' }}>#{form.name && form.name !== '/' ? form.name : 'NEW'}</p>
          <p style={{ fontSize: 12, color: PRINT_COLORS.muted, margin: '8px 0 0' }}>Date: {form.date_order ? new Date(form.date_order).toLocaleDateString() : '-'}</p>
          {form.date_planned && (
            <p style={{ fontSize: 12, color: PRINT_COLORS.muted, margin: 0 }}>Expected: {new Date(form.date_planned).toLocaleDateString()}</p>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        <div>
          <h2>Vendor</h2>
          <p style={{ margin: 0, fontWeight: 600 }}>{m2oVal(form.partner_id) || '-'}</p>
          {form.partner_ref && <p style={{ fontSize: 12, color: PRINT_COLORS.muted, margin: '4px 0 0' }}>Ref: {form.partner_ref}</p>}
        </div>
        <div>
          <h2>Buyer</h2>
          <p style={{ margin: 0, fontWeight: 600 }}>{m2oVal(form.user_id) || '-'}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th className="right" style={{ width: 80 }}>Qty</th>
            <th className="right" style={{ width: 100 }}>Unit Price</th>
            <th className="right" style={{ width: 110 }}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && (
            <tr><td colSpan={4} style={{ textAlign: 'center', color: PRINT_COLORS.subtle }}>No lines</td></tr>
          )}
          {lines.map((l) => (
            <tr key={l.id}>
              <td>
                <div>{(Array.isArray(l.product_id) ? l.product_id[1] : null) || l.name}</div>
                {Array.isArray(l.product_id) && l.name && l.name !== l.product_id[1] && (
                  <div style={{ fontSize: 11, color: PRINT_COLORS.muted }}>{l.name}</div>
                )}
              </td>
              <td className="right">{Number(l.product_qty || 0).toFixed(2)}</td>
              <td className="right">${Number(l.price_unit || 0).toFixed(2)}</td>
              <td className="right">${Number(l.price_subtotal || 0).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <table style={{ width: 280, margin: 0 }}>
          <tbody>
            <tr><td>Untaxed</td><td className="right">${Number(form.amount_untaxed || 0).toFixed(2)}</td></tr>
            <tr><td>Taxes</td><td className="right">${Number(form.amount_tax || 0).toFixed(2)}</td></tr>
            <tr className="total"><td>Total</td><td className="right">${Number(form.amount_total || 0).toFixed(2)}</td></tr>
          </tbody>
        </table>
      </div>
    </PrintableReport>
    </>
  )
}
