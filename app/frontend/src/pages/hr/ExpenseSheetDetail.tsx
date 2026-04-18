import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Input, Skeleton, Badge,
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@mashora/design-system'
import {
  PageHeader, StatusBar, FormSection, ReadonlyField, ConfirmDialog, M2OInput, toast,
} from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'
import type { BadgeVariant } from '@mashora/design-system'
import { Check, X, Send, Trash2, FileText, Receipt, Wallet } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type SheetState = 'draft' | 'submit' | 'approve' | 'post' | 'done' | 'cancel'

interface ExpenseLine {
  id: number
  name: string
  date: string | false
  total_amount: number
  state: string
}

interface SheetDetail {
  id: number
  name: string | false
  state: SheetState
  employee_id: [number, string] | false
  total_amount: number
  payment_state: string | false
  accounting_date: string | false
  expense_line_ids: number[]
}

// ─── Status steps ─────────────────────────────────────────────────────────────

const STATUS_STEPS = [
  { key: 'draft', label: 'Draft' },
  { key: 'submit', label: 'Submitted' },
  { key: 'approve', label: 'Approved' },
  { key: 'post', label: 'Posted' },
  { key: 'done', label: 'Paid', color: 'success' as const },
]
const REFUSED_STEP = { key: 'cancel', label: 'Refused', color: 'danger' as const }

function getStepsForState(state: SheetState) {
  if (state === 'cancel') return [...STATUS_STEPS, REFUSED_STEP]
  return STATUS_STEPS
}

