import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Input, Button, Badge, Skeleton,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cn,
} from '@mashora/design-system'
import { Send, CheckCircle, Printer, CreditCard, RotateCcw, FileText, XCircle } from 'lucide-react'
import { RecordForm, FormField, ReadonlyField, StatusBar, toast, type SmartButton, type FormTab } from '@/components/shared'
import { sanitizedHtml } from '@/lib/sanitize'
import Chatter from '@/components/Chatter'
import { erpClient } from '@/lib/erp-api'

const FORM_FIELDS = [
  'id', 'name', 'partner_id', 'move_type', 'state', 'date', 'invoice_date',
  'invoice_date_due', 'amount_untaxed', 'amount_tax', 'amount_total', 'amount_residual',
  'currency_id', 'journal_id', 'invoice_user_id', 'payment_state',
  'ref', 'narration', 'invoice_origin', 'fiscal_position_id', 'company_id',
  'invoice_line_ids',
]

const LINE_FIELDS = [
  'id', 'sequence', 'product_id', 'name', 'account_id', 'quantity',
  'price_unit', 'discount', 'price_subtotal', 'price_total', 'tax_ids', 'display_type',
]

const STATES = [
  { key: 'draft', label: 'Draft' },
  { key: 'posted', label: 'Posted', color: 'success' as const },
  { key: 'cancel', label: 'Cancelled' },
]

