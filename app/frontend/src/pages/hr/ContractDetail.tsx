import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton,
} from '@mashora/design-system'
import {
  RecordForm, FormField, FormSection, ReadonlyField, StatusBar, toast, type FormTab,
} from '@/components/shared'
import M2OInput from '@/components/shared/M2OInput'
import Chatter from '@/components/Chatter'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'
import { Check, X, RotateCcw } from 'lucide-react'

const FORM_FIELDS = [
  'id', 'name', 'employee_id', 'department_id', 'job_id',
  'date_start', 'date_end', 'trial_date_end', 'state', 'wage',
  'contract_type', 'notes', 'hr_responsible_id',
]

const STATUS_STEPS = [
  { key: 'draft', label: 'Draft' },
  { key: 'open', label: 'Running', color: 'success' as const },
  { key: 'close', label: 'Expired' },
]

const CANCEL_STEP = { key: 'cancel', label: 'Cancelled', color: 'danger' as const }

const CONTRACT_TYPES = [
  { key: 'cdi', label: 'Permanent (CDI)' },
  { key: 'cdd', label: 'Fixed-term (CDD)' },
  { key: 'intern', label: 'Internship' },
  { key: 'freelance', label: 'Freelance' },
]

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id || id === 'new'
  const recordId = isNew ? null : parseInt(id || '0')
  const [editing, setEditing] = useState(isNew)
  const [form, setForm] = useState<Record<string, unknown>>({})
  const asStr = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
  const m2oVal = (v: unknown): [number, string] | false | null => {
    if (Array.isArray(v) && v.length >= 2 && typeof v[0] === 'number') return [v[0], String(v[1] ?? '')]
    return false
  }
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: record, isLoading } = useQuery({
    queryKey: ['contract', recordId],
    queryFn: async () => {
      if (isNew) {
        const { data } = await erpClient.raw
          .post('/model/hr.contract/defaults', { fields: FORM_FIELDS })
          .catch(() => ({ data: {} }))
        return {
          ...data,
          id: null,
          state: 'draft',
          date_start: new Date().toISOString().split('T')[0],
        }
      }
      const { data } = await erpClient.raw.get(`/model/hr.contract/${recordId}`)
      return data
    },
  })

  useEffect(() => { if (record) setForm({ ...record }) }, [record])
  const setField = useCallback((n: string, v: unknown) => { setForm((p) => ({ ...p, [n]: v })) }, [])

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {}
    if (!asStr(form.name).trim()) errs.name = 'Reference is required'
    const eid = Array.isArray(form.employee_id) ? form.employee_id[0] : form.employee_id
    if (!eid) errs.employee_id = 'Employee is required'
    if (!form.date_start) errs.date_start = 'Start date is required'
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
      for (const f of ['name', 'date_start', 'date_end', 'trial_date_end', 'wage', 'contract_type', 'notes']) {
        if (form[f] !== record?.[f]) vals[f] = form[f] ?? false
      }
      for (const f of ['employee_id', 'department_id', 'job_id', 'hr_responsible_id']) {
        const rv = form[f]
        const rec = record?.[f]
        const nv = Array.isArray(rv) ? rv[0] : rv
        const ov = Array.isArray(rec) ? rec[0] : rec
        if (nv !== ov) vals[f] = nv || false
      }
      if (isNew) {
        const eid = Array.isArray(form.employee_id) ? form.employee_id[0] : form.employee_id
        const { data } = await erpClient.raw.post('/model/hr.contract/create', {
          vals: {
            name: form.name,
            employee_id: eid,
            date_start: form.date_start,
            ...vals,
          },
        })
        return data
      }
      const { data } = await erpClient.raw.put(`/model/hr.contract/${recordId}`, { vals })
      return data
    },
    onSuccess: (data) => {
      setEditing(false)
      setErrors({})
      toast.success('Saved', 'Contract saved successfully')
      queryClient.invalidateQueries({ queryKey: ['contract'] })
      queryClient.invalidateQueries({ queryKey: ['hr-contracts'] })
      if (isNew && data?.id) navigate(`/admin/hr/contracts/${data.id}`, { replace: true })
    },
    onError: (e: unknown) => {
      if (e instanceof Error && e.message === 'Validation failed') return
      toast.error('Save Failed', extractErrorMessage(e, 'Unknown error'))
    },
  })

  const setStateMut = useMutation({
    mutationFn: async (newState: string) => {
      const { data } = await erpClient.raw.put(`/model/hr.contract/${recordId}`, {
        vals: { state: newState },
      })
      return data
    },
    onSuccess: (_d, newState) => {
      toast.success('Updated', `Contract set to ${newState}`)
      queryClient.invalidateQueries({ queryKey: ['contract', recordId] })
      queryClient.invalidateQueries({ queryKey: ['hr-contracts'] })
    },
    onError: (e: unknown) => {
      toast.error('Error', extractErrorMessage(e, 'Failed to update state'))
    },
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
        <Button size="sm" className="rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => setStateMut.mutate('open')} disabled={setStateMut.isPending}>
          <Check className="h-3.5 w-3.5" /> Start Contract
        </Button>
      )}
      {state === 'open' && (
        <Button size="sm" variant="outline" className="rounded-xl gap-1.5"
          onClick={() => setStateMut.mutate('close')} disabled={setStateMut.isPending}>
          <X className="h-3.5 w-3.5" /> Close
        </Button>
      )}
      {(state === 'draft' || state === 'open') && (
        <Button size="sm" variant="destructive" className="rounded-xl gap-1.5"
          onClick={() => setStateMut.mutate('cancel')} disabled={setStateMut.isPending}>
          <X className="h-3.5 w-3.5" /> Cancel
        </Button>
      )}
      {(state === 'close' || state === 'cancel') && (
        <Button size="sm" variant="outline" className="rounded-xl gap-1.5"
          onClick={() => setStateMut.mutate('draft')} disabled={setStateMut.isPending}>
          <RotateCcw className="h-3.5 w-3.5" /> Reset to Draft
        </Button>
      )}
    </>
  ) : null

  const TF = ({ field, label, type = 'text' }: { field: string; label: string; type?: string }) => {
    if (!editing) {
      return <ReadonlyField label={label} value={asStr(form[field])} />
    }
    return (
      <FormField label={label}>
        <Input type={type} value={asStr(form[field])} onChange={(e) => setField(field, e.target.value)}
          className={`rounded-xl h-9 ${errors[field] ? 'border-red-500' : ''}`} />
        {errors[field] && <p className="text-xs text-destructive mt-1">{errors[field]}</p>}
      </FormField>
    )
  }

  const M2O = ({ field, label, model }: { field: string; label: string; model: string }) => {
    if (!editing) {
      const v = form[field]
      return <ReadonlyField label={label} value={Array.isArray(v) ? String(v[1] ?? '') : ''} />
    }
    return (
      <FormField label={label}>
        <M2OInput model={model} value={m2oVal(form[field])} onChange={(v) => setField(field, v)} />
        {errors[field] && <p className="text-xs text-destructive mt-1">{errors[field]}</p>}
      </FormField>
    )
  }

  const SF = ({ field, label, options }: { field: string; label: string; options: { key: string; label: string }[] }) => {
    if (!editing) {
      const s = asStr(form[field])
      return <ReadonlyField label={label} value={options.find((o) => o.key === s)?.label || s} />
    }
    return (
      <FormField label={label}>
        <Select value={asStr(form[field])} onValueChange={(v) => setField(field, v)}>
          <SelectTrigger className="rounded-xl h-9"><SelectValue placeholder="Select..." /></SelectTrigger>
          <SelectContent>
            {options.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </FormField>
    )
  }

  const tabs: FormTab[] = [
    {
      key: 'info',
      label: 'Details',
      content: (
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-2">
          <div className="space-y-2">
            <FormSection title="Salary">
              <TF field="wage" label="Wage" type="number" />
              <SF field="contract_type" label="Contract Type" options={CONTRACT_TYPES} />
            </FormSection>
          </div>
          <div className="space-y-2">
            <FormSection title="Responsible">
              <M2O field="hr_responsible_id" model="res.users" label="HR Responsible" />
            </FormSection>
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
        else {
          setForm({ ...record })
          setEditing(false)
          setErrors({})
        }
      }}
      backTo="/admin/hr/contracts"
      statusBar={!isNew ? <StatusBar steps={steps} current={state} /> : undefined}
      headerActions={stateActions}
      topContent={
        <div className="mb-4">
          {editing ? (
            <Input value={asStr(form.name)} onChange={(e) => {
              setField('name', e.target.value)
              setErrors((er) => { const n = { ...er }; delete n.name; return n })
            }} placeholder="Contract Reference"
              className={`text-xl font-bold border-0 border-b rounded-none px-0 h-auto py-1 focus-visible:ring-0 ${
                errors.name ? 'border-red-500 focus-visible:border-red-500' : 'border-border/40 focus-visible:border-primary'
              }`} />
          ) : (
            <h2 className="text-2xl font-bold tracking-tight">{asStr(form.name) || 'New Contract'}</h2>
          )}
          {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
        </div>
      }
      leftFields={
        <>
          <M2O field="employee_id" model="hr.employee" label="Employee" />
          <M2O field="department_id" model="hr.department" label="Department" />
          <M2O field="job_id" model="hr.job" label="Job Position" />
        </>
      }
      rightFields={
        <>
          <TF field="date_start" label="Start Date" type="date" />
          <TF field="date_end" label="End Date" type="date" />
          <TF field="trial_date_end" label="Trial End Date" type="date" />
        </>
      }
      tabs={tabs}
      chatter={recordId ? <Chatter model="hr.contract" resId={recordId} /> : undefined}
    />
  )
}
