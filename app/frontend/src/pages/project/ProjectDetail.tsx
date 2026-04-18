import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input, Textarea, Badge, Skeleton, cn } from '@mashora/design-system'
import { CheckSquare, FolderKanban } from 'lucide-react'
import { RecordForm, FormField, ReadonlyField, toast, type SmartButton, type FormTab } from '@/components/shared'
import Chatter from '@/components/Chatter'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'
import { sanitizedHtml } from '@/lib/sanitize'

interface NameSearchResult { id: number; display_name: string }
type TagValue = [number, string] | { id: number; display_name?: string } | number

const FORM_FIELDS = [
  'id', 'name', 'partner_id', 'user_id', 'date_start', 'date',
  'tag_ids', 'task_count', 'open_task_count', 'description',
  'label_tasks', 'allow_milestones', 'last_update_status',
  'stage_id', 'color', 'active', 'company_id',
]

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  on_track: { label: 'On Track', color: 'bg-emerald-500' },
  at_risk: { label: 'At Risk', color: 'bg-amber-500' },
  off_track: { label: 'Off Track', color: 'bg-red-500' },
  on_hold: { label: 'On Hold', color: 'bg-blue-500' },
  done: { label: 'Done', color: 'bg-emerald-500' },
  to_define: { label: 'To Define', color: 'bg-muted-foreground' },
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id || id === 'new'
  const recordId = isNew ? null : parseInt(id || '0')
  const [editing, setEditing] = useState(isNew)
  const [form, setForm] = useState<Record<string, unknown>>({})

  const { data: record, isLoading } = useQuery({
    queryKey: ['project', recordId],
    queryFn: async () => {
      if (isNew) {
        const { data } = await erpClient.raw.post('/model/project.project/defaults', { fields: FORM_FIELDS })
        return { ...data, id: null }
      }
      const { data } = await erpClient.raw.get(`/model/project.project/${recordId}`)
      return data
    },
  })

  useEffect(() => { if (record) setForm({ ...record }) }, [record])
  const setField = useCallback((n: string, v: unknown) => { setForm(p => ({ ...p, [n]: v })) }, [])
  const asStr = (v: unknown): string => (v == null || v === false ? '' : String(v))

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {}
    if (typeof form.name !== 'string' || !form.name.trim()) errs.name = 'Name is required'
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
      const rec = (record ?? {}) as Record<string, unknown>
      for (const f of ['name', 'description', 'date_start', 'date', 'label_tasks', 'allow_milestones', 'last_update_status']) {
        if (form[f] !== rec[f]) vals[f] = form[f] ?? false
      }
      for (const f of ['partner_id', 'user_id', 'stage_id']) {
        const fv = form[f]; const rv = rec[f]
        const nv = Array.isArray(fv) ? fv[0] : fv
        const ov = Array.isArray(rv) ? rv[0] : rv
        if (nv !== ov) vals[f] = nv || false
      }
      if (isNew) {
        const { data } = await erpClient.raw.post('/model/project.project/create', { vals: { name: form.name, ...vals } })
        return data
      }
      const { data } = await erpClient.raw.put(`/model/project.project/${recordId}`, { vals })
      return data
    },
    onSuccess: (data) => {
      setEditing(false)
      setErrors({})
      toast.success('Saved', 'Project saved successfully')
      queryClient.invalidateQueries({ queryKey: ['project'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      if (isNew && data?.id) navigate(`/admin/projects/${data.id}`, { replace: true })
    },
    onError: (e: unknown) => {
      if (!(e instanceof Error && e.message === 'Validation failed')) {
        toast.error('Save Failed', extractErrorMessage(e))
      }
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

  const m2oVal = (v: unknown): string => (Array.isArray(v) ? String(v[1] ?? '') : '')
  const status = STATUS_MAP[asStr(form.last_update_status)] || STATUS_MAP.to_define

  const smartButtons: SmartButton[] = [
    { label: 'Tasks', value: `${Number(form.open_task_count ?? 0)} / ${Number(form.task_count ?? 0)}`, icon: <CheckSquare className="h-5 w-5" />, onClick: () => navigate(`/admin/projects/tasks?project=${recordId}`) },
  ]

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
              {(m2oResults[field] || []).map((r) => (
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
    if (!editing) return <ReadonlyField label={label} value={asStr(form[field])} />
    return <FormField label={label}><Input type={type} value={asStr(form[field])} onChange={e => setField(field, e.target.value)} className="rounded-xl h-9" /></FormField>
  }

  const tabs: FormTab[] = [
    {
      key: 'description', label: 'Description',
      content: editing
        ? <Textarea value={asStr(form.description)} onChange={e => setField('description', e.target.value)} rows={6} placeholder="Project description..." className="rounded-xl resize-y" />
        : form.description ? <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={sanitizedHtml(String(form.description))} /> : <p className="text-sm text-muted-foreground">No description</p>,
    },
    {
      key: 'settings', label: 'Settings',
      content: (
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-2">
          <div className="space-y-2">
            <TF field="label_tasks" label="Task Label" />
            <ReadonlyField label="Milestones" value={form.allow_milestones ? 'Enabled' : 'Disabled'} />
          </div>
          <div className="space-y-2">
            <M2O field="stage_id" model="project.project.stage" label="Stage" />
          </div>
        </div>
      ),
    },
  ]

  return (
    <RecordForm
      editing={editing} onEdit={() => setEditing(true)} onSave={() => saveMut.mutate()}
      onDiscard={() => { if (isNew) navigate(-1); else { setForm({ ...record }); setEditing(false) } }}
      backTo="/admin/projects/list" smartButtons={smartButtons}
      headerActions={
        !isNew ? (
          <div className="flex items-center gap-2">
            <div className={cn('h-2.5 w-2.5 rounded-full', status.color)} />
            <span className="text-xs font-medium text-muted-foreground">{status.label}</span>
          </div>
        ) : undefined
      }
      topContent={
        <div className="flex items-center gap-3 mb-2">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center"><FolderKanban className="h-6 w-6 text-primary" /></div>
          {editing ? (
            <div className="flex-1">
              <Input value={asStr(form.name)} onChange={e => { setField('name', e.target.value); setErrors(er => { const n = { ...er }; delete n.name; return n }) }} placeholder="Project name"
                className={`text-xl font-bold border-0 border-b rounded-none px-0 h-auto py-1 w-full focus-visible:ring-0 ${errors.name ? 'border-red-500 focus-visible:border-red-500' : 'border-border/40 focus-visible:border-primary'}`} />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
            </div>
          ) : (
            <h2 className="text-2xl font-bold tracking-tight">{asStr(form.name) || 'New Project'}</h2>
          )}
        </div>
      }
      leftFields={
        <>
          <M2O field="partner_id" model="res.partner" label="Customer" />
          <M2O field="user_id" model="res.users" label="Project Manager" />
        </>
      }
      rightFields={
        <>
          <TF field="date_start" label="Start Date" type="date" />
          <TF field="date" label="End Date" type="date" />
          {!editing ? (
            <ReadonlyField label="Tags" value={
              Array.isArray(form.tag_ids) && form.tag_ids.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {(form.tag_ids as TagValue[]).map((t, i: number) => {
                    const key = Array.isArray(t) ? t[0] : (typeof t === 'object' && t !== null ? t.id : i)
                    const label = Array.isArray(t)
                      ? t[1]
                      : (typeof t === 'object' && t !== null ? (t.display_name ?? String(t.id)) : String(t))
                    return <Badge key={key} variant="secondary" className="rounded-full text-xs">{label}</Badge>
                  })}
                </div>
              ) : undefined
            } />
          ) : null}
        </>
      }
      tabs={tabs}
      chatter={recordId ? <Chatter model="project.project" resId={recordId} /> : undefined}
    />
  )
}
