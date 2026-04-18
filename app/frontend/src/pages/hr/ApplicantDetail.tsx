import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Input, Skeleton } from '@mashora/design-system'
import {
  RecordForm, FormField, ReadonlyField, toast, type FormTab,
} from '@/components/shared'
import M2OInput from '@/components/shared/M2OInput'
import Chatter from '@/components/Chatter'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'
import { Check, X, UserPlus } from 'lucide-react'

const asStr = (v: unknown): string => {
  if (v == null || v === false) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return ''
}

interface Stage {
  id: number
  name: string
  hired_stage: boolean
}

export default function ApplicantDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id || id === 'new'
  const recordId = isNew ? null : parseInt(id || '0')
  const [editing, setEditing] = useState(isNew)
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: record, isLoading } = useQuery({
    queryKey: ['applicant', recordId],
    queryFn: async () => {
      if (isNew) return { id: null, partner_name: '', priority: '0', kanban_state: 'normal', active: true }
      const { data } = await erpClient.raw.get(`/model/hr.applicant/${recordId}`)
      return data
    },
  })

  const { data: stagesData } = useQuery({
    queryKey: ['recruitment-stages-all'],
    queryFn: () =>
      erpClient.raw
        .post('/model/hr.recruitment.stage', {
          fields: ['id', 'name', 'hired_stage'],
          order: 'sequence asc, id asc',
          limit: 100,
        })
        .then((r) => r.data),
  })

  useEffect(() => { if (record) setForm({ ...record }) }, [record])
  const setField = useCallback((n: string, v: unknown) => { setForm((p) => ({ ...p, [n]: v })) }, [])

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {}
    if (!asStr(form.partner_name).trim()) errs.partner_name = 'Name is required'
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
      for (const f of ['partner_name', 'email_from', 'partner_phone', 'salary_expected', 'salary_proposed', 'availability', 'description']) {
        if (form[f] !== record?.[f]) vals[f] = form[f] ?? false
      }
      for (const f of ['job_id', 'department_id', 'stage_id', 'user_id']) {
        const fv = form[f]
        const rv = record?.[f]
        const nv = Array.isArray(fv) ? fv[0] : fv
        const ov = Array.isArray(rv) ? rv[0] : rv
        if (nv !== ov) vals[f] = nv || false
      }
      if (isNew) {
        const { data } = await erpClient.raw.post('/model/hr.applicant/create', {
          vals: { partner_name: form.partner_name, ...vals },
        })
        return data
      }
      const { data } = await erpClient.raw.put(`/model/hr.applicant/${recordId}`, { vals })
      return data
    },
    onSuccess: (data) => {
      setEditing(false)
      setErrors({})
      toast.success('Saved', 'Applicant saved')
      queryClient.invalidateQueries({ queryKey: ['applicant'] })
      queryClient.invalidateQueries({ queryKey: ['applicants'] })
      if (isNew && data?.id) navigate(`/admin/hr/recruitment/${data.id}`, { replace: true })
    },
    onError: (e: unknown) => {
      if (e instanceof Error && e.message === 'Validation failed') return
      toast.error('Save Failed', extractErrorMessage(e))
    },
  })

  const hireMut = useMutation({
    mutationFn: async () => {
      // Find hired stage
      const stages: Stage[] = stagesData?.records ?? []
      const hiredStage = stages.find((s) => s.hired_stage)
      // Create employee from applicant
      const jobId = Array.isArray(form.job_id) ? form.job_id[0] : form.job_id
      const deptId = Array.isArray(form.department_id) ? form.department_id[0] : form.department_id
      const userId = Array.isArray(form.user_id) ? form.user_id[0] : form.user_id
      const { data: emp } = await erpClient.raw.post('/model/hr.employee/create', {
        vals: {
          name: form.partner_name,
          work_email: form.email_from || false,
          work_phone: form.partner_phone || false,
          job_id: jobId || false,
          department_id: deptId || false,
          user_id: userId || false,
        },
      })
      // Update applicant with employee_id, hired stage, and date_closed
      await erpClient.raw.put(`/model/hr.applicant/${recordId}`, {
        vals: {
          employee_id: emp.id,
          stage_id: hiredStage?.id || false,
          date_closed: new Date().toISOString().split('T')[0] + ' ' + new Date().toTimeString().split(' ')[0],
        },
      })
      return emp
    },
    onSuccess: (emp) => {
      toast.success('Hired', `Employee created (#${emp.id})`)
      queryClient.invalidateQueries({ queryKey: ['applicant', recordId] })
      queryClient.invalidateQueries({ queryKey: ['applicants'] })
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
    onError: (e: unknown) => toast.error('Hire Failed', extractErrorMessage(e)),
  })

  const refuseMut = useMutation({
    mutationFn: async () => {
      const { data } = await erpClient.raw.put(`/model/hr.applicant/${recordId}`, {
        vals: {
          active: false,
          date_closed: new Date().toISOString().split('T')[0] + ' ' + new Date().toTimeString().split(' ')[0],
        },
      })
      return data
    },
    onSuccess: () => {
      toast.success('Refused', 'Applicant archived')
      queryClient.invalidateQueries({ queryKey: ['applicant', recordId] })
      queryClient.invalidateQueries({ queryKey: ['applicants'] })
      navigate('/admin/hr/recruitment')
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

  const hasEmployee = Array.isArray(form.employee_id) && form.employee_id[0]
  const isActive = form.active !== false

  const stateActions = !isNew && !editing ? (
    <>
      {!hasEmployee && isActive && (
        <Button size="sm" className="rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => hireMut.mutate()} disabled={hireMut.isPending}>
          <UserPlus className="h-3.5 w-3.5" /> {hireMut.isPending ? 'Hiring…' : 'Hire'}
        </Button>
      )}
      {hasEmployee && (
        <Button size="sm" variant="outline" className="rounded-xl gap-1.5"
          onClick={() => navigate(`/admin/hr/employees/${(form.employee_id as [number, string])[0]}`)}>
          <Check className="h-3.5 w-3.5" /> View Employee
        </Button>
      )}
      {isActive && (
        <Button size="sm" variant="destructive" className="rounded-xl gap-1.5"
          onClick={() => refuseMut.mutate()} disabled={refuseMut.isPending}>
          <X className="h-3.5 w-3.5" /> {refuseMut.isPending ? 'Refusing…' : 'Refuse'}
        </Button>
      )}
    </>
  ) : null

  const TF = ({ field, label, type = 'text' }: { field: string; label: string; type?: string }) => {
    if (!editing) return <ReadonlyField label={label} value={asStr(form[field])} />
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
        <M2OInput model={model} value={form[field] as [number, string] | false | null | undefined} onChange={(v) => setField(field, v)} />
      </FormField>
    )
  }

  const tabs: FormTab[] = [
    {
      key: 'description',
      label: 'Description',
      content: editing ? (
        <textarea value={asStr(form.description)} onChange={(e) => setField('description', e.target.value)} rows={8}
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
      ) : (
        <div className="text-sm whitespace-pre-wrap">{asStr(form.description) || '—'}</div>
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
      backTo="/admin/hr/recruitment"
      headerActions={stateActions}
      topContent={
        <div className="mb-4">
          {editing ? (
            <Input value={asStr(form.partner_name)} onChange={(e) => {
              setField('partner_name', e.target.value)
              setErrors((er) => { const n = { ...er }; delete n.partner_name; return n })
            }} placeholder="Applicant Name"
              className={`text-xl font-bold border-0 border-b rounded-none px-0 h-auto py-1 focus-visible:ring-0 ${
                errors.partner_name ? 'border-red-500' : 'border-border/40 focus-visible:border-primary'
              }`} />
          ) : (
            <h2 className="text-2xl font-bold tracking-tight">{asStr(form.partner_name) || 'New Applicant'}</h2>
          )}
          {errors.partner_name && <p className="text-xs text-destructive mt-1">{errors.partner_name}</p>}
          {!isActive && <p className="text-xs text-destructive mt-1">Archived (refused)</p>}
        </div>
      }
      leftFields={
        <>
          <TF field="email_from" label="Email" type="email" />
          <TF field="partner_phone" label="Phone" type="tel" />
          <M2O field="job_id" model="hr.job" label="Job Position" />
          <M2O field="department_id" model="hr.department" label="Department" />
        </>
      }
      rightFields={
        <>
          <M2O field="stage_id" model="hr.recruitment.stage" label="Stage" />
          <M2O field="user_id" model="res.users" label="Recruiter" />
          <TF field="salary_expected" label="Expected Salary" type="number" />
          <TF field="salary_proposed" label="Proposed Salary" type="number" />
          <TF field="availability" label="Availability" type="date" />
        </>
      }
      tabs={tabs}
      chatter={recordId ? <Chatter model="hr.applicant" resId={recordId} /> : undefined}
    />
  )
}
