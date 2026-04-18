import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Input, Button, Skeleton,
} from '@mashora/design-system'
import { Send, CheckCircle, Printer, Eye, FileText, Truck, XCircle, Lock, Unlock, RotateCcw, FilePlus, RefreshCcw } from 'lucide-react'
import { RecordForm, FormField, ReadonlyField, StatusBar, M2OInput, OrderLinesEditor, EmailComposer, AttachmentSection, PrintableReport, toast, type SmartButton, type FormTab } from '@/components/shared'
import { sanitizedHtml } from '@/lib/sanitize'
import Chatter from '@/components/Chatter'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

const FORM_FIELDS = [
  'id', 'name', 'partner_id', 'state', 'date_order', 'validity_date',
  'amount_untaxed', 'amount_tax', 'amount_total', 'currency_id',
  'user_id', 'team_id', 'payment_term_id', 'pricelist_id',
  'fiscal_position_id', 'client_order_ref', 'origin', 'note',
  'order_line', 'invoice_status', 'delivery_count', 'invoice_count',
  'tag_ids', 'warehouse_id', 'picking_policy', 'commitment_date',
]

const LINE_FIELDS = [
  'id', 'sequence', 'product_id', 'name', 'product_uom_qty',
  'qty_delivered', 'qty_invoiced', 'price_unit', 'discount',
  'price_subtotal', 'tax_ids', 'display_type', 'customer_lead',
]

const STATES = [
  { key: 'draft', label: 'Quotation' },
  { key: 'sent', label: 'Quotation Sent' },
  { key: 'sale', label: 'Sales Order', color: 'success' as const },
  { key: 'cancel', label: 'Cancelled' },
]

/** Local form state for a sales order. Fields are all optional because the record is
 *  loaded async and some fields may be absent/false (Mashora backend convention). */
type M2O = [number, string] | false | null | undefined
interface SaleOrderForm {
  id?: number | null
  name?: string
  state?: string
  date_order?: string
  validity_date?: string | false
  commitment_date?: string | false
  client_order_ref?: string | false
  origin?: string | false
  note?: string | false
  amount_untaxed?: number
  amount_tax?: number
  amount_total?: number
  delivery_count?: number
  invoice_count?: number
  locked?: boolean
  picking_policy?: string
  partner_id?: M2O
  user_id?: M2O
  team_id?: M2O
  payment_term_id?: M2O
  pricelist_id?: M2O
  fiscal_position_id?: M2O
  warehouse_id?: M2O
  currency_id?: M2O
  partner_email?: string
  partner_id_email?: string
  [key: string]: unknown
}

// Print-context colors. Inline styles are intentional for printable HTML
// (the print window does not always have Tailwind's theme vars available),
// so hexes stay as literals — consolidated here for a single source of truth.
const PRINT_COLORS = {
  muted: '#666',
  subtle: '#999',
  body: '#444',
  border: '#ddd',
} as const