const PAYMENT_COLORS: Record<string, string> = {
  not_paid: 'text-amber-400', partial: 'text-blue-400', in_payment: 'text-blue-400',
  paid: 'text-emerald-400', reversed: 'text-red-400',
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id || id === 'new'
  const recordId = isNew ? null : parseInt(id || '0')
  const [editing, setEditing] = useState(isNew)
  const [form, setForm] = useState<Record<string, any>>({})
  const [lines, setLines] = useState<any[]>([])

  const { data: record, isLoading } = useQuery({
    queryKey: ['invoice', recordId],
    queryFn: async () => {
      if (isNew) {
        const { data } = await erpClient.raw.post('/model/account.move/defaults', { fields: FORM_FIELDS })
        return { ...data, id: null, state: 'draft', move_type: 'out_invoice' }
      }
      const { data } = await erpClient.raw.get(`/model/account.move/${recordId}`)
      return data
    },
  })

  const { data: lineData } = useQuery({
    queryKey: ['invoice-lines', recordId],
    queryFn: async () => {
      if (!recordId) return []
      const { data } = await erpClient.raw.post('/model/account.move.line', {
        domain: [['move_id', '=', recordId], ['display_type', 'in', ['product', 'line_section', 'line_note', false]]],
        fields: LINE_FIELDS, order: 'sequence asc, id asc', limit: 200,
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
    if (!partnerId) errs.partner_id = 'Customer/Vendor is required'
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
      for (const f of ['ref', 'narration', 'invoice_date', 'invoice_date_due', 'move_type']) {
        if (form[f] !== record?.[f]) vals[f] = form[f] ?? false
      }
      for (const f of ['partner_id', 'journal_id', 'invoice_user_id', 'fiscal_position_id']) {
        const nv = Array.isArray(form[f]) ? form[f][0] : form[f]
        const ov = Array.isArray(record?.[f]) ? record[f][0] : record?.[f]
        if (nv !== ov) vals[f] = nv || false
      }
      if (isNew) {
        if (!vals.partner_id && form.partner_id) vals.partner_id = Array.isArray(form.partner_id) ? form.partner_id[0] : form.partner_id
        vals.move_type = form.move_type || 'out_invoice'
        const { data } = await erpClient.raw.post('/model/account.move/create', { vals })
        return data
      }
      const { data } = await erpClient.raw.put(`/model/account.move/${recordId}`, { vals })
      return data
    },
    onSuccess: (data) => {
      setEditing(false)
      setErrors({})
      toast.success('Saved', 'Invoice saved successfully')
      queryClient.invalidateQueries({ queryKey: ['invoice'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      if (isNew && data?.id) navigate(`/admin/invoicing/invoices/${data.id}`, { replace: true })
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
      await erpClient.raw.post('/model/account.move/call', { record_ids: [recordId], method })
      toast.success('Action Complete', `${method.replace('action_', '').replace('button_', '').replace(/_/g, ' ')} executed`)
      queryClient.invalidateQueries({ queryKey: ['invoice', recordId] })
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
  const isPosted = state === 'posted'
  const moveType = form.move_type || 'out_invoice'
  const isInvoice = moveType === 'out_invoice'
  const isBill = moveType === 'in_invoice'
  const TYPE_LABELS: Record<string, string> = { out_invoice: 'Invoice', out_refund: 'Credit Note', in_invoice: 'Bill', in_refund: 'Refund' }
  const typeLabel = TYPE_LABELS[moveType] || 'Entry'
  const paymentState = form.payment_state || 'not_paid'

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

  const LinesTable = () => (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border/40">
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider w-[30%]">Product</TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider w-[20%]">Account</TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-[8%]">Qty</TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-[12%]">Price</TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-[8%]">Disc.%</TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-[12%]">Subtotal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.length === 0 ? (
            <TableRow><TableCell colSpan={6} className="h-20 text-center text-muted-foreground">No invoice lines</TableCell></TableRow>
          ) : lines.map(line => {
            if (line.display_type === 'line_section') return (
              <TableRow key={line.id} className="bg-muted/20"><TableCell colSpan={6} className="font-semibold text-sm py-2">{line.name}</TableCell></TableRow>
            )
            if (line.display_type === 'line_note') return (
              <TableRow key={line.id}><TableCell colSpan={6} className="text-sm text-muted-foreground italic py-1.5">{line.name}</TableCell></TableRow>
            )
            return (
              <TableRow key={line.id} className="border-border/30 hover:bg-muted/10">
                <TableCell className="py-2">
                  <p className="text-sm font-medium">{Array.isArray(line.product_id) ? line.product_id[1] : line.name || '—'}</p>
                  {line.name && Array.isArray(line.product_id) && line.name !== line.product_id[1] && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{line.name}</p>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{Array.isArray(line.account_id) ? line.account_id[1] : ''}</TableCell>
                <TableCell className="text-right font-mono text-sm">{Number(line.quantity || 0).toFixed(2)}</TableCell>
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
      key: 'lines', label: `${typeLabel} Lines`,
      content: (
        <div className="space-y-3">
          <LinesTable />
          <div className="flex justify-end">
            <div className="w-72 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Untaxed</span><span className="font-mono">${Number(form.amount_untaxed || 0).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Taxes</span><span className="font-mono">${Number(form.amount_tax || 0).toFixed(2)}</span></div>
              <div className="flex justify-between border-t border-border/40 pt-1.5 font-semibold text-base"><span>Total</span><span className="font-mono">${Number(form.amount_total || 0).toFixed(2)}</span></div>
              {isPosted && paymentState !== 'paid' && (
                <div className="flex justify-between pt-1"><span className="text-muted-foreground">Amount Due</span>
                  <span className="font-mono font-semibold text-amber-400">${Number(form.amount_residual || 0).toFixed(2)}</span></div>
              )}
              {isPosted && paymentState === 'paid' && (
                <div className="flex justify-between pt-1"><span className="text-emerald-400 font-medium">Fully Paid</span></div>
              )}
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
            <M2O field="invoice_user_id" model="res.users" label="Salesperson" />
            <TF field="invoice_origin" label="Source Document" />
            <TF field="ref" label="Reference" />
          </div>
          <div className="space-y-2">
            <M2O field="journal_id" model="account.journal" label="Journal" />
            <M2O field="fiscal_position_id" model="account.fiscal.position" label="Fiscal Position" />
          </div>
        </div>
      ),
    },
    {
      key: 'terms', label: 'Terms',
      content: editing
        ? <FormField label="Terms and Conditions"><Input value={form.narration || ''} onChange={e => setField('narration', e.target.value)} className="rounded-xl h-9" /></FormField>
        : <ReadonlyField label="Terms and Conditions" value={form.narration ? <span dangerouslySetInnerHTML={sanitizedHtml(form.narration)} /> : undefined} />,
    },
  ]

  return (
    <RecordForm
      editing={editing} onEdit={() => isDraft && setEditing(true)} onSave={() => saveMut.mutate()}
      onDiscard={() => { if (isNew) navigate(-1); else { setForm({ ...record }); setLines(lineData || []); setEditing(false) } }}
      backTo="/admin/invoicing/invoices"
      statusBar={<StatusBar steps={STATES} current={state} />}
      headerActions={
        <>
          {isDraft && <Button variant="default" size="sm" className="rounded-xl gap-1.5" onClick={() => callMethod('action_post')}><CheckCircle className="h-3.5 w-3.5" /> Confirm</Button>}
          {isDraft && <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => callMethod('action_send_and_print')}><Send className="h-3.5 w-3.5" /> Send & Print</Button>}
          {isPosted && paymentState !== 'paid' && (
            <Button variant="default" size="sm" className="rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => callMethod('action_register_payment')}>
              <CreditCard className="h-3.5 w-3.5" /> Register Payment
            </Button>
          )}
          {isPosted && <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-muted-foreground" onClick={() => callMethod('action_reverse')}><RotateCcw className="h-3.5 w-3.5" /> Reverse</Button>}
          {isDraft && recordId && <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-destructive" onClick={async () => {
            if (!confirm('Cancel this invoice?')) return
            try { await erpClient.raw.post('/model/account.move/call', { record_ids: [recordId], method: 'button_cancel' }); toast.success('Cancelled'); queryClient.invalidateQueries({ queryKey: ['invoice', recordId] }) }
            catch (e: any) { toast.error('Cancel Failed', e?.response?.data?.detail || e.message) }
          }}><XCircle className="h-3.5 w-3.5" /> Cancel</Button>}
          {!isNew && <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-muted-foreground"><Printer className="h-3.5 w-3.5" /> Print</Button>}
          {/* Payment status badge */}
          {isPosted && (
            <Badge className={cn('rounded-full text-xs ml-2', PAYMENT_COLORS[paymentState])}>
              {paymentState === 'paid' ? 'Paid' : paymentState === 'partial' ? 'Partial' : paymentState === 'not_paid' ? 'Not Paid' : paymentState}
            </Badge>
          )}
        </>
      }
      topContent={
        <div className="mb-2">
          <ReadonlyField label={typeLabel} value={<span className="text-lg font-bold">{!form.name || form.name === '/' ? 'Draft' : form.name}</span>} />
        </div>
      }
      leftFields={
        <>
          <M2O field="partner_id" model="res.partner" label={isInvoice ? 'Customer' : 'Vendor'} required
            errorMsg={errors.partner_id}
            onSelect={() => setErrors(er => { const n = { ...er }; delete n.partner_id; return n })} />
          <TF field="invoice_date" label={`${typeLabel} Date`} type="date" />
        </>
      }
      rightFields={
        <>
          <TF field="invoice_date_due" label="Due Date" type="date" />
          <M2O field="journal_id" model="account.journal" label="Journal" />
        </>
      }
      tabs={tabs}
      chatter={recordId ? <Chatter model="account.move" resId={recordId} /> : undefined}
    />
  )
}
