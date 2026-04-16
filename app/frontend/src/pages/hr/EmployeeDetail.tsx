import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Badge, Skeleton, cn } from '@mashora/design-system'
import { User } from 'lucide-react'
import { RecordForm, FormField, FormSection, ReadonlyField, toast, type FormTab } from '@/components/shared'
import Chatter from '@/components/Chatter'
import { erpClient } from '@/lib/erp-api'

const FORM_FIELDS = [
  'id', 'name', 'job_id', 'job_title', 'department_id', 'parent_id', 'coach_id',
  'work_email', 'work_phone', 'mobile_phone', 'work_location_id',
  'image_128', 'image_1920', 'employee_type', 'company_id', 'active',
  'marital', 'birthday', 'country_id', 'identification_id', 'passport_id',
  'certificate', 'study_field', 'study_school', 'address_id',
  'category_ids', 'barcode', 'departure_reason_id', 'departure_date',
  'km_home_work', 'private_car_plate',
]

const EMP_TYPES = [
  { key: 'employee', label: 'Employee' }, { key: 'worker', label: 'Worker' },
  { key: 'student', label: 'Student' }, { key: 'trainee', label: 'Trainee' },
  { key: 'contractor', label: 'Contractor' },
]

const MARITAL = [
  { key: 'single', label: 'Single' }, { key: 'married', label: 'Married' },
  { key: 'cohabitant', label: 'Cohabitant' }, { key: 'widower', label: 'Widower' },
  { key: 'divorced', label: 'Divorced' },
]