export default function SalesOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id || id === 'new'
  const recordId = isNew ? null : parseInt(id || '0')
  const [editing, setEditing] = useState(isNew)
  const [form, setForm] = useState<SaleOrderForm>({})
  const [lines, setLines] = useState<Array<Record<string, unknown> & { id: number }>>([])
  // Lines buffered locally before the parent order exists on the server.
  const [localLines, setLocalLines] = useState<Array<Record<string, unknown>>>([])
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (navTimerRef.current) clearTimeout(navTimerRef.current) }, [])

  // Send-by-email dialog
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailDefaults, setEmailDefaults] = useState<{ to: string[]; subject: string; body: string }>({ to: [], subject: '', body: '' })

  const [previewOpen, setPreviewOpen] = useState(false)

  const { data: record, isLoading } = useQuery<SaleOrderForm & { lines?: Array<Record<string, unknown> & { id: number }> }>({
    queryKey: ['sale-order', recordId],
    queryFn: async () => {
      if (isNew) {
        return { id: null, state: 'draft', name: '/', order_line: [], amount_untaxed: 0, amount_tax: 0, amount_total: 0 }
      }
      const { data } = await erpClient.raw.get(`/sales/orders/${recordId}`)
      return data
    },
  })

  // Lines come from the order detail response (data.lines)
  const lineData = record?.lines || []

  // Subscription count for this partner
  const partnerForCount = Array.isArray(record?.partner_id) ? record.partner_id[0] : record?.partner_id
  const { data: subCount } = useQuery({
    queryKey: ['sub-count-partner', partnerForCount],
    enabled: !!partnerForCount,
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.post('/model/sale.subscription', {
          domain: [['partner_id', '=', partnerForCount]],
          fields: ['id'],
          limit: 1,
        })
        return data?.total ?? 0
      } catch { return 0 }
    },
  })

  useEffect(() => {
    if (record) { setForm({ ...record }); setLines(lineData || []) }
  }, [record, lineData])

  const setField = useCallback((n: string, v: unknown) => { setForm(p => ({ ...p, [n]: v })) }, [])

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {}
    const partnerId = Array.isArray(form.partner_id) ? form.partner_id[0] : form.partner_id
    if (!partnerId) errs.partner_id = 'Customer is required'
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      toast.error('Validation Error', Object.values(errs).join(', '))
      return false
    }
    return true
  }, [form])

  // Helper: extract M2O id
  const m2oId = (v: unknown): number | null =>
    Array.isArray(v) ? (typeof v[0] === 'number' ? v[0] : null) : (typeof v === 'number' ? v : null)

  // Save
  const saveMut = useMutation({
    mutationFn: async () => {
      if (!validate()) throw new Error('Validation failed')

      // Build vals from all editable fields
      const partnerId = m2oId(form.partner_id)
      const body: Record<string, unknown> = {
        partner_id: partnerId || undefined,
        validity_date: form.validity_date || undefined,
        client_order_ref: form.client_order_ref || undefined,
        note: form.note || undefined,
        payment_term_id: m2oId(form.payment_term_id) || undefined,
        pricelist_id: m2oId(form.pricelist_id) || undefined,
        fiscal_position_id: m2oId(form.fiscal_position_id) || undefined,
        user_id: m2oId(form.user_id) || undefined,
        team_id: m2oId(form.team_id) || undefined,
        warehouse_id: m2oId(form.warehouse_id) || undefined,
        commitment_date: form.commitment_date || undefined,
        picking_policy: form.picking_policy || undefined,
      }

      // Remove undefined values
      for (const k of Object.keys(body)) {
        if (body[k] === undefined) delete body[k]
      }

      if (isNew) {
        // Convert locally-buffered rows to the SaleOrderLineCreate shape.
        // Only rows with a product are sent; blanks are dropped.
        const linesPayload = localLines
          .map(r => {
            const pid = m2oId(r.product_id)
            if (!pid) return null
            return {
              product_id: pid,
              name: r.name || (Array.isArray(r.product_id) ? r.product_id[1] : ''),
              product_uom_qty: Number(r.product_uom_qty ?? 1) || 0,
              price_unit: Number(r.price_unit ?? 0) || 0,
              discount: Number(r.discount ?? 0) || 0,
            }
          })
          .filter(Boolean)
        if (linesPayload.length > 0) body.lines = linesPayload
        const { data } = await erpClient.raw.post('/sales/orders/create', body)
        return data
      }
      const { data } = await erpClient.raw.put(`/sales/orders/${recordId}`, body)
      return data
    },
    onSuccess: (data) => {
      setEditing(false)
      setErrors({})
      toast.success('Saved', 'Sales order saved successfully')
      queryClient.invalidateQueries({ queryKey: ['sale-order'] })
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      if (isNew && data?.id) navigate(`/admin/sales/orders/${data.id}`, { replace: true })
    },
    onError: (e: unknown) => {
      const msg = extractErrorMessage(e)
      if (msg !== 'Validation failed') {
        toast.error('Save Failed', msg)
      }
    },
  })

  // Workflow — save first if new, then call dedicated endpoint
  const callAction = useCallback(async (action: string, label: string) => {
    let rid = recordId
    if (!rid) {
      if (!validate()) return
      try {
        const partnerId = m2oId(form.partner_id)
        const linesPayload = localLines
          .map(r => {
            const pid = m2oId(r.product_id)
            if (!pid) return null
            return {
              product_id: pid,
              name: r.name || (Array.isArray(r.product_id) ? r.product_id[1] : ''),
              product_uom_qty: Number(r.product_uom_qty ?? 1) || 0,
              price_unit: Number(r.price_unit ?? 0) || 0,
              discount: Number(r.discount ?? 0) || 0,
            }
          })
          .filter(Boolean)
        const { data } = await erpClient.raw.post('/sales/orders/create', {
          partner_id: partnerId,
          validity_date: form.validity_date || undefined,
          client_order_ref: form.client_order_ref || undefined,
          payment_term_id: m2oId(form.payment_term_id) || undefined,
          ...(linesPayload.length > 0 ? { lines: linesPayload } : {}),
        })
        rid = data?.id
        if (rid) navigate(`/admin/sales/orders/${rid}`, { replace: true })
      } catch (e: unknown) {
        toast.error('Save Failed', extractErrorMessage(e) || 'Could not create order')
        return
      }
    }
    if (!rid) return
    try {
      await erpClient.raw.post(`/sales/orders/${rid}/${action}`)
      toast.success('Action Complete', `${label} executed successfully`)
      queryClient.invalidateQueries({ queryKey: ['sale-order'] })
    } catch (e: unknown) {
      toast.error('Action Failed', extractErrorMessage(e))
    }
  }, [recordId, form, localLines, navigate, queryClient, validate])

  // ---------- Mutations for new actions ----------
  const confirmMut = useMutation({
    mutationFn: async () => {
      if (!recordId) throw new Error('No record')
      const { data } = await erpClient.raw.post(`/sales/orders/${recordId}/confirm`)
      return data
    },
    onSuccess: () => {
      toast.success('Confirmed', 'Sales order confirmed')
      queryClient.invalidateQueries({ queryKey: ['sale-order', recordId] })
    },
    onError: (e: unknown) => toast.error('Confirm Failed', extractErrorMessage(e)),
  })

  const cancelMut = useMutation({
    mutationFn: async () => {
      if (!recordId) throw new Error('No record')
      const { data } = await erpClient.raw.post(`/sales/orders/${recordId}/cancel`)
      return data
    },
    onSuccess: () => {
      toast.success('Cancelled', 'Sales order cancelled')
      queryClient.invalidateQueries({ queryKey: ['sale-order', recordId] })
    },
    onError: (e: unknown) => toast.error('Cancel Failed', extractErrorMessage(e)),
  })

  const draftMut = useMutation({
    mutationFn: async () => {
      if (!recordId) throw new Error('No record')
      const { data } = await erpClient.raw.post(`/sales/orders/${recordId}/draft`)
      return data
    },
    onSuccess: () => {
      toast.success('Set to Draft', 'Order moved back to draft')
      queryClient.invalidateQueries({ queryKey: ['sale-order', recordId] })
    },
    onError: (e: unknown) => toast.error('Action Failed', extractErrorMessage(e)),
  })

  const lockMut = useMutation({
    mutationFn: async (lock: boolean) => {
      if (!recordId) throw new Error('No record')
      const action = lock ? 'lock' : 'unlock'
      const { data } = await erpClient.raw.post(`/sales/orders/${recordId}/${action}`)
      return data
    },
    onSuccess: (_d, lock) => {
      toast.success(lock ? 'Locked' : 'Unlocked', `Order ${lock ? 'locked' : 'unlocked'}`)
      queryClient.invalidateQueries({ queryKey: ['sale-order', recordId] })
    },
    onError: (e: unknown) => toast.error('Action Failed', extractErrorMessage(e)),
  })

  const createInvoiceMut = useMutation({
    mutationFn: async () => {
      if (!recordId) throw new Error('No record')
      const { data } = await erpClient.raw.post(`/sales/orders/${recordId}/create-invoice`)
      return data
    },
    onSuccess: (data: unknown) => {
      const d = (data && typeof data === 'object' ? data : {}) as { invoice_id?: number; id?: number; invoice_ids?: number[] }
      const invoiceId = d.invoice_id || d.id || (Array.isArray(d.invoice_ids) ? d.invoice_ids[0] : null)
      if (invoiceId) {
        toast.success('Invoice Created', `Invoice #${invoiceId} created — click View Invoices smart button to open`)
        // Slight delay then navigate, so the user sees the toast
        if (navTimerRef.current) clearTimeout(navTimerRef.current)
        navTimerRef.current = setTimeout(() => navigate(`/admin/invoicing/invoices/${invoiceId}`), 800)
      } else {
        toast.success('Invoice Created', 'Invoice was created successfully')
      }
      queryClient.invalidateQueries({ queryKey: ['sale-order', recordId] })
    },
    onError: (e: unknown) => toast.error('Invoice Creation Failed', extractErrorMessage(e)),
  })

  // Open the email dialog with prefilled values
  const openEmailDialog = useCallback(() => {
    const partnerEmail = record?.partner_email || record?.partner_id_email || ''
    const refLabel = form.name && form.name !== '/' ? form.name : ''
    setEmailDefaults({
      to: partnerEmail ? [partnerEmail] : [],
      subject: `Quotation ${refLabel}`.trim(),
      body: `<p>Dear customer,</p><p>Please find attached your quotation${refLabel ? ` ${refLabel}` : ''}.</p><p>Best regards,</p>`,
    })
    setEmailOpen(true)
  }, [record, form.name])

  if (isLoading || !record) {
    return <div className="space-y-4"><Skeleton className="h-10 w-full rounded-xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>
  }

  const m2oVal = (v: unknown): string => Array.isArray(v) ? String(v[1] ?? '') : ''
  const localUntaxed = localLines.reduce((s: number, r) => {
    const pid = Array.isArray(r.product_id) ? r.product_id[0] : r.product_id
    if (!pid) return s
    const q = Number(r.product_uom_qty) || 0
    const p = Number(r.price_unit) || 0
    const d = Number(r.discount) || 0
    return s + q * p * (1 - d / 100)
  }, 0)
  const state = form.state || 'draft'
  const isDraft = state === 'draft'
  const isSent = state === 'sent'
  const isSale = state === 'sale'
  const isCancel = state === 'cancel'
  const isDone = state === 'done'
  const isLocked = !!form.locked

  const smartButtons: SmartButton[] = [
    (form.delivery_count ?? 0) > 0 && { label: 'Delivery', value: form.delivery_count ?? 0, icon: <Truck className="h-5 w-5" /> },
    (form.invoice_count ?? 0) > 0 && { label: 'Invoices', value: form.invoice_count ?? 0, icon: <FileText className="h-5 w-5" /> },
    !!subCount && subCount > 0 && {
      label: 'Subscriptions', value: subCount, icon: <RefreshCcw className="h-5 w-5" />,
      onClick: () => partnerForCount && navigate(`/admin/sales/subscriptions?partner=${partnerForCount}`),
    },
  ].filter(Boolean) as SmartButton[]

  const linesLocked = state === 'cancel' || state === 'done' || isLocked

  const tabs: FormTab[] = [
    {
      key: 'lines', label: 'Order Lines',
      content: (
        <div className="space-y-3">
          <OrderLinesEditor
            lines={isNew ? [] : lines}
            parentId={recordId}
            parentField="order_id"
            lineModel="sale.order.line"
            qtyField="product_uom_qty"
            showDiscount
            showLeadTime
            showDelivered={isSale}
            showInvoiced={isSale}
            readonly={linesLocked}
            onChanged={() => {
              queryClient.invalidateQueries({ queryKey: ['sale-order', recordId] })
            }}
            onLocalLinesChange={isNew ? setLocalLines : undefined}
          />
          <div className="flex justify-end">
            <div className="w-64 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Untaxed Amount</span><span className="font-mono">${isNew ? localUntaxed.toFixed(2) : Number(form.amount_untaxed || 0).toFixed(2)}</span></div>
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
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-3">
          <div className="space-y-3">
            <FormField label="Salesperson" help="The person responsible for this order. Used for commission reports and filtering.">
              {editing ? <M2OInput value={form.user_id} model="res.users" onChange={v => setField('user_id', v)} /> : <ReadonlyField label="" value={m2oVal(form.user_id)} />}
            </FormField>
            <FormField label="Sales Team" help="Which team owns this order. Used for grouping on the Sales dashboard and team performance reports.">
              {editing ? <M2OInput value={form.team_id} model="crm.team" onChange={v => setField('team_id', v)} /> : <ReadonlyField label="" value={m2oVal(form.team_id)} />}
            </FormField>
            {editing ? (
              <FormField label="Customer Reference" help="The customer's own PO number or reference. Printed on the quotation/invoice so the customer can match it to their own records."><Input value={form.client_order_ref || ''} onChange={e => setField('client_order_ref', e.target.value)} className="rounded-xl h-9" /></FormField>
            ) : (
              <ReadonlyField label="Customer Reference" value={form.client_order_ref} />
            )}
            <ReadonlyField label="Source Document" value={form.origin} />
          </div>
          <div className="space-y-3">
            <FormField label="Fiscal Position" help="Overrides the default tax and income-account mappings. Use for special cases like export sales, tax-exempt customers, or inter-company transactions.">
              {editing ? <M2OInput value={form.fiscal_position_id} model="account.fiscal.position" onChange={v => setField('fiscal_position_id', v)} /> : <ReadonlyField label="" value={m2oVal(form.fiscal_position_id)} />}
            </FormField>
            <FormField label="Warehouse" help="Which warehouse will ship this order. Affects stock availability and the generated delivery.">
              {editing ? <M2OInput value={form.warehouse_id} model="stock.warehouse" onChange={v => setField('warehouse_id', v)} /> : <ReadonlyField label="" value={m2oVal(form.warehouse_id)} />}
            </FormField>
            {editing ? (
              <FormField label="Delivery Date" help="When you promise to deliver. If left empty, it's computed from the customer lead time."><Input type="datetime-local" value={form.commitment_date ? form.commitment_date.replace(' ', 'T').slice(0, 16) : ''} onChange={e => setField('commitment_date', e.target.value ? e.target.value.replace('T', ' ') + ':00' : false)} className="rounded-xl h-9" /></FormField>
            ) : (
              <ReadonlyField label="Delivery Date" value={form.commitment_date ? new Date(form.commitment_date).toLocaleString() : ''} />
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'notes', label: 'Terms',
      content: editing
        ? <FormField label="Terms and Conditions"><Input value={form.note || ''} onChange={e => setField('note', e.target.value)} className="rounded-xl h-9" /></FormField>
        : <ReadonlyField label="Terms and Conditions" value={form.note ? <span dangerouslySetInnerHTML={sanitizedHtml(form.note)} /> : undefined} />,
    },
    {
      key: 'attachments', label: 'Attachments',
      content: <AttachmentSection resModel="sale.order" resId={recordId} />,
    },
  ]

  return (
    <>
      <RecordForm
        editing={editing} onEdit={() => setEditing(true)} onSave={() => saveMut.mutate()}
        onDiscard={() => { if (isNew) navigate(-1); else { setForm({ ...record }); setLines(lineData || []); setEditing(false) } }}
        backTo="/admin/sales/orders"
        statusBar={<StatusBar steps={STATES} current={state} />}
        headerActions={
          <>
            {/* Draft state actions */}
            {isDraft && !isNew && (
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={openEmailDialog}>
                <Send className="h-3.5 w-3.5" /> Send by Email
              </Button>
            )}
            {isDraft && (
              <Button variant="default" size="sm" className="rounded-xl gap-1.5" onClick={() => isNew ? callAction('confirm', 'Confirm Order') : confirmMut.mutate()} disabled={confirmMut.isPending}>
                <CheckCircle className="h-3.5 w-3.5" /> Confirm
              </Button>
            )}

            {/* Sent state actions */}
            {isSent && (
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={openEmailDialog}>
                <Send className="h-3.5 w-3.5" /> Send by Email
              </Button>
            )}
            {isSent && (
              <Button variant="default" size="sm" className="rounded-xl gap-1.5" onClick={() => confirmMut.mutate()} disabled={confirmMut.isPending}>
                <CheckCircle className="h-3.5 w-3.5" /> Confirm
              </Button>
            )}

            {/* Sale state actions */}
            {isSale && (
              <Button variant="default" size="sm" className="rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => createInvoiceMut.mutate()} disabled={createInvoiceMut.isPending}>
                <FilePlus className="h-3.5 w-3.5" /> Create Invoice
              </Button>
            )}
            {isSale && (
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={openEmailDialog}>
                <Send className="h-3.5 w-3.5" /> Send by Email
              </Button>
            )}
            {isSale && (
              <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-muted-foreground" onClick={() => lockMut.mutate(!isLocked)} disabled={lockMut.isPending}>
                {isLocked ? <><Unlock className="h-3.5 w-3.5" /> Unlock</> : <><Lock className="h-3.5 w-3.5" /> Lock</>}
              </Button>
            )}

            {/* Cancel — Sent or Sale */}
            {(isSent || isSale) && recordId && (
              <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-destructive" onClick={() => {
                if (!confirm('Cancel this sales order?')) return
                cancelMut.mutate()
              }} disabled={cancelMut.isPending}>
                <XCircle className="h-3.5 w-3.5" /> Cancel
              </Button>
            )}

            {/* Done/Locked or Cancel — Set to Draft */}
            {(isDone || isCancel) && recordId && (
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => draftMut.mutate()} disabled={draftMut.isPending}>
                <RotateCcw className="h-3.5 w-3.5" /> Set to Draft
              </Button>
            )}

            {/* Always-visible Print + Preview */}
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
            <FormField label="Customer" required>
              {editing ? (
                <div>
                  <M2OInput value={form.partner_id} model="res.partner" onChange={v => { setField('partner_id', v); setErrors(e => { const n = { ...e }; delete n.partner_id; return n }) }} className={errors.partner_id ? 'ring-2 ring-red-500/50' : ''} />
                  {errors.partner_id && <p className="text-xs text-destructive mt-1">{errors.partner_id}</p>}
                </div>
              ) : <ReadonlyField label="" value={m2oVal(form.partner_id)} />}
            </FormField>
            {editing ? (
              <FormField label="Expiration" help="Quotation validity date. After this date, the quote expires and can no longer be confirmed without updating it."><Input type="date" value={form.validity_date || ''} onChange={e => setField('validity_date', e.target.value || false)} className="rounded-xl h-9" /></FormField>
            ) : (
              <ReadonlyField label="Expiration" value={form.validity_date ? new Date(form.validity_date).toLocaleDateString() : ''} />
            )}
          </>
        }
        rightFields={
          <>
            <ReadonlyField label="Order Date" value={form.date_order ? new Date(form.date_order).toLocaleString() : ''} />
            <FormField label="Payment Terms" help="When the customer must pay (e.g. 'Net 30 days', 'Due on receipt'). Drives the invoice's due date.">
              {editing ? <M2OInput value={form.payment_term_id} model="account.payment.term" onChange={v => setField('payment_term_id', v)} /> : <ReadonlyField label="" value={m2oVal(form.payment_term_id)} />}
            </FormField>
          </>
        }
        tabs={tabs}
        chatter={recordId ? <Chatter model="sale.order" resId={recordId} /> : undefined}
      />

      <EmailComposer
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        resModel="sale.order"
        resId={recordId || undefined}
        defaultTo={emailDefaults.to}
        defaultSubject={emailDefaults.subject}
        defaultBody={emailDefaults.body}
        onSent={() => queryClient.invalidateQueries({ queryKey: ['sale-order', recordId] })}
      />

      <PrintableReport
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`Order ${form.name && form.name !== '/' ? form.name : 'Draft'}`}
      >
        <div className="header">
          <div>
            <h1>Mashora</h1>
            <p style={{ fontSize: 12, color: PRINT_COLORS.muted, margin: '4px 0' }}>Your Company Address Line 1</p>
            <p style={{ fontSize: 12, color: PRINT_COLORS.muted, margin: 0 }}>City, State ZIP</p>
          </div>
          <div className="right">
            <h1 style={{ textTransform: 'uppercase' }}>{isSale ? 'Sales Order' : 'Quotation'}</h1>
            <p style={{ fontSize: 14, margin: '4px 0' }}>#{form.name && form.name !== '/' ? form.name : 'NEW'}</p>
            <p style={{ fontSize: 12, color: PRINT_COLORS.muted, margin: '8px 0 0' }}>Date: {form.date_order ? new Date(form.date_order).toLocaleDateString() : '-'}</p>
            {form.validity_date && (
              <p style={{ fontSize: 12, color: PRINT_COLORS.muted, margin: 0 }}>Expiration: {new Date(form.validity_date).toLocaleDateString()}</p>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          <div>
            <h2>Customer</h2>
            <p style={{ margin: 0, fontWeight: 600 }}>{m2oVal(form.partner_id) || '-'}</p>
            {form.client_order_ref && <p style={{ fontSize: 12, color: PRINT_COLORS.muted, margin: '4px 0 0' }}>Ref: {form.client_order_ref}</p>}
          </div>
          <div>
            <h2>Salesperson</h2>
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
            {lines.map(l => {
              const productTuple = Array.isArray(l.product_id) ? l.product_id as [number, string] : null
              const productName = productTuple ? productTuple[1] : (typeof l.name === 'string' ? l.name : '')
              const desc = typeof l.name === 'string' ? l.name : ''
              return (
                <tr key={l.id}>
                  <td>
                    <div>{productName}</div>
                    {productTuple && desc && desc !== productTuple[1] && (
                      <div style={{ fontSize: 11, color: PRINT_COLORS.muted }}>{desc}</div>
                    )}
                  </td>
                  <td className="right">{Number(l.product_uom_qty || 0).toFixed(2)}</td>
                  <td className="right">${Number(l.price_unit || 0).toFixed(2)}</td>
                  <td className="right">${Number(l.price_subtotal || 0).toFixed(2)}</td>
                </tr>
              )
            })}
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

        {form.note && (
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${PRINT_COLORS.border}` }}>
            <h2>Terms &amp; Conditions</h2>
            <div style={{ fontSize: 12, color: PRINT_COLORS.body }} dangerouslySetInnerHTML={sanitizedHtml(form.note)} />
          </div>
        )}
      </PrintableReport>
    </>
  )
}
