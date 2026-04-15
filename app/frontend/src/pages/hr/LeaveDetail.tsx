import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader, StatusBar, stepsFromSelection, toast, FormSection, ReadonlyField } from '@/components/shared'
import { Button, Skeleton, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { Check, X, RotateCcw, CalendarDays } from 'lucide-react'
import M2OInput from '@/components/shared/M2OInput'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeaveDetail {
  id: number
  name: string | false
  state: string
  employee_id: [number, string] | false
  holiday_status_id: [number, string] | false
  date_from: string | false
  date_to: string | false
  number_of_days: number
  duration_display: string | false
  first_approver_id: [number, string] | false
  department_id: [number, string] | false
}

interface LeaveType {
  id: number
  name: string
}

// ─── Status steps ─────────────────────────────────────────────────────────────

const STATUS_STEPS = [
  { key: 'draft', label: 'Draft' },
  { key: 'confirm', label: 'To Approve' },
  { key: 'validate', label: 'Approved', color: 'success' as const },
]

// Build a refused step for the side-state
const REFUSED_STEP = { key: 'refuse', label: 'Refused', color: 'danger' as const }

function getStepsForState(state: string) {
  if (state === 'refuse') return [...STATUS_STEPS, REFUSED_STEP]
  return STATUS_STEPS
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(val: string | false): string {
  if (!val) return '—'
  return val.split(' ')[0]
}

function m2oLabel(val: [number, string] | false): string {
  return val ? val[1] : '—'
}

// ─── New Leave Form ───────────────────────────────────────────────────────────

interface NewLeaveForm {
  employee_id: any
  holiday_status_id: string
  request_date_from: string
  request_date_to: string
  name: string
}

function NewLeaveView() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [form, setForm] = useState<NewLeaveForm>({
    employee_id: false,
    holiday_status_id: '',
    request_date_from: '',
    request_date_to: '',
    name: '',
  })

  const setField = (k: keyof NewLeaveForm, v: any) => setForm(p => ({ ...p, [k]: v }))

  const { data: leaveTypes } = useQuery<LeaveType[]>({
    queryKey: ['hr-leave-types'],
    queryFn: () => erpClient.raw.get('/hr/leave-types').then(r => r.data?.records ?? r.data ?? []),
  })

  const createMut = useMutation({
    mutationFn: async () => {
      const employeeId = Array.isArray(form.employee_id) ? form.employee_id[0] : form.employee_id
      if (!employeeId) throw new Error('Employee is required')
      if (!form.holiday_status_id) throw new Error('Leave type is required')
      if (!form.request_date_from) throw new Error('Date From is required')
      if (!form.request_date_to) throw new Error('Date To is required')

      const { data } = await erpClient.raw.post('/hr/leaves/create', {
        employee_id: employeeId,
        holiday_status_id: parseInt(form.holiday_status_id),
        request_date_from: form.request_date_from,
        request_date_to: form.request_date_to,
        name: form.name || false,
      })
      return data
    },
    onSuccess: (data) => {
      toast.success('Created', 'Leave request created successfully')
      queryClient.invalidateQueries({ queryKey: ['leaves'] })
      const newId = data?.id ?? data
      if (newId) navigate(`/admin/hr/leaves/${newId}`, { replace: true })
    },
    onError: (e: any) => {
      toast.error('Error', e?.response?.data?.detail || e.message || 'Failed to create leave request')
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Leave Request"
        subtitle="Human Resources"
        backTo="/hr/leaves"
        actions={
          <Button
            size="sm"
            className="rounded-xl gap-1.5"
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
          >
            <Check className="h-3.5 w-3.5" />
            {createMut.isPending ? 'Saving…' : 'Save'}
          </Button>
        }
      />

      <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-6">
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
          {/* Left column */}
          <div className="space-y-4">
            <FormSection title="Request">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Employee</label>
                  <M2OInput
                    model="hr.employee"
                    value={form.employee_id}
                    onChange={v => setField('employee_id', v)}
                    placeholder="Search employee…"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Leave Type</label>
                  <Select value={form.holiday_status_id} onValueChange={v => setField('holiday_status_id', v)}>
                    <SelectTrigger className="rounded-xl h-9">
                      <SelectValue placeholder="Select leave type…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(leaveTypes ?? []).map(lt => (
                        <SelectItem key={lt.id} value={String(lt.id)}>{lt.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description</label>
                  <textarea
                    value={form.name}
                    onChange={e => setField('name', e.target.value)}
                    placeholder="Optional reason…"
                    rows={3}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                  />
                </div>
              </div>
            </FormSection>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <FormSection title="Dates">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Date From</label>
                  <input
                    type="date"
                    value={form.request_date_from}
                    onChange={e => setField('request_date_from', e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 h-9 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Date To</label>
                  <input
                    type="date"
                    value={form.request_date_to}
                    onChange={e => setField('request_date_to', e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 h-9 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
              </div>
            </FormSection>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Existing Leave View ──────────────────────────────────────────────────────

function ExistingLeaveView({ id }: { id: number }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: leave, isLoading } = useQuery<LeaveDetail>({
    queryKey: ['leave', id],
    queryFn: () => erpClient.raw.get(`/hr/leaves/${id}`).then(r => r.data),
  })

  const approveMut = useMutation({
    mutationFn: () => erpClient.raw.post(`/hr/leaves/${id}/approve`),
    onSuccess: () => {
      toast.success('Approved', 'Leave request has been approved')
      queryClient.invalidateQueries({ queryKey: ['leave', id] })
      queryClient.invalidateQueries({ queryKey: ['leaves'] })
    },
    onError: (e: any) => {
      toast.error('Error', e?.response?.data?.detail || e.message || 'Failed to approve')
    },
  })

  const refuseMut = useMutation({
    mutationFn: () => erpClient.raw.post(`/hr/leaves/${id}/refuse`),
    onSuccess: () => {
      toast.success('Refused', 'Leave request has been refused')
      queryClient.invalidateQueries({ queryKey: ['leave', id] })
      queryClient.invalidateQueries({ queryKey: ['leaves'] })
    },
    onError: (e: any) => {
      toast.error('Error', e?.response?.data?.detail || e.message || 'Failed to refuse')
    },
  })

  const resetMut = useMutation({
    mutationFn: () => erpClient.raw.post(`/hr/leaves/${id}/reset`),
    onSuccess: () => {
      toast.success('Reset', 'Leave request reset to draft')
      queryClient.invalidateQueries({ queryKey: ['leave', id] })
      queryClient.invalidateQueries({ queryKey: ['leaves'] })
    },
    onError: (e: any) => {
      toast.error('Error', e?.response?.data?.detail || e.message || 'Failed to reset')
    },
  })

  if (isLoading || !leave) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-8 w-64 rounded-full" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  const state = leave.state
  const steps = getStepsForState(state)

  const actionButtons = (
    <>
      {state === 'confirm' && (
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
            onClick={() => refuseMut.mutate()}
            disabled={refuseMut.isPending}
          >
            <X className="h-3.5 w-3.5" />
            {refuseMut.isPending ? 'Refusing…' : 'Refuse'}
          </Button>
        </>
      )}
      {(state === 'validate' || state === 'refuse') && (
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

  const duration = leave.duration_display || `${leave.number_of_days} day${leave.number_of_days !== 1 ? 's' : ''}`

  return (
    <div className="space-y-6">
      <PageHeader
        title={m2oLabel(leave.employee_id)}
        subtitle="Leave Request"
        backTo="/hr/leaves"
        actions={actionButtons}
      />

      <StatusBar steps={steps} current={state} />

      <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-2">
          {/* Left */}
          <div className="space-y-1">
            <FormSection title="Request Info">
              <ReadonlyField label="Employee" value={m2oLabel(leave.employee_id)} />
              <ReadonlyField label="Leave Type" value={m2oLabel(leave.holiday_status_id)} />
              {leave.name && <ReadonlyField label="Description" value={leave.name} />}
            </FormSection>
          </div>

          {/* Right */}
          <div className="space-y-1">
            <FormSection title="Dates & Duration">
              <ReadonlyField label="Date From" value={fmtDate(leave.date_from)} />
              <ReadonlyField label="Date To" value={fmtDate(leave.date_to)} />
              <ReadonlyField label="Duration" value={duration} />
              <ReadonlyField label="Approver" value={m2oLabel(leave.first_approver_id)} />
            </FormSection>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeaveDetail() {
  const { id } = useParams<{ id: string }>()

  if (id === 'new') {
    return <NewLeaveView />
  }

  const numId = parseInt(id || '0')
  if (!numId) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <CalendarDays className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Invalid leave request ID</p>
      </div>
    )
  }

  return <ExistingLeaveView id={numId} />
}