const CERT = [
  { key: 'graduate', label: 'Graduate' }, { key: 'bachelor', label: 'Bachelor' },
  { key: 'master', label: 'Master' }, { key: 'doctor', label: 'Doctor' },
  { key: 'other', label: 'Other' },
]

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id || id === 'new'
  const recordId = isNew ? null : parseInt(id || '0')
  const [editing, setEditing] = useState(isNew)
  const [form, setForm] = useState<Record<string, any>>({})

  const { data: record, isLoading } = useQuery({
    queryKey: ['employee', recordId],
    queryFn: async () => {
      if (isNew) {
        const { data } = await erpClient.raw.post('/model/hr.employee/defaults', { fields: FORM_FIELDS })
        return { ...data, id: null, employee_type: 'employee' }
      }
      const { data } = await erpClient.raw.get(`/model/hr.employee/${recordId}`)
      return data
    },
  })

  useEffect(() => { if (record) setForm({ ...record }) }, [record])
  const setField = useCallback((n: string, v: any) => { setForm(p => ({ ...p, [n]: v })) }, [])

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {}
    if (!form.name?.trim()) errs.name = 'Name is required'
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
      for (const f of ['name', 'job_title', 'work_email', 'work_phone', 'mobile_phone', 'employee_type',
        'marital', 'birthday', 'identification_id', 'passport_id', 'certificate', 'study_field',
        'study_school', 'barcode', 'private_car_plate', 'km_home_work', 'departure_date']) {
        if (form[f] !== record?.[f]) vals[f] = form[f] ?? false
      }
      for (const f of ['job_id', 'department_id', 'parent_id', 'coach_id', 'work_location_id',
        'country_id', 'address_id', 'departure_reason_id', 'company_id']) {
        const nv = Array.isArray(form[f]) ? form[f][0] : form[f]
        const ov = Array.isArray(record?.[f]) ? record[f][0] : record?.[f]
        if (nv !== ov) vals[f] = nv || false
      }
      if (JSON.stringify(form.category_ids) !== JSON.stringify(record?.category_ids)) {
        const ids = (form.category_ids || []).map((t: any) => Array.isArray(t) ? t[0] : typeof t === 'object' ? t.id : t)
        vals.category_ids = [[6, 0, ids]]
      }
      if (isNew) {
        const { data } = await erpClient.raw.post('/model/hr.employee/create', { vals: { name: form.name, ...vals } })
        return data
      }
      const { data } = await erpClient.raw.put(`/model/hr.employee/${recordId}`, { vals })
      return data
    },
    onSuccess: (data) => {
      setEditing(false)
      setErrors({})
      toast.success('Saved', 'Employee saved successfully')
      queryClient.invalidateQueries({ queryKey: ['employee'] })
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      if (isNew && data?.id) navigate(`/admin/hr/employees/${data.id}`, { replace: true })
    },
    onError: (e: any) => {
      if (e.message !== 'Validation failed') {
        toast.error('Save Failed', e?.response?.data?.detail || e.message || 'Unknown error')
      }
    },
  })

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

  const M2O = ({ field, model, label }: { field: string; model: string; label: string }) => {
    const [open, setOpen] = useState(false)
    const [q, setQ] = useState('')
    if (!editing) return <ReadonlyField label={label} value={m2oVal(form[field])} />
    return (
      <FormField label={label}>
        <div className="relative">
          <Input value={open ? q : m2oVal(form[field])} className="rounded-xl h-9" autoComplete="off"
            onChange={e => { setQ(e.target.value); searchM2o(model, e.target.value, field) }}
            onFocus={() => { setQ(m2oVal(form[field])); setOpen(true) }}
            onBlur={() => setTimeout(() => setOpen(false), 200)} placeholder="Search..." />
          {open && (m2oResults[field] || []).length > 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-xl border border-border/60 bg-popover shadow-lg max-h-48 overflow-y-auto">
              {(m2oResults[field] || []).map((r: any) => (
                <button key={r.id} className="w-full px-3 py-2 text-left text-sm hover:bg-accent first:rounded-t-xl last:rounded-b-xl"
                  onMouseDown={() => { setField(field, [r.id, r.display_name]); setOpen(false) }}>{r.display_name}</button>
              ))}
            </div>
          )}
        </div>
      </FormField>
    )
  }

  const TF = ({ field, label, type = 'text' }: { field: string; label: string; type?: string }) => {
    if (!editing) return <ReadonlyField label={label} value={form[field]} />
    return <FormField label={label}><Input type={type} value={form[field] || ''} onChange={e => setField(field, e.target.value)} className="rounded-xl h-9" /></FormField>
  }

  const SF = ({ field, label, options }: { field: string; label: string; options: { key: string; label: string }[] }) => {
    if (!editing) return <ReadonlyField label={label} value={options.find(o => o.key === form[field])?.label || form[field]} />
    return (
      <FormField label={label}>
        <Select value={form[field] || ''} onValueChange={v => setField(field, v)}>
          <SelectTrigger className="rounded-xl h-9"><SelectValue placeholder="Select..." /></SelectTrigger>
          <SelectContent>{options.map(o => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </FormField>
    )
  }

  const tabs: FormTab[] = [
    {
      key: 'work', label: 'Work Info',
      content: (
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-2">
          <div className="space-y-2">
            <FormSection title="Location">
              <M2O field="work_location_id" model="hr.work.location" label="Work Location" />
              <M2O field="address_id" model="res.partner" label="Work Address" />
            </FormSection>
          </div>
          <div className="space-y-2">
            <FormSection title="Schedule">
              <TF field="barcode" label="Badge ID" />
              <TF field="km_home_work" label="Home-Work Distance (km)" type="number" />
              <TF field="private_car_plate" label="Car Plate" />
            </FormSection>
          </div>
        </div>
      ),
    },
    {
      key: 'private', label: 'Private Info',
      content: (
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-2">
          <div className="space-y-2">
            <FormSection title="Personal">
              <SF field="marital" label="Marital Status" options={MARITAL} />
              <TF field="birthday" label="Birthday" type="date" />
              <M2O field="country_id" model="res.country" label="Nationality" />
              <TF field="identification_id" label="ID Number" />
              <TF field="passport_id" label="Passport Number" />
            </FormSection>
          </div>
          <div className="space-y-2">
            <FormSection title="Education">
              <SF field="certificate" label="Certificate Level" options={CERT} />
              <TF field="study_field" label="Field of Study" />
              <TF field="study_school" label="School" />
            </FormSection>
          </div>
        </div>
      ),
    },
  ]

  return (
    <RecordForm
      editing={editing} onEdit={() => setEditing(true)} onSave={() => saveMut.mutate()}
      onDiscard={() => { if (isNew) navigate(-1); else { setForm({ ...record }); setEditing(false) } }}
      backTo="/admin/hr/employees"
      topContent={
        <div className="flex flex-col sm:flex-row gap-4 items-start mb-4">
          {form.image_128 ? (
            <img src={`data:image/png;base64,${form.image_128}`} alt="" className="h-24 w-24 rounded-2xl object-cover shrink-0" />
          ) : (
            <div className="h-24 w-24 rounded-2xl bg-violet-500/15 flex items-center justify-center text-2xl font-bold text-violet-400 shrink-0">
              {(form.name?.[0] || '?').toUpperCase()}
            </div>
          )}
          <div className="flex-1 space-y-2 min-w-0">
            {editing ? (
              <div>
                <Input value={form.name || ''} onChange={e => { setField('name', e.target.value); setErrors(er => { const n = { ...er }; delete n.name; return n }) }} placeholder="Employee Name"
                  className={`text-xl font-bold border-0 border-b rounded-none px-0 h-auto py-1 focus-visible:ring-0 ${errors.name ? 'border-red-500 focus-visible:border-red-500' : 'border-border/40 focus-visible:border-primary'}`} />
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
              </div>
            ) : (
              <h2 className="text-2xl font-bold tracking-tight">{form.name || 'New Employee'}</h2>
            )}
            <TF field="job_title" label="Job Title" />
          </div>
        </div>
      }
      leftFields={
        <>
          <M2O field="department_id" model="hr.department" label="Department" />
          <M2O field="job_id" model="hr.job" label="Job Position" />
          <M2O field="parent_id" model="hr.employee" label="Manager" />
          <M2O field="coach_id" model="hr.employee" label="Coach" />
        </>
      }
      rightFields={
        <>
          <TF field="work_email" label="Work Email" type="email" />
          <TF field="work_phone" label="Work Phone" type="tel" />
          <TF field="mobile_phone" label="Mobile" type="tel" />
          <SF field="employee_type" label="Employee Type" options={EMP_TYPES} />
          {!editing ? (
            <ReadonlyField label="Tags" value={
              Array.isArray(form.category_ids) && form.category_ids.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {form.category_ids.map((t: any, i: number) => <Badge key={i} variant="secondary" className="rounded-full text-xs">{Array.isArray(t) ? t[1] : t?.display_name || t}</Badge>)}
                </div>
              ) : undefined
            } />
          ) : null}
        </>
      }
      tabs={tabs}
      chatter={recordId ? <Chatter model="hr.employee" resId={recordId} /> : undefined}
    />
  )
}
