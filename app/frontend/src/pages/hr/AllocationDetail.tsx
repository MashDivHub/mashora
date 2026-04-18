import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Input, Skeleton, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@mashora/design-system'
import {
  PageHeader, StatusBar, FormSection, ReadonlyField, ConfirmDialog, M2OInput, toast,
} from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'
import { Check, X, RotateCcw, Trash2, Send, CalendarCheck } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type AllocState = 'draft' | 'confirm' | 'refuse' | 'validate1' | 'validate'

interface AllocationDetail {
  id: number
  name: string | false
  state: AllocState
  employee_id: [number, string] | false
  holiday_status_id: [number, string] | false
  allocation_type: 'regular' | 'accrual' | false
  number_of_days: number
  date_from: string | false
  date_to: string | false
  notes: string | false
}

// ─── Status steps ─────────────────────────────────────────────────────────────

const STATUS_STEPS = [
  { key: 'draft', label: 'Draft' },
  { key: 'confirm', label: 'To Approve' },
  { key: 'validate', label: 'Approved', color: 'success' as const },
]
const REFUSED_STEP = { key: 'refuse', label: 'Refused', color: 'danger' as const }

function getStepsForState(state: AllocState) {
  if (state === 'refuse') return [...STATUS_STEPS, REFUSED_STEP]
  return STATUS_STEPS
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const m2oLabel = (v: [number, string] | false | number | null | undefined) => (Array.isArray(v) ? v[1] : '—')
const m2oId = (v: unknown): number | null => {
  if (Array.isArray(v)) return (v[0] as number) ?? null
  if (typeof v === 'number' && v > 0) return v
  return null
}
const fmtDate = (v: string | false) => (v ? v.split(' ')[0] : '—')

// ─── Empty form ───────────────────────────────────────────────────────────────

type M2OValue = [number, string] | false | number | null

interface FormState {
  name: string
  employee_id: M2OValue
  holiday_status_id: M2OValue
  allocation_type: 'regular' | 'accrual'
  number_of_days: number
  date_from: string
  date_to: string
  notes: string
}

const EMPTY_FORM: FormState = {
  name: '',
  employee_id: false,
  holiday_status_id: false,
  allocation_type: 'regular',
  number_of_days: 1,
  date_from: '',
  date_to: '',
  notes: '',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AllocationDetail() {
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

  const { data: record, isLoading } = useQuery<AllocationDetail>({
    queryKey: ['allocation', recordId],
    queryFn: () => erpClient.raw.get(`/hr/allocations/${recordId}`).then(r => r.data),
    enabled: !isNew && !!recordId && recordId > 0,
  })

  useEffect(() => {
    if (record) {
      setForm({
        name: (record.name as string) || '',
        employee_id: record.employee_id || false,
        holiday_status_id: record.holiday_status_id || false,
        allocation_type: (record.allocation_type as 'regular' | 'accrual') || 'regular',
        number_of_days: record.number_of_days ?? 0,
        date_from: record.date_from ? (record.date_from as string).split(' ')[0] : '',
        date_to: record.date_to ? (record.date_to as string).split(' ')[0] : '',
        notes: (record.notes as string) || '',
      })
    }
  }, [record])

  const validate = (): string | null => {
    if (!m2oId(form.employee_id)) return 'Employee is required'
    if (!m2oId(form.holiday_status_id)) return 'Leave Type is required'
    if (!form.number_of_days || form.number_of_days <= 0) return 'Number of days must be greater than zero'
    return null
  }

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const saveMut = useMutation({
    mutationFn: async () => {
      const err = validate()
      if (err) throw new Error(err)

      const payload: Record<string, unknown> = {
        name: form.name || false,
        employee_id: m2oId(form.employee_id),
        holiday_status_id: m2oId(form.holiday_status_id),
        allocation_type: form.allocation_type,
        number_of_days: form.number_of_days,
        date_from: form.date_from || false,
        date_to: form.date_to || false,
        notes: form.notes || false,
      }

      if (isNew) {
        const { data } = await erpClient.raw.post('/hr/allocations/create', payload)
        return data
      }
      const { data } = await erpClient.raw.put(`/model/hr.leave.allocation/${recordId}`, { vals: payload })
      return data
    },
    onSuccess: (data) => {
      toast.success('Saved', 'Allocation saved successfully')
      queryClient.invalidateQueries({ queryKey: ['allocation'] })
      queryClient.invalidateQueries({ queryKey: ['allocation-list'] })
      setEditing(false)
      const newId = data?.id ?? data
      if (isNew && newId) navigate(`/admin/hr/allocations/${newId}`, { replace: true })
    },
    onError: (e: unknown) => {
      toast.error('Save Failed', extractErrorMessage(e))
    },
  })

  const confirmMut = useMutation({
    mutationFn: () => erpClient.raw.put(`/model/hr.leave.allocation/${recordId}`, { vals: { state: 'confirm' } }),
    onSuccess: () => {
      toast.success('Submitted', 'Allocation submitted for approval')
      queryClient.invalidateQueries({ queryKey: ['allocation'] })
      queryClient.invalidateQueries({ queryKey: ['allocation-list'] })
    },
    onError: (e: unknown) => toast.error('Error', extractErrorMessage(e)),
  })

  const approveMut = useMutation({
    mutationFn: () => erpClient.raw.post(`/hr/allocations/${recordId}/approve`),
    onSuccess: () => {
      toast.success('Approved', 'Allocation approved')
      queryClient.invalidateQueries({ queryKey: ['allocation'] })
      queryClient.invalidateQueries({ queryKey: ['allocation-list'] })
    },
    onError: (e: unknown) => toast.error('Error', extractErrorMessage(e)),
  })

  const refuseMut = useMutation({
    mutationFn: (reason: string) =>
      erpClient.raw.post(`/hr/allocations/${recordId}/refuse`, { reason }),
    onSuccess: () => {
      toast.success('Refused', 'Allocation refused')
      setRefuseOpen(false)
      setRefuseReason('')
      queryClient.invalidateQueries({ queryKey: ['allocation'] })
      queryClient.invalidateQueries({ queryKey: ['allocation-list'] })
    },
    onError: (e: unknown) => toast.error('Error', extractErrorMessage(e)),
  })

  const resetMut = useMutation({
    mutationFn: () => erpClient.raw.post(`/hr/allocations/${recordId}/reset`),
    onSuccess: () => {
      toast.success('Reset', 'Allocation reset to draft')
      queryClient.invalidateQueries({ queryKey: ['allocation'] })
      queryClient.invalidateQueries({ queryKey: ['allocation-list'] })
    },
    onError: (e: unknown) => toast.error('Error', extractErrorMessage(e)),
  })

  const deleteMut = useMutation({
    mutationFn: () => erpClient.raw.delete(`/model/hr.leave.allocation/${recordId}`),
    onSuccess: () => {
      toast.success('Deleted', 'Allocation deleted')
      queryClient.invalidateQueries({ queryKey: ['allocation-list'] })
      navigate('/admin/hr/allocations')
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

  const state: AllocState = isNew ? 'draft' : (record?.state ?? 'draft')
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
            onClick={() => confirmMut.mutate()}
            disabled={confirmMut.isPending}
          >
            <Send className="h-3.5 w-3.5" />
            {confirmMut.isPending ? 'Submitting…' : 'Confirm'}
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

      {!editing && state === 'confirm' && (
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

      {!editing && state === 'refuse' && (
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl gap-1.5"
          onClick={() => resetMut.mutate()}
          disabled={resetMut.isPending}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {resetMut.isPending ? 'Resetting…' : 'Reset to Draft'}
        </Button>
      )}
    </>
  )

  // ─── Field renderers ────────────────────────────────────────────────────────

  const headerTitle = isNew
    ? 'New Allocation'
    : m2oLabel(record!.employee_id) + (record!.name ? ` — ${record!.name}` : '')

  return (
    <div className="space-y-6">
      <PageHeader
        title={headerTitle}
        subtitle="Leave Allocation"
        backTo="/admin/hr/allocations"
        actions={actionButtons}
      />

      {!isNew && <StatusBar steps={steps} current={state} />}

      <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
          {/* Left */}
          <div className="space-y-4">
            <FormSection title="Allocation">
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
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Leave Type</label>
                  {readonly ? (
                    <ReadonlyField label="" value={m2oLabel(form.holiday_status_id)} />
                  ) : (
                    <M2OInput
                      model="hr.leave.type"
                      value={form.holiday_status_id}
                      onChange={v => setField('holiday_status_id', v)}
                      placeholder="Select leave type…"
                    />
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Allocation Type</label>
                  {readonly ? (
                    <ReadonlyField label="" value={form.allocation_type === 'accrual' ? 'Accrual' : 'Regular'} />
                  ) : (
                    <Select
                      value={form.allocation_type}
                      onValueChange={v => setField('allocation_type', v as 'regular' | 'accrual')}
                    >
                      <SelectTrigger className="rounded-xl h-9">
                        <SelectValue placeholder="Select type…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="regular">Regular</SelectItem>
                        <SelectItem value="accrual">Accrual</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Number of Days</label>
                  {readonly ? (
                    <ReadonlyField label="" value={String(form.number_of_days)} />
                  ) : (
                    <Input
                      type="number"
                      min={0}
                      step="0.5"
                      value={form.number_of_days}
                      onChange={e => setField('number_of_days', parseFloat(e.target.value) || 0)}
                      className="rounded-xl h-9"
                    />
                  )}
                </div>
              </div>
            </FormSection>
          </div>

          {/* Right */}
          <div className="space-y-4">
            <FormSection title="Validity">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Date From</label>
                  {readonly ? (
                    <ReadonlyField label="" value={fmtDate(form.date_from)} />
                  ) : (
                    <input
                      type="date"
                      value={form.date_from}
                      onChange={e => setField('date_from', e.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 h-9 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Date To</label>
                  {readonly ? (
                    <ReadonlyField label="" value={fmtDate(form.date_to)} />
                  ) : (
                    <input
                      type="date"
                      value={form.date_to}
                      onChange={e => setField('date_to', e.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 h-9 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description</label>
                  {readonly ? (
                    <ReadonlyField label="" value={form.name || '—'} />
                  ) : (
                    <Input
                      value={form.name}
                      onChange={e => setField('name', e.target.value)}
                      placeholder="Allocation reference"
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
              <p className="text-sm text-foreground whitespace-pre-wrap">{form.notes || '—'}</p>
            ) : (
              <textarea
                value={form.notes}
                onChange={e => setField('notes', e.target.value)}
                placeholder="Additional notes…"
                rows={4}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
            )}
          </FormSection>
        </div>
      </div>

      {/* Refuse dialog */}
      <Dialog open={refuseOpen} onOpenChange={v => { if (!v) { setRefuseOpen(false); setRefuseReason('') } }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Refuse Allocation</DialogTitle>
            <DialogDescription>
              Provide an optional reason for refusing this allocation.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={refuseReason}
            onChange={e => setRefuseReason(e.target.value)}
            rows={4}
            autoFocus
            placeholder="e.g. Insufficient justification…"
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => { setRefuseOpen(false); setRefuseReason('') }} disabled={refuseMut.isPending} className="rounded-xl">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => refuseMut.mutate(refuseReason)}
              disabled={refuseMut.isPending}
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
        title="Delete Allocation"
        message="Are you sure you want to delete this allocation? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMut.isPending}
      />

      {!isNew && !record && (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <CalendarCheck className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Allocation not found</p>
        </div>
      )}
    </div>
  )
}
