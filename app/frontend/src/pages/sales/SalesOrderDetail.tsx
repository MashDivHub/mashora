import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Input, Button, Badge, Skeleton,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  cn,
} from '@mashora/design-system'
import { Send, CheckCircle, Printer, Eye, FileText, Truck } from 'lucide-react'
import { RecordForm, FormField, ReadonlyField, StatusBar, M2OInput, toast, type SmartButton, type FormTab } from '@/components/shared'
import { sanitizedHtml } from '@/lib/sanitize'
import Chatter from '@/components/Chatter'
import { erpClient } from '@/lib/erp-api'

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
  'price_subtotal', 'tax_ids', 'display_type',
]

const STATES = [
  { key: 'draft', label: 'Quotation' },
  { key: 'sent', label: 'Quotation Sent' },
  { key: 'sale', label: 'Sales Order', color: 'success' as const },
  { key: 'cancel', label: 'Cancelled' },
]

export default function SalesOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = id === 'new'
  const recordId = isNew ? null : parseInt(id || '0')
  const [editing, setEditing] = useState(isNew)
  const [form, setForm] = useState<Record<string, any>>({})
  const [lines, setLines] = useState<any[]>([])

  const { data: record, isLoading } = useQuery({
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

  useEffect(() => {
    if (record) { setForm({ ...record }); setLines(lineData || []) }
  }, [record, lineData])

  const setField = useCallback((n: string, v: any) => { setForm(p => ({ ...p, [n]: v })) }, [])

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
  const m2oId = (v: any): number | null => Array.isArray(v) ? v[0] : (typeof v === 'number' ? v : null)

  // Save
  const saveMut = useMutation({
    mutationFn: async () => {
      if (!validate()) throw new Error('Validation failed')

      // Build vals from all editable fields
      const partnerId = m2oId(form.partner_id)
      const body: Record<string, any> = {
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
    onError: (e: any) => {
      if (e.message !== 'Validation failed') {
        toast.error('Save Failed', e?.response?.data?.detail || e.message || 'Unknown error')
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
        const { data } = await erpClient.raw.post('/sales/orders/create', {
          partner_id: partnerId,
          validity_date: form.validity_date || undefined,
          client_order_ref: form.client_order_ref || undefined,
          payment_term_id: m2oId(form.payment_term_id) || undefined,
        })
        rid = data?.id
        if (rid) navigate(`/admin/sales/orders/${rid}`, { replace: true })
      } catch (e: any) {
        toast.error('Save Failed', e?.response?.data?.detail || 'Could not create order')
        return
      }
    }
    if (!rid) return
    try {
      await erpClient.raw.post(`/sales/orders/${rid}/${action}`)
      toast.success('Action Complete', `${label} executed successfully`)
      queryClient.invalidateQueries({ queryKey: ['sale-order'] })
    } catch (e: any) {
      toast.error('Action Failed', e?.response?.data?.detail || e.message || 'Unknown error')
    }
  }, [recordId, form, navigate, queryClient, validate])

  if (isLoading || !record) {
    return <div className="space-y-4"><Skeleton className="h-10 w-full rounded-xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>
  }

  const m2oVal = (v: any) => Array.isArray(v) ? v[1] : ''
  const state = form.state || 'draft'
  const isDraft = state === 'draft'
  const isSent = state === 'sent'
  const isSale = state === 'sale'

  const smartButtons: SmartButton[] = [
    form.delivery_count > 0 && { label: 'Delivery', value: form.delivery_count, icon: <Truck className="h-5 w-5" /> },
    form.invoice_count > 0 && { label: 'Invoices', value: form.invoice_count, icon: <FileText className="h-5 w-5" /> },
  ].filter(Boolean) as SmartButton[]

  // Order lines table
  const OrderLinesTable = () => (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border/40">
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider w-[35%]">Product</TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-[10%]">Qty</TableHead>
            {isSale && <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-[10%]">Delivered</TableHead>}
            {isSale && <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-[10%]">Invoiced</TableHead>}
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-[12%]">Unit Price</TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-[8%]">Disc.%</TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-[15%]">Subtotal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.length === 0 ? (
            <TableRow>
              <TableCell colSpan={isSale ? 7 : 5} className="h-20 text-center text-muted-foreground">No order lines</TableCell>
            </TableRow>
          ) : lines.map(line => {
            if (line.display_type === 'line_section') return (
              <TableRow key={line.id} className="bg-muted/20 hover:bg-muted/30"><TableCell colSpan={isSale ? 7 : 5} className="font-semibold text-sm py-2">{line.name}</TableCell></TableRow>
            )
            if (line.display_type === 'line_note') return (
              <TableRow key={line.id} className="hover:bg-transparent"><TableCell colSpan={isSale ? 7 : 5} className="text-sm text-muted-foreground italic py-1.5">{line.name}</TableCell></TableRow>
            )
            return (
              <TableRow key={line.id} className="border-border/30 hover:bg-muted/10">
                <TableCell className="py-2">
                  <p className="text-sm font-medium">{Array.isArray(line.product_id) ? line.product_id[1] : 'Product'}</p>
                  {line.name && line.name !== (Array.isArray(line.product_id) ? line.product_id[1] : '') && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{line.name}</p>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{Number(line.product_uom_qty || 0).toFixed(2)}</TableCell>
                {isSale && <TableCell className="text-right font-mono text-sm">{Number(line.qty_delivered || 0).toFixed(2)}</TableCell>}
                {isSale && <TableCell className="text-right font-mono text-sm">{Number(line.qty_invoiced || 0).toFixed(2)}</TableCell>}
                <TableCell className="text-right font-mono text-sm">${Number(line.price_unit || 0).toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">{line.discount ? `${line.discount}%` : ''}</TableCell>
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
      key: 'lines', label: 'Order Lines',
      content: (
        <div className="space-y-3">
          <OrderLinesTable />
          <div className="flex justify-end">
            <div className="w-64 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Untaxed Amount</span><span className="font-mono">${Number(form.amount_untaxed || 0).toFixed(2)}</span></div>
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
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-3">
          <div className="space-y-3">
            <FormField label="Salesperson">
              {editing ? <M2OInput value={form.user_id} model="res.users" onChange={v => setField('user_id', v)} /> : <ReadonlyField label="" value={m2oVal(form.user_id)} />}
            </FormField>
            <FormField label="Sales Team">
              {editing ? <M2OInput value={form.team_id} model="crm.team" onChange={v => setField('team_id', v)} /> : <ReadonlyField label="" value={m2oVal(form.team_id)} />}
            </FormField>
            {editing ? (
              <FormField label="Customer Reference"><Input value={form.client_order_ref || ''} onChange={e => setField('client_order_ref', e.target.value)} className="rounded-xl h-9" /></FormField>
            ) : (
              <ReadonlyField label="Customer Reference" value={form.client_order_ref} />
            )}
            <ReadonlyField label="Source Document" value={form.origin} />
          </div>
          <div className="space-y-3">
            <FormField label="Fiscal Position">
              {editing ? <M2OInput value={form.fiscal_position_id} model="account.fiscal.position" onChange={v => setField('fiscal_position_id', v)} /> : <ReadonlyField label="" value={m2oVal(form.fiscal_position_id)} />}
            </FormField>
            <FormField label="Warehouse">
              {editing ? <M2OInput value={form.warehouse_id} model="stock.warehouse" onChange={v => setField('warehouse_id', v)} /> : <ReadonlyField label="" value={m2oVal(form.warehouse_id)} />}
            </FormField>
            {editing ? (
              <FormField label="Delivery Date"><Input type="datetime-local" value={form.commitment_date ? form.commitment_date.replace(' ', 'T').slice(0, 16) : ''} onChange={e => setField('commitment_date', e.target.value ? e.target.value.replace('T', ' ') + ':00' : false)} className="rounded-xl h-9" /></FormField>
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
  ]

  return (
    <RecordForm
      editing={editing} onEdit={() => setEditing(true)} onSave={() => saveMut.mutate()}
      onDiscard={() => { if (isNew) navigate(-1); else { setForm({ ...record }); setLines(lineData || []); setEditing(false) } }}
      backTo="/sales/orders"
      statusBar={<StatusBar steps={STATES} current={state} />}
      headerActions={
        <>
          {isDraft && <Button variant="default" size="sm" className="rounded-xl gap-1.5" onClick={() => callAction('send', 'Send Quotation')}><Send className="h-3.5 w-3.5" /> Send</Button>}
          {(isDraft || isSent) && <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => callAction('confirm', 'Confirm Order')}><CheckCircle className="h-3.5 w-3.5" /> Confirm</Button>}
          {!isNew && <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-muted-foreground"><Printer className="h-3.5 w-3.5" /> Print</Button>}
          {isDraft && <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-muted-foreground"><Eye className="h-3.5 w-3.5" /> Preview</Button>}
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
            <FormField label="Expiration"><Input type="date" value={form.validity_date || ''} onChange={e => setField('validity_date', e.target.value || false)} className="rounded-xl h-9" /></FormField>
          ) : (
            <ReadonlyField label="Expiration" value={form.validity_date ? new Date(form.validity_date).toLocaleDateString() : ''} />
          )}
        </>
      }
      rightFields={
        <>
          <ReadonlyField label="Order Date" value={form.date_order ? new Date(form.date_order).toLocaleString() : ''} />
          <FormField label="Payment Terms">
            {editing ? <M2OInput value={form.payment_term_id} model="account.payment.term" onChange={v => setField('payment_term_id', v)} /> : <ReadonlyField label="" value={m2oVal(form.payment_term_id)} />}
          </FormField>
        </>
      }
      tabs={tabs}
      chatter={recordId ? <Chatter model="sale.order" resId={recordId} /> : undefined}
    />
  )
}
