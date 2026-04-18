import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Input, Skeleton, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@mashora/design-system'
import {
  PageHeader, StatusBar, FormSection, ReadonlyField, ConfirmDialog, M2OInput, AttachmentSection, toast,
} from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'
import { Check, Send, Trash2, Receipt, ScanLine, Loader2 } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type ExpenseState = 'draft' | 'reported' | 'approved' | 'done' | 'refused'

interface ExpenseDetail {
  id: number
  name: string | false
  state: ExpenseState
  employee_id: [number, string] | false
  product_id: [number, string] | false
  unit_amount: number
  quantity: number
  total_amount: number
  currency_id: [number, string] | false
  date: string | false
  payment_mode: 'own_account' | 'company_account' | false
  description: string | false
  reference: string | false
  sheet_id: [number, string] | false
}

// ─── Status steps ─────────────────────────────────────────────────────────────

const STATUS_STEPS = [
  { key: 'draft', label: 'New' },
  { key: 'reported', label: 'Reported' },
  { key: 'approved', label: 'Approved' },
  { key: 'done', label: 'Paid', color: 'success' as const },
]
const REFUSED_STEP = { key: 'refused', label: 'Refused', color: 'danger' as const }

function getStepsForState(state: ExpenseState) {
  if (state === 'refused') return [...STATUS_STEPS, REFUSED_STEP]
  return STATUS_STEPS
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type M2OValue = [number, string] | false | number | null

const m2oLabel = (v: M2OValue | undefined) => (Array.isArray(v) ? v[1] : '—')
const m2oId = (v: unknown): number | null => {
  if (Array.isArray(v)) return (v[0] as number) ?? null
  if (typeof v === 'number' && v > 0) return v
  return null
}

// ─── Form ─────────────────────────────────────────────────────────────────────

interface FormState {
  name: string
  employee_id: M2OValue
  product_id: M2OValue
  unit_amount: number
  quantity: number
  date: string
  payment_mode: 'own_account' | 'company_account'
  reference: string
  description: string
}

const EMPTY_FORM: FormState = {
  name: '',
  employee_id: false,
  product_id: false,
  unit_amount: 0,
  quantity: 1,
  date: new Date().toISOString().split('T')[0],
  payment_mode: 'own_account',
  reference: '',
  description: '',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExpenseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id || id === 'new'
  const recordId = isNew ? null : parseInt(id || '0')

  const [editing, setEditing] = useState(isNew)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(p => ({ ...p, [k]: v }))

  const { data: record, isLoading } = useQuery<ExpenseDetail>({
    queryKey: ['expense', recordId],
    queryFn: () => erpClient.raw.get(`/hr/expenses/${recordId}`).then(r => r.data),
    enabled: !isNew && !!recordId && recordId > 0,
  })

  useEffect(() => {
    if (record) {
      setForm({
        name: (record.name as string) || '',
        employee_id: record.employee_id || false,
        product_id: record.product_id || false,
        unit_amount: record.unit_amount ?? 0,
        quantity: record.quantity ?? 1,
        date: record.date ? (record.date as string).split(' ')[0] : '',
        payment_mode: (record.payment_mode as 'own_account' | 'company_account') || 'own_account',
        reference: (record.reference as string) || '',
        description: (record.description as string) || '',
      })
    }
  }, [record])

  const totalAmount = useMemo(
    () => (form.unit_amount || 0) * (form.quantity || 0),
    [form.unit_amount, form.quantity],
  )

  const validate = (): string | null => {
    if (!form.name.trim()) return 'Description is required'
    if (!m2oId(form.employee_id)) return 'Employee is required'
    if (form.unit_amount <= 0) return 'Unit amount must be greater than zero'
    if (form.quantity <= 0) return 'Quantity must be greater than zero'
    return null
  }

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const saveMut = useMutation({
    mutationFn: async () => {
      const err = validate()
      if (err) throw new Error(err)
      const payload: Record<string, unknown> = {
        name: form.name,
        employee_id: m2oId(form.employee_id),
        product_id: m2oId(form.product_id),
        unit_amount: form.unit_amount,
        quantity: form.quantity,
        date: form.date || false,
        payment_mode: form.payment_mode,
        reference: form.reference || false,
        description: form.description || false,
      }
      if (isNew) {
        const { data } = await erpClient.raw.post('/hr/expenses/create', payload)
        return data
      }
      const { data } = await erpClient.raw.put(`/hr/expenses/${recordId}`, payload)
      return data
    },
    onSuccess: (data) => {
      toast.success('Saved', 'Expense saved successfully')
      queryClient.invalidateQueries({ queryKey: ['expense'] })
      queryClient.invalidateQueries({ queryKey: ['hr-expenses'] })
      setEditing(false)
      const newId = data?.id ?? data
      if (isNew && newId) navigate(`/admin/hr/expenses/${newId}`, { replace: true })
    },
    onError: (e: unknown) => {
      toast.error('Save Failed', extractErrorMessage(e))
    },
  })

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!recordId) return
      // Use generic submit endpoint for a single expense by passing id list
      const { data } = await erpClient.raw.post('/hr/expenses/submit', { expense_ids: [recordId] })
      return data
    },
    onSuccess: () => {
      toast.success('Submitted', 'Expense submitted to manager')
      queryClient.invalidateQueries({ queryKey: ['expense'] })
      queryClient.invalidateQueries({ queryKey: ['hr-expenses'] })
      queryClient.invalidateQueries({ queryKey: ['hr-expense-sheets'] })
    },
    onError: (e: unknown) => toast.error('Error', extractErrorMessage(e)),
  })

  const deleteMut = useMutation({
    mutationFn: () => erpClient.raw.delete(`/model/hr.expense/${recordId}`),
    onSuccess: () => {
      toast.success('Deleted', 'Expense deleted')
      queryClient.invalidateQueries({ queryKey: ['hr-expenses'] })
      navigate('/admin/hr/expenses')
    },
    onError: (e: unknown) => toast.error('Delete Failed', extractErrorMessage(e)),
  })

  // Scan-receipt OCR upload — pre-fills form with extracted fields.
  async function handleScanFile(file: File) {
    setScanning(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await erpClient.raw.post('/hr/expenses/ocr', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      // Pre-fill any extracted fields onto the form.
      const next: Partial<FormState> = {}
      if (data?.vendor_name) next.name = data.vendor_name
      if (typeof data?.total_amount === 'number' && data.total_amount > 0) {
        next.unit_amount = data.total_amount
        next.quantity = 1
      }
      if (data?.date) next.date = String(data.date).slice(0, 10)
      if (data?.description) next.description = String(data.description)
      if (Object.keys(next).length > 0) {
        setForm(p => ({ ...p, ...next }))
        if (!editing) setEditing(true)
      }
      const conf = typeof data?.confidence === 'number' ? Math.round(data.confidence * 100) : 0
      const note = data?.warning || `Confidence: ${conf}%`
      toast.success('Extracted from receipt', note)
    } catch (e: unknown) {
      toast.error('OCR Failed', extractErrorMessage(e, 'Could not scan receipt'))
    } finally {
      setScanning(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ─── Loading / not-found ────────────────────────────────────────────────────

  if (!isNew && (isLoading || !record)) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-8 w-64 rounded-full" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  const state: ExpenseState = isNew ? 'draft' : (record?.state ?? 'draft')
  const steps = getStepsForState(state)
  const readonly = !editing && !isNew

  // ─── Action buttons ─────────────────────────────────────────────────────────

  const actionButtons = (
    <>
      {editing && (
        <>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-xl"
            onClick={() => {
              if (isNew) navigate(-1)
              else setEditing(false)
            }}
          >
            Discard
          </Button>
          <Button
            size="sm"
            className="rounded-xl gap-1.5"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
          >
            <Check className="h-3.5 w-3.5" />
            {saveMut.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      )}

      {!editing && state === 'draft' && (
        <>
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button
            size="sm"
            className="rounded-xl gap-1.5"
            onClick={() => submitMut.mutate()}
            disabled={submitMut.isPending}
          >
            <Send className="h-3.5 w-3.5" />
            {submitMut.isPending ? 'Submitting…' : 'Submit to Manager'}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="rounded-xl gap-1.5"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </>
      )}
    </>
  )

  const headerTitle = isNew ? 'New Expense' : (record?.name as string) || 'Expense'

  return (
    <div className="space-y-6">
      <PageHeader
        title={headerTitle}
        subtitle="Expense"
        backTo="/admin/hr/expenses"
        actions={actionButtons}
      />

      {!isNew && <StatusBar steps={steps} current={state} />}

      {!isNew && state === 'reported' && record?.sheet_id && (
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 text-sm flex items-center gap-2">
          <Receipt className="h-4 w-4 text-sky-500" />
          <span>Linked to expense report:</span>
          <button
            type="button"
            className="font-medium text-sky-600 dark:text-sky-400 hover:underline"
            onClick={() => navigate(`/admin/hr/expense-sheets/${record.sheet_id ? (record.sheet_id as [number, string])[0] : ''}`)}
          >
            {(record.sheet_id as [number, string])[1]}
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
        {/* Description (top header field) */}
        <div className="mb-6">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description</label>
          {readonly ? (
            <h2 className="text-xl font-bold tracking-tight">{form.name || '—'}</h2>
          ) : (
            <Input
              value={form.name}
              onChange={e => setField('name', e.target.value)}
              placeholder="e.g. Client lunch — NYC"
              className="rounded-xl h-10 text-base font-medium"
            />
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
          {/* Left */}
          <div className="space-y-4">
            <FormSection title="Expense">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Employee</label>
                  {readonly ? (
                    <ReadonlyField label="" value={m2oLabel(form.employee_id)} />
                  ) : (
                    <M2OInput
                      model="hr.employee"
                      value={form.employee_id}
                      onChange={v => setField('employee_id', v)}
                      placeholder="Search employee…"
                    />
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Product</label>
                  {readonly ? (
                    <ReadonlyField label="" value={m2oLabel(form.product_id)} />
                  ) : (
                    <M2OInput
                      model="product.product"
                      value={form.product_id}
                      onChange={v => setField('product_id', v)}
                      placeholder="Search product…"
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Unit Amount</label>
                    {readonly ? (
                      <ReadonlyField label="" value={form.unit_amount.toFixed(2)} />
                    ) : (
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.unit_amount}
                        onChange={e => setField('unit_amount', parseFloat(e.target.value) || 0)}
                        className="rounded-xl h-9"
                      />
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Quantity</label>
                    {readonly ? (
                      <ReadonlyField label="" value={String(form.quantity)} />
                    ) : (
                      <Input
                        type="number"
                        min={0}
                        step="1"
                        value={form.quantity}
                        onChange={e => setField('quantity', parseFloat(e.target.value) || 0)}
                        className="rounded-xl h-9"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Total</label>
                  <div className="rounded-xl border border-border/40 bg-muted/30 px-3 h-9 flex items-center text-sm font-mono font-semibold">
                    {totalAmount.toFixed(2)}
                  </div>
                </div>
              </div>
            </FormSection>
          </div>

          {/* Right */}
          <div className="space-y-4">
            <FormSection title="Details">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Date</label>
                  {readonly ? (
                    <ReadonlyField label="" value={form.date || '—'} />
                  ) : (
                    <input
                      type="date"
                      value={form.date}
                      onChange={e => setField('date', e.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 h-9 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Payment Mode</label>
                  {readonly ? (
                    <ReadonlyField
                      label=""
                      value={form.payment_mode === 'company_account' ? 'Company' : 'Employee (Reimburse)'}
                    />
                  ) : (
                    <Select
                      value={form.payment_mode}
                      onValueChange={v => setField('payment_mode', v as 'own_account' | 'company_account')}
                    >
                      <SelectTrigger className="rounded-xl h-9">
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="own_account">Employee (Reimburse)</SelectItem>
                        <SelectItem value="company_account">Company</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Reference</label>
                  {readonly ? (
                    <ReadonlyField label="" value={form.reference || '—'} />
                  ) : (
                    <Input
                      value={form.reference}
                      onChange={e => setField('reference', e.target.value)}
                      placeholder="Bill / receipt #"
                      className="rounded-xl h-9"
                    />
                  )}
                </div>
              </div>
            </FormSection>
          </div>
        </div>

        <div className="mt-6">
          <FormSection title="Notes">
            {readonly ? (
              <p className="text-sm text-foreground whitespace-pre-wrap">{form.description || '—'}</p>
            ) : (
              <textarea
                value={form.description}
                onChange={e => setField('description', e.target.value)}
                placeholder="Additional notes…"
                rows={4}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
            )}
          </FormSection>
        </div>

        {/* Receipt attachments */}
        <div className="mt-6">
          <FormSection title="Receipt">
            <div className="flex items-center justify-end gap-2 mb-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleScanFile(f)
                }}
              />
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={scanning}
                title="Scan a receipt to auto-fill expense fields"
              >
                {scanning ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Scanning…</>
                ) : (
                  <><ScanLine className="h-3.5 w-3.5" /> Scan Receipt</>
                )}
              </Button>
            </div>
            <AttachmentSection
              resModel="hr.expense"
              resId={recordId}
              readonly={readonly && state !== 'draft'}
              title="Receipts"
            />
          </FormSection>
        </div>
      </div>

      {/* Delete dialog */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => { setDeleteOpen(false); deleteMut.mutate() }}
        title="Delete Expense"
        message="Are you sure you want to delete this expense? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMut.isPending}
      />
    </div>
  )
}
