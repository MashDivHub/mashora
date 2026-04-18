import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Input, Button, Badge, Skeleton, cn, Textarea,
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  Label,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@mashora/design-system'
import { Send, CheckCircle, Printer, CreditCard, RotateCcw, FileText, XCircle, Eye } from 'lucide-react'
import { RecordForm, FormField, ReadonlyField, StatusBar, OrderLinesEditor, EmailComposer, AttachmentSection, PrintableReport, M2OInput, toast, type SmartButton, type FormTab } from '@/components/shared'
import { sanitizedHtml } from '@/lib/sanitize'
import Chatter from '@/components/Chatter'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'
import type { M2OValue } from '@/components/shared/OrderLinesEditor'

interface InvoiceLine {
  id: number
  sequence?: number
  product_id?: [number, string] | false
  name?: string
  account_id?: [number, string] | false
  quantity?: number
  price_unit?: number
  discount?: number
  price_subtotal?: number
  price_total?: number
  tax_ids?: number[]
  display_type?: string
  [k: string]: unknown
}

interface InvoiceForm {
  id?: number | null
  name?: string
  partner_id?: [number, string] | false | number
  move_type?: string
  state?: string
  date?: string | false
  invoice_date?: string | false
  invoice_date_due?: string | false
  amount_untaxed?: number
  amount_tax?: number
  amount_total?: number
  amount_residual?: number
  currency_id?: [number, string] | false
  journal_id?: [number, string] | false | number
  invoice_user_id?: [number, string] | false | number
  payment_state?: string
  ref?: string
  narration?: string
  invoice_origin?: string
  fiscal_position_id?: [number, string] | false | number
  company_id?: [number, string] | false
  invoice_line_ids?: number[]
  [key: string]: unknown
}

interface NameSearchResult { id: number; display_name: string }

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