const STATE_BADGE: Record<SheetState, { label: string; variant: BadgeVariant }> = {
  draft:   { label: 'Draft',     variant: 'secondary' },
  submit:  { label: 'Submitted', variant: 'warning' },
  approve: { label: 'Approved',  variant: 'info' },
  post:    { label: 'Posted',    variant: 'info' },
  done:    { label: 'Paid',      variant: 'success' },
  cancel:  { label: 'Refused',   variant: 'destructive' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type M2OValue = [number, string] | false | number | null

const m2oLabel = (v: M2OValue | undefined) => (Array.isArray(v) ? v[1] : '—')
const m2oId = (v: unknown): number | null => (Array.isArray(v) ? (v[0] as number) : (typeof v === 'number' ? v : null))
const fmtAmount = (n: number) => `$${(n || 0).toFixed(2)}`

// ─── Form ─────────────────────────────────────────────────────────────────────

interface FormState {
  name: string
  employee_id: M2OValue
  accounting_date: string
}

const EMPTY_FORM: FormState = {
  name: '',
  employee_id: false,
  accounting_date: '',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExpenseSheetDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id || id === 'new'
  const recordId = isNew ? null : parseInt(id || '0')

  const [editing, setEditing] = useState(isNew)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [refuseOpen, setRefuseOpen] = useState(false)
  const [refuseReason, setRefuseReason] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(p => ({ ...p, [k]: v }))

  // Fetch sheet detail via generic model API (no dedicated GET endpoint)
  const SHEET_FIELDS = [
    'id', 'name', 'state', 'employee_id', 'total_amount',
    'payment_state', 'accounting_date', 'expense_line_ids',
  ]

  const { data: record, isLoading } = useQuery<SheetDetail>({
    queryKey: ['expense-sheet', recordId],
    queryFn: async () => {
      const { data } = await erpClient.raw.get(`/model/hr.expense.sheet/${recordId}`, {
        params: { fields: SHEET_FIELDS.join(',') },
      })
      return data
    },
    enabled: !isNew && !!recordId && recordId > 0,
  })

  // Fetch line items separately
  const lineIds = record?.expense_line_ids || []
  const { data: linesData } = useQuery<{ records: ExpenseLine[] }>({
    queryKey: ['expense-sheet-lines', recordId, lineIds.join(',')],
    queryFn: async () => {
      if (!lineIds.length) return { records: [] }
      const { data } = await erpClient.raw.post('/model/hr.expense', {
        domain: [['id', 'in', lineIds]],
        fields: ['id', 'name', 'date', 'total_amount', 'state'],
        limit: 200,
        order: 'date desc',
      })
      return data
    },
    enabled: !!recordId && lineIds.length > 0,
  })
  const lines = linesData?.records || []

  useEffect(() => {
    if (record) {
      setForm({
        name: (record.name as string) || '',
        employee_id: record.employee_id || false,
        accounting_date: record.accounting_date
          ? (record.accounting_date as string).split(' ')[0]
          : '',
      })
    }
  }, [record])

  const validate = (): string | null => {
    if (!form.name.trim()) return 'Report name is required'
    if (!m2oId(form.employee_id)) return 'Employee is required'
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
        accounting_date: form.accounting_date || false,
      }
      if (isNew) {
        const { data } = await erpClient.raw.post('/model/hr.expense.sheet/create', { vals: payload })
        return data
      }
      const { data } = await erpClient.raw.put(`/model/hr.expense.sheet/${recordId}`, { vals: payload })
      return data
    },
    onSuccess: (data) => {
      toast.success('Saved', 'Expense report saved successfully')
      queryClient.invalidateQueries({ queryKey: ['expense-sheet'] })
      queryClient.invalidateQueries({ queryKey: ['hr-expense-sheets'] })
      setEditing(false)
      const newId = data?.id ?? data
      if (isNew && newId) navigate(`/admin/hr/expense-sheets/${newId}`, { replace: true })
    },
    onError: (e: unknown) => {
      toast.error('Save Failed', extractErrorMessage(e))
    },
  })

  const submitMut = useMutation({
    mutationFn: () => erpClient.raw.post(`/model/hr.expense.sheet/call`, {
      method: 'action_submit_sheet',
      ids: [recordId],
    }),
    onSuccess: () => {
      toast.success('Submitted', 'Report submitted to manager')
      queryClient.invalidateQueries({ queryKey: ['expense-sheet'] })
      queryClient.invalidateQueries({ queryKey: ['hr-expense-sheets'] })
    },
    onError: (e: unknown) => toast.error('Error', extractErrorMessage(e)),
  })

  const approveMut = useMutation({
    mutationFn: () => erpClient.raw.post(`/hr/expense-sheets/${recordId}/approve`),
    onSuccess: () => {
      toast.success('Approved', 'Report approved')
      queryClient.invalidateQueries({ queryKey: ['expense-sheet'] })
      queryClient.invalidateQueries({ queryKey: ['hr-expense-sheets'] })
    },
    onError: (e: unknown) => toast.error('Error', extractErrorMessage(e)),
  })

  const refuseMut = useMutation({
    mutationFn: (reason: string) =>
      erpClient.raw.post(`/hr/expense-sheets/${recordId}/refuse`, { reason }),
    onSuccess: () => {
      toast.success('Refused', 'Report refused')
      setRefuseOpen(false)
      setRefuseReason('')
      queryClient.invalidateQueries({ queryKey: ['expense-sheet'] })
      queryClient.invalidateQueries({ queryKey: ['hr-expense-sheets'] })
    },
    onError: (e: unknown) => toast.error('Error', extractErrorMessage(e)),
  })

  const postMut = useMutation({
    mutationFn: () => erpClient.raw.post(`/hr/expense-sheets/${recordId}/post`),
    onSuccess: () => {
      toast.success('Posted', 'Journal entry posted')
      queryClient.invalidateQueries({ queryKey: ['expense-sheet'] })
      queryClient.invalidateQueries({ queryKey: ['hr-expense-sheets'] })
    },
    onError: (e: unknown) => toast.error('Error', extractErrorMessage(e)),
  })

  const payMut = useMutation({
    mutationFn: () => erpClient.raw.post(`/model/hr.expense.sheet/call`, {
      method: 'action_register_payment',
      ids: [recordId],
    }),
    onSuccess: () => {
      toast.success('Paid', 'Payment registered')
      queryClient.invalidateQueries({ queryKey: ['expense-sheet'] })
      queryClient.invalidateQueries({ queryKey: ['hr-expense-sheets'] })
    },
    onError: (e: unknown) => toast.error('Error', extractErrorMessage(e)),
  })

  const deleteMut = useMutation({
    mutationFn: () => erpClient.raw.delete(`/model/hr.expense.sheet/${recordId}`),
    onSuccess: () => {
      toast.success('Deleted', 'Report deleted')
      queryClient.invalidateQueries({ queryKey: ['hr-expense-sheets'] })
      navigate('/admin/hr/expense-sheets')
    },
    onError: (e: unknown) => toast.error('Delete Failed', extractErrorMessage(e)),
  })

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

  const state: SheetState = isNew ? 'draft' : (record?.state ?? 'draft')
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
            {submitMut.isPending ? 'Submitting…' : 'Submit'}
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

      {!editing && state === 'submit' && (
        <>
          <Button
            size="sm"
            className="rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => approveMut.mutate()}
            disabled={approveMut.isPending}
          >
            <Check className="h-3.5 w-3.5" />
            {approveMut.isPending ? 'Approving…' : 'Approve'}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="rounded-xl gap-1.5"
            onClick={() => setRefuseOpen(true)}
          >
            <X className="h-3.5 w-3.5" /> Refuse
          </Button>
        </>
      )}

      {!editing && state === 'approve' && (
        <Button
          size="sm"
          className="rounded-xl gap-1.5"
          onClick={() => postMut.mutate()}
          disabled={postMut.isPending}
        >
          <FileText className="h-3.5 w-3.5" />
          {postMut.isPending ? 'Posting…' : 'Post Journal Entry'}
        </Button>
      )}

      {!editing && state === 'post' && (
        <Button
          size="sm"
          className="rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => payMut.mutate()}
          disabled={payMut.isPending}
        >
          <Wallet className="h-3.5 w-3.5" />
          {payMut.isPending ? 'Registering…' : 'Register Payment'}
        </Button>
      )}
    </>
  )

  const headerTitle = isNew ? 'New Expense Report' : (record?.name as string) || 'Expense Report'
  const stateBadge = !isNew ? STATE_BADGE[state] : null

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {headerTitle}
            {stateBadge && (
              <Badge variant={stateBadge.variant} className="text-xs">{stateBadge.label}</Badge>
            )}
          </span>
        }
        subtitle="Expense Report"
        backTo="/admin/hr/expense-sheets"
        actions={actionButtons}
      />

      {!isNew && <StatusBar steps={steps} current={state} />}

      <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
          {/* Left */}
          <div className="space-y-4">
            <FormSection title="Report">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Name</label>
                  {readonly ? (
                    <ReadonlyField label="" value={form.name || '—'} />
                  ) : (
                    <Input
                      value={form.name}
                      onChange={e => setField('name', e.target.value)}
                      placeholder="e.g. March 2026 Expenses"
                      className="rounded-xl h-9"
                    />
                  )}
                </div>
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
              </div>
            </FormSection>
          </div>

          {/* Right */}
          <div className="space-y-4">
            <FormSection title="Accounting">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Accounting Date</label>
                  {readonly ? (
                    <ReadonlyField label="" value={form.accounting_date || '—'} />
                  ) : (
                    <input
                      type="date"
                      value={form.accounting_date}
                      onChange={e => setField('accounting_date', e.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 h-9 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  )}
                </div>
                <ReadonlyField
                  label="Total Amount"
                  value={
                    <span className="font-mono font-semibold">
                      {fmtAmount(record?.total_amount ?? 0)}
                    </span>
                  }
                />
                {record?.payment_state && (
                  <ReadonlyField label="Payment State" value={record.payment_state} />
                )}
              </div>
            </FormSection>
          </div>
        </div>

        {/* Lines */}
        {!isNew && (
          <div className="mt-8">
            <FormSection title="Expense Lines">
              {lines.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/50 px-4 py-8 flex flex-col items-center text-center gap-2 text-sm text-muted-foreground">
                  <Receipt className="h-5 w-5 opacity-50" />
                  No expenses linked to this report yet
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border/40">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Description</th>
                        <th className="px-3 py-2 font-medium">Date</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map(line => (
                        <tr
                          key={line.id}
                          className="border-t border-border/30 hover:bg-accent/40 cursor-pointer transition-colors"
                          onClick={() => navigate(`/admin/hr/expenses/${line.id}`)}
                        >
                          <td className="px-3 py-2 font-medium">{line.name || '—'}</td>
                          <td className="px-3 py-2 text-muted-foreground">{line.date || '—'}</td>
                          <td className="px-3 py-2 text-muted-foreground capitalize">{line.state}</td>
                          <td className="px-3 py-2 text-right font-mono">{fmtAmount(line.total_amount)}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-border/30 bg-muted/20 font-semibold">
                        <td className="px-3 py-2" colSpan={3}>Total</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {fmtAmount(lines.reduce((s, l) => s + (l.total_amount || 0), 0))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </FormSection>
          </div>
        )}
      </div>

      {/* Refuse dialog */}
      <Dialog open={refuseOpen} onOpenChange={v => { if (!v) { setRefuseOpen(false); setRefuseReason('') } }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Refuse Expense Report</DialogTitle>
            <DialogDescription>
              Provide a reason for refusing this report. The employee will be notified.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={refuseReason}
            onChange={e => setRefuseReason(e.target.value)}
            rows={4}
            autoFocus
            placeholder="Reason for refusal…"
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => { setRefuseOpen(false); setRefuseReason('') }} disabled={refuseMut.isPending} className="rounded-xl">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => refuseMut.mutate(refuseReason)}
              disabled={refuseMut.isPending || !refuseReason.trim()}
              className="rounded-xl"
            >
              {refuseMut.isPending ? 'Refusing…' : 'Refuse'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => { setDeleteOpen(false); deleteMut.mutate() }}
        title="Delete Expense Report"
        message="Are you sure you want to delete this report? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMut.isPending}
      />
    </div>
  )
}
