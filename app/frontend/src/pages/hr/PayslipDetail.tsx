import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Input, Skeleton } from '@mashora/design-system'
import {
  RecordForm, FormField, FormSection, ReadonlyField, StatusBar, toast, type FormTab,
} from '@/components/shared'
import M2OInput from '@/components/shared/M2OInput'
import Chatter from '@/components/Chatter'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'
import { Check, X, RotateCcw, Calculator } from 'lucide-react'

type DomainTerm = [string, string, unknown]

const asStr = (v: unknown): string => {
  if (v == null || v === false) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return ''
}

const STATUS_STEPS = [
  { key: 'draft', label: 'Draft' },
  { key: 'verify', label: 'Waiting' },
  { key: 'done', label: 'Done', color: 'success' as const },
]
const CANCEL_STEP = { key: 'cancel', label: 'Cancelled', color: 'danger' as const }

function fmtAmount(v: number | string | false | undefined | null): string {
  if (v === false || v === null || v === undefined || v === '') return '—'
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (isNaN(n)) return '—'
  return `$${n.toFixed(2)}`
}

export default function PayslipDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id || id === 'new'
  const recordId = isNew ? null : parseInt(id || '0')
  const [editing, setEditing] = useState(isNew)
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: record, isLoading } = useQuery({
    queryKey: ['payslip', recordId],
    queryFn: async () => {
      if (isNew) {
        const today = new Date()
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]
        return { id: null, state: 'draft', name: '', date_from: monthStart, date_to: monthEnd }
      }
      const { data } = await erpClient.raw.get(`/model/hr.payslip/${recordId}`)
      return data
    },
  })

  useEffect(() => { if (record) setForm({ ...record }) }, [record])
  const setField = useCallback((n: string, v: unknown) => { setForm((p) => ({ ...p, [n]: v })) }, [])

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {}
    if (!asStr(form.name).trim()) errs.name = 'Description is required'
    const eid = Array.isArray(form.employee_id) ? form.employee_id[0] : form.employee_id
    if (!eid) errs.employee_id = 'Employee is required'
    if (!form.date_from) errs.date_from = 'Date From required'
    if (!form.date_to) errs.date_to = 'Date To required'
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
      for (const f of ['name', 'number', 'date_from', 'date_to', 'basic_wage', 'gross_wage', 'net_wage', 'notes']) {
        if (form[f] !== record?.[f]) vals[f] = form[f] ?? false
      }
      for (const f of ['employee_id', 'contract_id', 'payslip_run_id']) {
        const fv = form[f]
        const rv = record?.[f]
        const nv = Array.isArray(fv) ? fv[0] : fv
        const ov = Array.isArray(rv) ? rv[0] : rv
        if (nv !== ov) vals[f] = nv || false
      }
      if (isNew) {
        const eid = Array.isArray(form.employee_id) ? form.employee_id[0] : form.employee_id
        const { data } = await erpClient.raw.post('/model/hr.payslip/create', {
          vals: { name: form.name, employee_id: eid, date_from: form.date_from, date_to: form.date_to, ...vals },
        })
        return data
      }
      const { data } = await erpClient.raw.put(`/model/hr.payslip/${recordId}`, { vals })
      return data
    },
    onSuccess: (data) => {
      setEditing(false)
      setErrors({})
      toast.success('Saved', 'Payslip saved successfully')
      queryClient.invalidateQueries({ queryKey: ['payslip'] })
      queryClient.invalidateQueries({ queryKey: ['hr-payslips'] })
      if (isNew && data?.id) navigate(`/admin/hr/payslips/${data.id}`, { replace: true })
    },
    onError: (e: unknown) => {
      if (e instanceof Error && e.message === 'Validation failed') return
      toast.error('Save Failed', extractErrorMessage(e))
    },
  })

  const setStateMut = useMutation({
    mutationFn: async (newState: string) => {
      const { data } = await erpClient.raw.put(`/model/hr.payslip/${recordId}`, { vals: { state: newState } })
      return data
    },
    onSuccess: (_d, newState) => {
      toast.success('Updated', `Payslip set to ${newState}`)
      queryClient.invalidateQueries({ queryKey: ['payslip', recordId] })
      queryClient.invalidateQueries({ queryKey: ['hr-payslips'] })
    },
    onError: (e: unknown) => toast.error('Error', extractErrorMessage(e)),
  })

  if (isLoading || !record) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  const state = asStr(form.state) || 'draft'
  const steps = state === 'cancel' ? [...STATUS_STEPS, CANCEL_STEP] : STATUS_STEPS

  const stateActions = !isNew && !editing ? (
    <>
      {state === 'draft' && (
        <Button size="sm" className="rounded-xl gap-1.5"
          onClick={() => setStateMut.mutate('verify')} disabled={setStateMut.isPending}>
          <Check className="h-3.5 w-3.5" /> Confirm
        </Button>
      )}
      {state === 'verify' && (
        <Button size="sm" className="rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => setStateMut.mutate('done')} disabled={setStateMut.isPending}>
          <Check className="h-3.5 w-3.5" /> Mark Done
        </Button>
      )}
      {(state === 'draft' || state === 'verify') && (
        <Button size="sm" variant="destructive" className="rounded-xl gap-1.5"
          onClick={() => setStateMut.mutate('cancel')} disabled={setStateMut.isPending}>
          <X className="h-3.5 w-3.5" /> Cancel
        </Button>
      )}
      {(state === 'done' || state === 'cancel') && (
        <Button size="sm" variant="outline" className="rounded-xl gap-1.5"
          onClick={() => setStateMut.mutate('draft')} disabled={setStateMut.isPending}>
          <RotateCcw className="h-3.5 w-3.5" /> Reset to Draft
        </Button>
      )}
    </>
  ) : null

  const TF = ({ field, label, type = 'text' }: { field: string; label: string; type?: string }) => {
    if (!editing) {
      const v = form[field]
      const display = type === 'number' ? fmtAmount(v as number | string | false | undefined | null) : asStr(v)
      return <ReadonlyField label={label} value={display} />
    }
    return (
      <FormField label={label}>
        <Input type={type} value={asStr(form[field])} onChange={(e) => setField(field, e.target.value)}
          className={`rounded-xl h-9 ${errors[field] ? 'border-red-500' : ''}`} />
        {errors[field] && <p className="text-xs text-destructive mt-1">{errors[field]}</p>}
      </FormField>
    )
  }

  const M2O = ({ field, label, model, domain }: { field: string; label: string; model: string; domain?: DomainTerm[] }) => {
    if (!editing) {
      const v = form[field]
      return <ReadonlyField label={label} value={Array.isArray(v) ? String(v[1] ?? '') : ''} />
    }
    return (
      <FormField label={label}>
        <M2OInput model={model} value={form[field] as [number, string] | false | null | undefined} domain={domain} onChange={(v) => setField(field, v)} />
        {errors[field] && <p className="text-xs text-destructive mt-1">{errors[field]}</p>}
      </FormField>
    )
  }

  const tabs: FormTab[] = [
    {
      key: 'salary',
      label: 'Salary Computation',
      content: (
        <div className="space-y-4">
          <div className="grid md:grid-cols-3 gap-x-8 gap-y-2">
            <TF field="basic_wage" label="Basic Wage" type="number" />
            <TF field="gross_wage" label="Gross Wage" type="number" />
            <TF field="net_wage" label="Net Wage" type="number" />
          </div>
          <div className="rounded-xl border border-dashed border-border/50 p-6 text-center text-sm text-muted-foreground">
            <Calculator className="h-6 w-6 mx-auto mb-2 opacity-40" />
            Computation breakdown will appear here once payslip rules engine is wired.
          </div>
        </div>
      ),
    },
    {
      key: 'notes',
      label: 'Notes',
      content: editing ? (
        <textarea value={asStr(form.notes)} onChange={(e) => setField('notes', e.target.value)} rows={6}
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
      ) : (
        <div className="text-sm whitespace-pre-wrap">{asStr(form.notes) || '—'}</div>
      ),
    },
  ]

  return (
    <RecordForm
      editing={editing}
      onEdit={() => setEditing(true)}
      onSave={() => saveMut.mutate()}
      onDiscard={() => {
        if (isNew) navigate(-1)
        else { setForm({ ...record }); setEditing(false); setErrors({}) }
      }}
      backTo="/admin/hr/payslips"
      statusBar={!isNew ? <StatusBar steps={steps} current={state} /> : undefined}
      headerActions={stateActions}
      topContent={
        <div className="mb-4">
          {editing ? (
            <Input value={asStr(form.name)} onChange={(e) => {
              setField('name', e.target.value)
              setErrors((er) => { const n = { ...er }; delete n.name; return n })
            }} placeholder="Payslip Description"
              className={`text-xl font-bold border-0 border-b rounded-none px-0 h-auto py-1 focus-visible:ring-0 ${
                errors.name ? 'border-red-500' : 'border-border/40 focus-visible:border-primary'
              }`} />
          ) : (
            <h2 className="text-2xl font-bold tracking-tight">{asStr(form.number) || asStr(form.name) || 'New Payslip'}</h2>
          )}
          {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
        </div>
      }
      leftFields={
        <>
          <M2O field="employee_id" model="hr.employee" label="Employee" />
          <M2O field="contract_id" model="hr.contract" label="Contract" />
          <M2O field="payslip_run_id" model="hr.payslip.run" label="Batch" />
        </>
      }
      rightFields={
        <>
          <TF field="date_from" label="Date From" type="date" />
          <TF field="date_to" label="Date To" type="date" />
          <TF field="number" label="Reference Number" />
        </>
      }
      tabs={tabs}
      chatter={recordId ? <Chatter model="hr.payslip" resId={recordId} /> : undefined}
    />
  )
}
