import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Input, Button, Badge, Skeleton,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@mashora/design-system'
import { Send, CheckCircle, Printer, FileText, Truck, XCircle } from 'lucide-react'
import { RecordForm, FormField, ReadonlyField, StatusBar, toast, type SmartButton, type FormTab } from '@/components/shared'
import Chatter from '@/components/Chatter'
import { erpClient } from '@/lib/erp-api'

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

export default function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id || id === 'new'
  const recordId = isNew ? null : parseInt(id || '0')
  const [editing, setEditing] = useState(isNew)
  const [form, setForm] = useState<Record<string, any>>({})
  const [lines, setLines] = useState<any[]>([])

  const { data: record, isLoading } = useQuery({
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
  const setField = useCallback((n: string, v: any) => { setForm(p => ({ ...p, [n]: v })) }, [])

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
      const vals: Record<string, any> = {}
      for (const f of ['partner_ref', 'origin', 'date_planned']) {
        if (form[f] !== record?.[f]) vals[f] = form[f] ?? false
      }
      for (const f of ['partner_id', 'user_id', 'payment_term_id', 'fiscal_position_id', 'picking_type_id']) {
        const nv = Array.isArray(form[f]) ? form[f][0] : form[f]
        const ov = Array.isArray(record?.[f]) ? record[f][0] : record?.[f]
        if (nv !== ov) vals[f] = nv || false
      }
      if (isNew) {
        if (!vals.partner_id && form.partner_id) vals.partner_id = Array.isArray(form.partner_id) ? form.partner_id[0] : form.partner_id
        const { data } = await erpClient.raw.post('/model/purchase.order/create', { vals })
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
    onError: (e: any) => {
      if (e.message !== 'Validation failed') {
        toast.error('Save Failed', e?.response?.data?.detail || e.message || 'Unknown error')
      }
    },
  })

  const callMethod = useCallback(async (method: string) => {
    if (!validate()) return
    if (!recordId) return
    try {
      await erpClient.raw.post('/model/purchase.order/call', { record_ids: [recordId], method })
      toast.success('Action Complete', `${method.replace('action_', '').replace('button_', '').replace(/_/g, ' ')} executed`)
      queryClient.invalidateQueries({ queryKey: ['purchase-order', recordId] })
    } catch (e: any) {
      toast.error('Action Failed', e?.response?.data?.detail || e.message || 'Unknown error')
    }
  }, [recordId, queryClient, validate])

  const [m2oResults, setM2oResults] = useState<Record<string, any[]>>({})
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

  const m2oVal = (v: any) => Array.isArray(v) ? v[1] : ''
  const state = form.state || 'draft'
  const isDraft = state === 'draft'
  const isSent = state === 'sent'
  const isPurchase = state === 'purchase'

  const smartButtons: SmartButton[] = [
    form.incoming_picking_count > 0 && { label: 'Receipts', value: form.incoming_picking_count, icon: <Truck className="h-5 w-5" /> },
    form.invoice_count > 0 && { label: 'Bills', value: form.invoice_count, icon: <FileText className="h-5 w-5" /> },
  ].filter(Boolean) as SmartButton[]

  const M2O = ({ field, model, label, required, errorMsg, onSelect }: { field: string; model: string; label: string; required?: boolean; errorMsg?: string; onSelect?: () => void }) => {
    const [open, setOpen] = useState(false)
    const [q, setQ] = useState('')
    if (!editing) return <ReadonlyField label={label} value={m2oVal(form[field])} />
    return (
      <FormField label={label} required={required}>
        <div className="relative">
          <Input value={open ? q : m2oVal(form[field])} className={`rounded-xl h-9${errorMsg ? ' ring-2 ring-red-500/50' : ''}`} autoComplete="off"
            onChange={e => { setQ(e.target.value); searchM2o(model, e.target.value, field) }}
            onFocus={() => { setQ(m2oVal(form[field])); setOpen(true) }}
            onBlur={() => setTimeout(() => setOpen(false), 200)} placeholder="Search..." />
          {open && (m2oResults[field] || []).length > 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-xl border border-border/60 bg-popover shadow-lg max-h-48 overflow-y-auto">
              {(m2oResults[field] || []).map((r: any) => (
                <button key={r.id} className="w-full px-3 py-2 text-left text-sm hover:bg-accent first:rounded-t-xl last:rounded-b-xl"
                  onMouseDown={() => { setField(field, [r.id, r.display_name]); setOpen(false); onSelect?.() }}>{r.display_name}</button>
              ))}
            </div>
          )}
        </div>
        {errorMsg && <p className="text-xs text-destructive mt-1">{errorMsg}</p>}
      </FormField>
    )
  }

  const TF = ({ field, label, type = 'text' }: { field: string; label: string; type?: string }) => {
    if (!editing) return <ReadonlyField label={label} value={form[field]} />
    return <FormField label={label}><Input type={type} value={form[field] || ''} onChange={e => setField(field, e.target.value)} className="rounded-xl h-9" /></FormField>
  }

  const OrderLinesTable = () => (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border/40">
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider w-[35%]">Product</TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-[10%]">Qty</TableHead>
            {isPurchase && <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-[10%]">Received</TableHead>}
            {isPurchase && <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-[10%]">Billed</TableHead>}
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-[12%]">Unit Price</TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-[15%]">Subtotal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.length === 0 ? (
            <TableRow><TableCell colSpan={isPurchase ? 6 : 4} className="h-20 text-center text-muted-foreground">No order lines</TableCell></TableRow>
          ) : lines.map(line => {
            if (line.display_type === 'line_section') return (
              <TableRow key={line.id} className="bg-muted/20"><TableCell colSpan={isPurchase ? 6 : 4} className="font-semibold text-sm py-2">{line.name}</TableCell></TableRow>
            )
            if (line.display_type === 'line_note') return (
              <TableRow key={line.id}><TableCell colSpan={isPurchase ? 6 : 4} className="text-sm text-muted-foreground italic py-1.5">{line.name}</TableCell></TableRow>
            )
            return (
              <TableRow key={line.id} className="border-border/30 hover:bg-muted/10">
                <TableCell className="py-2">
                  <p className="text-sm font-medium">{Array.isArray(line.product_id) ? line.product_id[1] : 'Product'}</p>
                  {line.name && line.name !== (Array.isArray(line.product_id) ? line.product_id[1] : '') && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{line.name}</p>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{Number(line.product_qty || 0).toFixed(2)}</TableCell>
                {isPurchase && <TableCell className="text-right font-mono text-sm">{Number(line.qty_received || 0).toFixed(2)}</TableCell>}
                {isPurchase && <TableCell className="text-right font-mono text-sm">{Number(line.qty_invoiced || 0).toFixed(2)}</TableCell>}
                <TableCell className="text-right font-mono text-sm">${Number(line.price_unit || 0).toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-sm font-medium">${Number(line.price_subtotal || 0).toFixed(2)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )

  const tabs: FormTab[] = [
    {
      key: 'lines', label: 'Products',
      content: (
        <div className="space-y-3">
          <OrderLinesTable />
          <div className="flex justify-end">
            <div className="w-64 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Untaxed</span><span className="font-mono">${Number(form.amount_untaxed || 0).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Taxes</span><span className="font-mono">${Number(form.amount_tax || 0).toFixed(2)}</span></div>
              <div className="flex justify-between border-t border-border/40 pt-1.5 font-semibold text-base"><span>Total</span><span className="font-mono">${Number(form.amount_total || 0).toFixed(2)}</span></div>
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
            <M2O field="user_id" model="res.users" label="Buyer" />
            <TF field="origin" label="Source Document" />
            <TF field="partner_ref" label="Vendor Reference" />
          </div>
          <div className="space-y-2">
            <M2O field="fiscal_position_id" model="account.fiscal.position" label="Fiscal Position" />
            <M2O field="payment_term_id" model="account.payment.term" label="Payment Terms" />
            <M2O field="picking_type_id" model="stock.picking.type" label="Deliver To" />
          </div>
        </div>
      ),
    },
  ]

  return (
    <RecordForm
      editing={editing} onEdit={() => setEditing(true)} onSave={() => saveMut.mutate()}
      onDiscard={() => { if (isNew) navigate(-1); else { setForm({ ...record }); setLines(lineData || []); setEditing(false) } }}
      backTo="/admin/purchase/orders"
      statusBar={<StatusBar steps={STATES} current={state} />}
      headerActions={
        <>
          {isDraft && <Button variant="default" size="sm" className="rounded-xl gap-1.5" onClick={() => callMethod('action_rfq_send')}><Send className="h-3.5 w-3.5" /> Send</Button>}
          {(isDraft || isSent) && <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => callMethod('button_confirm')}><CheckCircle className="h-3.5 w-3.5" /> Confirm</Button>}
          {!isNew && <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-muted-foreground"><Printer className="h-3.5 w-3.5" /> Print</Button>}
          {(isDraft || isSent) && recordId && <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-destructive" onClick={async () => {
            if (!confirm('Cancel this purchase order?')) return
            try { await erpClient.raw.post('/model/purchase.order/call', { record_ids: [recordId], method: 'button_cancel' }); toast.success('Cancelled'); queryClient.invalidateQueries({ queryKey: ['purchase-order', recordId] }) }
            catch (e: any) { toast.error('Cancel Failed', e?.response?.data?.detail || e.message) }
          }}><XCircle className="h-3.5 w-3.5" /> Cancel</Button>}
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
            onSelect={() => setErrors(er => { const n = { ...er }; delete n.partner_id; return n })} />
          <TF field="date_planned" label="Expected Arrival" type="datetime-local" />
        </>
      }
      rightFields={
        <>
          <ReadonlyField label="Order Date" value={form.date_order ? new Date(form.date_order).toLocaleString() : ''} />
          <M2O field="payment_term_id" model="account.payment.term" label="Payment Terms" />
        </>
      }
      tabs={tabs}
      chatter={recordId ? <Chatter model="purchase.order" resId={recordId} /> : undefined}
    />
  )
}