// Print-context colors. Inline styles are intentional for printable HTML
// (the print window does not always have Tailwind's theme vars available),
// so hexes stay as literals — consolidated here for a single source of truth.
const PRINT_COLORS = {
  muted: '#666',
  subtle: '#999',
  body: '#444',
  border: '#ddd',
  accent: '#b45309', // amber-700 — used to highlight "Amount Due"
} as const

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id || id === 'new'
  const recordId = isNew ? null : parseInt(id || '0')
  const [editing, setEditing] = useState(isNew)
  const [form, setForm] = useState<InvoiceForm>({})
  const [lines, setLines] = useState<InvoiceLine[]>([])

  // Dialog state
  const [payOpen, setPayOpen] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payJournalId, setPayJournalId] = useState<string>('')
  const [payDate, setPayDate] = useState('')

  const [reverseOpen, setReverseOpen] = useState(false)
  const [reverseReason, setReverseReason] = useState('')
  const [reverseDate, setReverseDate] = useState('')

  const [emailOpen, setEmailOpen] = useState(false)
  const [emailDefaults, setEmailDefaults] = useState<{ to: string[]; subject: string; body: string }>({ to: [], subject: '', body: '' })

  const [previewOpen, setPreviewOpen] = useState(false)

  const printTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (printTimerRef.current) clearTimeout(printTimerRef.current) }, [])

  const { data: record, isLoading } = useQuery<InvoiceForm & { partner_email?: string; company_id?: [number, string] | false }>({
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

  // Journals for the payment dialog
  const { data: journals } = useQuery({
    queryKey: ['payment-journals'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.post('/accounting/journals', { type: ['bank', 'cash'] })
        return data?.records || data?.results || []
      } catch {
        return []
      }
    },
  })

  useEffect(() => { if (record) { setForm({ ...record }); setLines(lineData || []) } }, [record, lineData])
  const setField = useCallback((n: string, v: unknown) => { setForm(p => ({ ...p, [n]: v })) }, [])

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
      const vals: Record<string, unknown> = {}
      for (const f of ['ref', 'narration', 'invoice_date', 'invoice_date_due', 'move_type']) {
        if (form[f] !== record?.[f]) vals[f] = form[f] ?? false
      }
      for (const f of ['partner_id', 'journal_id', 'invoice_user_id', 'fiscal_position_id']) {
        const fv = form[f]
        const rv = record?.[f]
        const nv = Array.isArray(fv) ? fv[0] : fv
        const ov = Array.isArray(rv) ? rv[0] : rv
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
    onError: (e: unknown) => {
      const msg = extractErrorMessage(e)
      if (msg !== 'Validation failed') {
        toast.error('Save Failed', msg)
      }
    },
  })

  // ---------- Workflow Actions ----------
  const postMut = useMutation({
    mutationFn: async () => {
      if (!recordId) throw new Error('No record')
      const { data } = await erpClient.raw.post(`/accounting/invoices/${recordId}/post`)
      return data
    },
    onSuccess: () => {
      toast.success('Posted', 'Invoice posted successfully')
      queryClient.invalidateQueries({ queryKey: ['invoice', recordId] })
    },
    onError: (e: unknown) => toast.error('Post Failed', extractErrorMessage(e)),
  })

  const cancelMut = useMutation({
    mutationFn: async () => {
      if (!recordId) throw new Error('No record')
      const { data } = await erpClient.raw.post(`/accounting/invoices/${recordId}/cancel`)
      return data
    },
    onSuccess: () => {
      toast.success('Cancelled', 'Invoice cancelled')
      queryClient.invalidateQueries({ queryKey: ['invoice', recordId] })
    },
    onError: (e: unknown) => toast.error('Cancel Failed', extractErrorMessage(e)),
  })

  const draftMut = useMutation({
    mutationFn: async () => {
      if (!recordId) throw new Error('No record')
      const { data } = await erpClient.raw.post(`/accounting/invoices/${recordId}/draft`)
      return data
    },
    onSuccess: () => {
      toast.success('Set to Draft', 'Invoice moved back to draft')
      queryClient.invalidateQueries({ queryKey: ['invoice', recordId] })
    },
    onError: (e: unknown) => toast.error('Action Failed', extractErrorMessage(e)),
  })

  const reverseMut = useMutation({
    mutationFn: async () => {
      if (!recordId) throw new Error('No record')
      const { data } = await erpClient.raw.post(`/accounting/invoices/${recordId}/reverse`, {
        reason: reverseReason,
        reverse_date: reverseDate || undefined,
      })
      return data
    },
    onSuccess: () => {
      toast.success('Reversed', 'Reversal entry created')
      setReverseOpen(false)
      setReverseReason('')
      setReverseDate('')
      queryClient.invalidateQueries({ queryKey: ['invoice', recordId] })
    },
    onError: (e: unknown) => toast.error('Reverse Failed', extractErrorMessage(e)),
  })

  const registerPaymentMut = useMutation({
    mutationFn: async () => {
      if (!recordId) throw new Error('No record')
      const body: Record<string, unknown> = {
        amount: payAmount ? Number(payAmount) : undefined,
        journal_id: payJournalId ? Number(payJournalId) : undefined,
        payment_date: payDate || undefined,
      }
      const { data } = await erpClient.raw.post(`/accounting/invoices/${recordId}/register-payment`, body)
      return data
    },
    onSuccess: () => {
      toast.success('Payment Registered', `Payment of $${payAmount} recorded`)
      setPayOpen(false)
      setPayAmount('')
      setPayJournalId('')
      setPayDate('')
      queryClient.invalidateQueries({ queryKey: ['invoice', recordId] })
    },
    onError: (e: unknown) => toast.error('Payment Failed', extractErrorMessage(e)),
  })

  const markSentMut = useMutation({
    mutationFn: async () => {
      if (!recordId) throw new Error('No record')
      await erpClient.raw.post('/model/account.move/call', {
        record_ids: [recordId],
        method: 'action_invoice_sent',
      })
      return true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', recordId] })
    },
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
  const state = form.state || 'draft'
  const isDraft = state === 'draft'
  const isPosted = state === 'posted'
  const isCancel = state === 'cancel'
  const moveType = form.move_type || 'out_invoice'
  const isInvoice = moveType === 'out_invoice'
  // const isBill = moveType === 'in_invoice'
  const TYPE_LABELS: Record<string, string> = { out_invoice: 'Invoice', out_refund: 'Credit Note', in_invoice: 'Bill', in_refund: 'Refund' }
  const typeLabel = TYPE_LABELS[moveType] || 'Entry'
  const paymentState = form.payment_state || 'not_paid'

  const openPaymentDialog = () => {
    setPayAmount(String(form.amount_residual || form.amount_total || ''))
    setPayDate(new Date().toISOString().slice(0, 10))
    setPayOpen(true)
  }

  const openReverseDialog = () => {
    setReverseReason('')
    setReverseDate(new Date().toISOString().slice(0, 10))
    setReverseOpen(true)
  }

  const openEmailDialog = () => {
    const partnerEmail = record?.partner_email || ''
    const refLabel = form.name && form.name !== '/' ? form.name : ''
    setEmailDefaults({
      to: partnerEmail ? [partnerEmail] : [],
      subject: `${typeLabel} ${refLabel}`.trim(),
      body: `<p>Dear customer,</p><p>Please find attached your ${typeLabel.toLowerCase()}${refLabel ? ` ${refLabel}` : ''}.</p><p>Best regards,</p>`,
    })
    setEmailOpen(true)
  }

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

  // Render function (not a component) — keeps the <Input> from being remounted
  // on every parent render, which would steal focus after each keystroke.
  const TF = (field: string, label: string, opts: { type?: string; help?: string } = {}) => {
    const fv = form[field]
    const strVal = (typeof fv === 'string' || typeof fv === 'number') ? fv : ''
    if (!editing) return <ReadonlyField label={label} value={strVal || undefined} />
    return <FormField label={label} help={opts.help}><Input type={opts.type || 'text'} value={strVal} onChange={e => setField(field, e.target.value)} className="rounded-xl h-9" /></FormField>
  }

  const linesLocked = state !== 'draft'

  const tabs: FormTab[] = [
    {
      key: 'lines', label: `${typeLabel} Lines`,
      content: (
        <div className="space-y-3">
          <OrderLinesEditor
            lines={lines}
            parentId={recordId}
            parentField="move_id"
            lineModel="account.move.line"
            qtyField="quantity"
            showDiscount
            showAccount
            readonly={linesLocked}
            onChanged={() => {
              queryClient.invalidateQueries({ queryKey: ['invoice', recordId] })
              queryClient.invalidateQueries({ queryKey: ['invoice-lines', recordId] })
            }}
          />
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
            <M2O field="invoice_user_id" model="res.users" label="Salesperson" help="The person responsible for this invoice. Used for sales commission and filtering." />
            {TF("invoice_origin", "Source Document", { help: "The document that triggered this invoice (e.g. a sales order number). Helps trace the invoice back to its origin." })}
            {TF("ref", "Reference", { help: "Your own internal reference or memo for this invoice. Searchable on the invoice list." })}
          </div>
          <div className="space-y-2">
            <M2O field="journal_id" model="account.journal" label="Journal" help="Which journal this invoice is booked in. Usually 'Customer Invoices' for receivables or 'Vendor Bills' for payables." />
            <M2O field="fiscal_position_id" model="account.fiscal.position" label="Fiscal Position" help="Overrides the default tax & account mappings — e.g. for export sales (tax-free) or inter-company transactions." />
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
    {
      key: 'attachments', label: 'Attachments',
      content: <AttachmentSection resModel="account.move" resId={recordId} />,
    },
  ]

  return (
    <>
      <RecordForm
        editing={editing} onEdit={() => isDraft && setEditing(true)} onSave={() => saveMut.mutate()}
        onDiscard={() => { if (isNew) navigate(-1); else { setForm({ ...record }); setLines(lineData || []); setEditing(false) } }}
        backTo="/admin/invoicing/invoices"
        statusBar={<StatusBar steps={STATES} current={state} />}
        headerActions={
          <>
            {/* Draft */}
            {isDraft && (
              <Button variant="default" size="sm" className="rounded-xl gap-1.5" onClick={() => postMut.mutate()} disabled={postMut.isPending}>
                <CheckCircle className="h-3.5 w-3.5" /> Post
              </Button>
            )}
            {isDraft && recordId && (
              <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-destructive" onClick={() => {
                if (!confirm('Cancel this invoice?')) return
                cancelMut.mutate()
              }} disabled={cancelMut.isPending}>
                <XCircle className="h-3.5 w-3.5" /> Cancel
              </Button>
            )}

            {/* Posted */}
            {isPosted && paymentState !== 'paid' && (
              <Button variant="default" size="sm" className="rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={openPaymentDialog}>
                <CreditCard className="h-3.5 w-3.5" /> Register Payment
              </Button>
            )}
            {isPosted && (
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={openReverseDialog}>
                <RotateCcw className="h-3.5 w-3.5" /> Reverse
              </Button>
            )}
            {isPosted && (
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={openEmailDialog}>
                <Send className="h-3.5 w-3.5" /> Send & Print
              </Button>
            )}

            {/* Cancel: Set to Draft */}
            {isCancel && recordId && (
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => draftMut.mutate()} disabled={draftMut.isPending}>
                <RotateCcw className="h-3.5 w-3.5" /> Set to Draft
              </Button>
            )}

            {/* Always-visible Preview & Print */}
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
              onSelect={() => setErrors(er => { const n = { ...er }; delete n.partner_id; return n })}
              help={isInvoice ? "The customer being billed." : "The vendor whose bill you're recording."} />
            {TF("invoice_date", `${typeLabel} Date`, { type: "date", help: "The date printed on the invoice/bill — normally when goods or services were delivered." })}
          </>
        }
        rightFields={
          <>
            {TF("invoice_date_due", "Due Date", { type: "date", help: "Payment due date. Usually computed from the payment terms, but you can override it here." })}
            <M2O field="journal_id" model="account.journal" label="Journal" help="Which journal this invoice is booked in. Usually the default for the move type (Customer Invoices / Vendor Bills)." />
          </>
        }
        tabs={tabs}
        chatter={recordId ? <Chatter model="account.move" resId={recordId} /> : undefined}
      />

      {/* Register Payment Dialog */}
      <Dialog open={payOpen} onOpenChange={v => !v && setPayOpen(false)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-emerald-400" /> Register Payment</DialogTitle>
            <DialogDescription>Record a payment against this invoice.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="pay-amount" className="text-xs text-muted-foreground">Amount</Label>
              <Input id="pay-amount" type="number" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="rounded-xl h-9 mt-1" />
            </div>
            <div>
              <Label htmlFor="pay-journal" className="text-xs text-muted-foreground">Journal</Label>
              <Select value={payJournalId} onValueChange={setPayJournalId}>
                <SelectTrigger id="pay-journal" className="rounded-xl h-9 mt-1">
                  <SelectValue placeholder="Select journal" />
                </SelectTrigger>
                <SelectContent>
                  {((journals as { id: number; name?: string; display_name?: string }[] | undefined) || []).map((j) => (
                    <SelectItem key={j.id} value={String(j.id)}>{j.name || j.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="pay-date" className="text-xs text-muted-foreground">Payment Date</Label>
              <Input id="pay-date" type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="rounded-xl h-9 mt-1" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setPayOpen(false)} className="rounded-xl" disabled={registerPaymentMut.isPending}>Cancel</Button>
            <Button onClick={() => registerPaymentMut.mutate()} className="rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700" disabled={registerPaymentMut.isPending || !payAmount}>
              <CreditCard className="h-3.5 w-3.5" /> {registerPaymentMut.isPending ? 'Registering...' : 'Register'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reverse Dialog */}
      <Dialog open={reverseOpen} onOpenChange={v => !v && setReverseOpen(false)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><RotateCcw className="h-5 w-5 text-amber-400" /> Reverse Invoice</DialogTitle>
            <DialogDescription>Create a credit note that reverses this invoice.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="rev-reason" className="text-xs text-muted-foreground">Reason</Label>
              <Textarea id="rev-reason" value={reverseReason} onChange={e => setReverseReason(e.target.value)} rows={3} className="rounded-xl mt-1" placeholder="Explain why you are reversing this invoice..." />
            </div>
            <div>
              <Label htmlFor="rev-date" className="text-xs text-muted-foreground">Reversal Date</Label>
              <Input id="rev-date" type="date" value={reverseDate} onChange={e => setReverseDate(e.target.value)} className="rounded-xl h-9 mt-1" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setReverseOpen(false)} className="rounded-xl" disabled={reverseMut.isPending}>Cancel</Button>
            <Button variant="destructive" onClick={() => reverseMut.mutate()} className="rounded-xl gap-1.5" disabled={reverseMut.isPending || !reverseReason}>
              <RotateCcw className="h-3.5 w-3.5" /> {reverseMut.isPending ? 'Reversing...' : 'Reverse'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EmailComposer
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        resModel="account.move"
        resId={recordId || undefined}
        defaultTo={emailDefaults.to}
        defaultSubject={emailDefaults.subject}
        defaultBody={emailDefaults.body}
        onSent={() => {
          // Mark the invoice as sent in the ERP, then trigger the print dialog.
          markSentMut.mutate()
          if (printTimerRef.current) clearTimeout(printTimerRef.current)
          printTimerRef.current = setTimeout(() => window.print(), 300)
        }}
      />

      {/* Preview PDF — printable report */}
      <PrintableReport
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`${typeLabel} ${form.name && form.name !== '/' ? form.name : 'Draft'}`}
      >
        <div className="header">
          <div>
            <h1>{(Array.isArray(record?.company_id) ? record.company_id[1] : '') || 'Mashora'}</h1>
            <p style={{ fontSize: 12, color: PRINT_COLORS.muted, margin: '4px 0' }}>Your Company Address Line 1</p>
            <p style={{ fontSize: 12, color: PRINT_COLORS.muted, margin: 0 }}>City, State ZIP</p>
          </div>
          <div className="right">
            <h1 style={{ textTransform: 'uppercase' }}>{typeLabel}</h1>
            <p style={{ fontSize: 14, margin: '4px 0' }}>#{form.name && form.name !== '/' ? form.name : 'DRAFT'}</p>
            <p style={{ fontSize: 12, color: PRINT_COLORS.muted, margin: '8px 0 0' }}>Date: {form.invoice_date ? new Date(form.invoice_date).toLocaleDateString() : '-'}</p>
            {form.invoice_date_due && (
              <p style={{ fontSize: 12, color: PRINT_COLORS.muted, margin: 0 }}>Due: {new Date(form.invoice_date_due).toLocaleDateString()}</p>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          <div>
            <h2>Bill To</h2>
            <p style={{ margin: 0, fontWeight: 600 }}>{m2oVal(form.partner_id) || '-'}</p>
            {form.ref && <p style={{ fontSize: 12, color: PRINT_COLORS.muted, margin: '4px 0 0' }}>Ref: {form.ref}</p>}
          </div>
          <div>
            <h2>Ship To</h2>
            <p style={{ margin: 0, fontWeight: 600 }}>{m2oVal(form.partner_id) || '-'}</p>
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
                <td className="right">{Number(l.quantity || 0).toFixed(2)}</td>
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
              {isPosted && paymentState !== 'paid' && (
                <tr><td style={{ color: PRINT_COLORS.accent }}>Amount Due</td><td className="right" style={{ color: PRINT_COLORS.accent }}>${Number(form.amount_residual || 0).toFixed(2)}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {form.narration && (
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${PRINT_COLORS.border}` }}>
            <h2>Terms &amp; Conditions</h2>
            <div style={{ fontSize: 12, color: PRINT_COLORS.body }} dangerouslySetInnerHTML={sanitizedHtml(form.narration)} />
          </div>
        )}
      </PrintableReport>
    </>
  )
}
