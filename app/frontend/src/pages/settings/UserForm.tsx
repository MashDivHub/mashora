import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input, Badge, Skeleton } from '@mashora/design-system'
import { Shield, User } from 'lucide-react'
import { RecordForm, FormField, FormSection, ReadonlyField, toast, type FormTab } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { sanitizedHtml } from '@/lib/sanitize'

const FORM_FIELDS = [
  'id', 'name', 'login', 'email', 'image_128', 'active', 'share',
  'company_id', 'company_ids', 'partner_id', 'lang', 'tz', 'signature',
]

export default function UserForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id || id === 'new'
  const recordId = isNew ? null : parseInt(id || '0')
  const [editing, setEditing] = useState(isNew)
  const [form, setForm] = useState<Record<string, any>>({})

  const { data: record, isLoading } = useQuery({
    queryKey: ['user', recordId],
    queryFn: async () => {
      if (isNew) return { id: null, name: '', login: '', email: '', active: true, share: false }
      const { data } = await erpClient.raw.get(`/model/res.users/${recordId}`)
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
    if (!form.login?.trim()) errs.login = 'Login is required'
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
      for (const f of ['name', 'login', 'email', 'lang', 'tz']) {
        if (form[f] !== record?.[f]) vals[f] = form[f] ?? false
      }
      for (const f of ['company_id']) {
        const nv = Array.isArray(form[f]) ? form[f][0] : form[f]
        const ov = Array.isArray(record?.[f]) ? record[f][0] : record?.[f]
        if (nv !== ov) vals[f] = nv || false
      }
      if (isNew) {
        vals.login = form.login || form.email
        const { data } = await erpClient.raw.post('/model/res.users/create', { vals: { name: form.name, ...vals } })
        return data
      }
      const { data } = await erpClient.raw.put(`/model/res.users/${recordId}`, { vals })
      return data
    },
    onSuccess: (data) => {
      setEditing(false)
      setErrors({})
      toast.success('Saved', 'User saved successfully')
      queryClient.invalidateQueries({ queryKey: ['user'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      if (isNew && data?.id) navigate(`/admin/settings/users/${data.id}`, { replace: true })
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

  const TF = ({ field, label, type = 'text', required, errorMsg, onClearError }: { field: string; label: string; type?: string; required?: boolean; errorMsg?: string; onClearError?: () => void }) => {
    if (!editing) return <ReadonlyField label={label} value={form[field]} />
    return (
      <FormField label={label} required={required}>
        <Input type={type} value={form[field] || ''} onChange={e => { setField(field, e.target.value); onClearError?.() }} className={`rounded-xl h-9${errorMsg ? ' ring-2 ring-red-500/50' : ''}`} />
        {errorMsg && <p className="text-xs text-destructive mt-1">{errorMsg}</p>}
      </FormField>
    )
  }

  const tabs: FormTab[] = [
    {
      key: 'preferences', label: 'Preferences',
      content: (
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-2">
          <div className="space-y-2">
            <TF field="lang" label="Language" />
            <TF field="tz" label="Timezone" />
          </div>
          <div className="space-y-2">
            <M2O field="company_id" model="res.company" label="Default Company" />
            {/* Companies */}
            {!editing ? (
              <ReadonlyField label="Allowed Companies" value={
                Array.isArray(form.company_ids) && form.company_ids.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {form.company_ids.map((c: any, i: number) => <Badge key={i} variant="secondary" className="rounded-full text-xs">{Array.isArray(c) ? c[1] : c?.display_name || c}</Badge>)}
                  </div>
                ) : undefined
              } />
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: 'signature', label: 'Email Signature',
      content: editing
        ? <FormField label="Signature"><Input value={form.signature || ''} onChange={e => setField('signature', e.target.value)} className="rounded-xl h-9" /></FormField>
        : form.signature ? <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={sanitizedHtml(form.signature)} /> : <ReadonlyField label="Signature" value={undefined} />,
    },
  ]

  return (
    <RecordForm
      editing={editing} onEdit={() => setEditing(true)} onSave={() => saveMut.mutate()}
      onDiscard={() => { if (isNew) navigate(-1); else { setForm({ ...record }); setEditing(false) } }}
      backTo="/admin/settings/users"
      headerActions={
        form.share === false ? <Badge variant="default" className="rounded-full text-xs gap-1"><Shield className="h-3 w-3" /> Internal User</Badge>
        : form.share ? <Badge variant="secondary" className="rounded-full text-xs">Portal User</Badge> : undefined
      }
      topContent={
        <div className="flex flex-col sm:flex-row gap-4 items-start mb-4">
          {form.image_128 ? (
            <img src={`data:image/png;base64,${form.image_128}`} alt="" className="h-20 w-20 rounded-2xl object-cover shrink-0" />
          ) : (
            <div className="h-20 w-20 rounded-2xl bg-primary/15 flex items-center justify-center text-2xl font-bold text-primary shrink-0">
              {(form.name?.[0] || '?').toUpperCase()}
            </div>
          )}
          <div className="flex-1 space-y-2 min-w-0">
            {editing ? (
              <div>
                <Input value={form.name || ''} onChange={e => { setField('name', e.target.value); setErrors(er => { const n = { ...er }; delete n.name; return n }) }} placeholder="Full Name"
                  className={`text-xl font-bold border-0 border-b rounded-none px-0 h-auto py-1 focus-visible:ring-0 ${errors.name ? 'border-red-500 focus-visible:border-red-500' : 'border-border/40 focus-visible:border-primary'}`} />
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
              </div>
            ) : (
              <h2 className="text-2xl font-bold tracking-tight">{form.name || 'New User'}</h2>
            )}
            <ReadonlyField label="Login" value={form.login} />
          </div>
        </div>
      }
      leftFields={
        <>
          <TF field="name" label="Name" required errorMsg={errors.name} onClearError={() => setErrors(er => { const n = { ...er }; delete n.name; return n })} />
          <TF field="login" label="Login" required errorMsg={errors.login} onClearError={() => setErrors(er => { const n = { ...er }; delete n.login; return n })} />
          <TF field="email" label="Email" type="email" />
        </>
      }
      rightFields={
        <>
          <M2O field="company_id" model="res.company" label="Company" />
          <ReadonlyField label="Status" value={form.active ? 'Active' : 'Archived'} />
        </>
      }
      tabs={tabs}
    />
  )
}
