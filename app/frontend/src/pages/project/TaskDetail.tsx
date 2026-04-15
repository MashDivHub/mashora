import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input, Textarea, Button, Badge, Skeleton, cn } from '@mashora/design-system'
import { Star, FolderKanban } from 'lucide-react'
import { RecordForm, FormField, ReadonlyField, StatusBar, toast, type FormTab } from '@/components/shared'
import Chatter from '@/components/Chatter'
import { erpClient } from '@/lib/erp-api'
import { sanitizedHtml } from '@/lib/sanitize'

const FORM_FIELDS = [
  'id', 'name', 'project_id', 'user_ids', 'stage_id', 'priority', 'state',
  'date_deadline', 'date_assign', 'date_end', 'tag_ids', 'description',
  'partner_id', 'parent_id', 'child_ids', 'milestone_id', 'sequence', 'color',
]

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = id === 'new'
  const recordId = isNew ? null : parseInt(id || '0')
  const [editing, setEditing] = useState(isNew)
  const [form, setForm] = useState<Record<string, any>>({})

  const { data: stages } = useQuery({
    queryKey: ['task-stages'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/project.task.type', {
        fields: ['id', 'name', 'sequence', 'fold'], order: 'sequence asc', limit: 20,
      })
      return data.records || []
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: record, isLoading } = useQuery({
    queryKey: ['task', recordId],
    queryFn: async () => {
      if (isNew) {
        const { data } = await erpClient.raw.post('/model/project.task/defaults', { fields: FORM_FIELDS })
        return { ...data, id: null, priority: '0' }
      }
      const { data } = await erpClient.raw.get(`/model/project.task/${recordId}`)
      return data
    },
  })

  useEffect(() => { if (record) { setForm({ ...record }) } }, [record])
  const setField = useCallback((n: string, v: any) => { setForm(p => ({ ...p, [n]: v })) }, [])

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {}
    if (!form.name?.trim()) errs.name = 'Name is required'
    const projectId = Array.isArray(form.project_id) ? form.project_id[0] : form.project_id
    if (!projectId) errs.project_id = 'Project is required'
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
      for (const f of ['name', 'description', 'priority', 'date_deadline', 'sequence']) {
        if (form[f] !== record?.[f]) vals[f] = form[f] ?? false
      }
      for (const f of ['project_id', 'stage_id', 'partner_id', 'parent_id', 'milestone_id']) {
        const nv = Array.isArray(form[f]) ? form[f][0] : form[f]
        const ov = Array.isArray(record?.[f]) ? record[f][0] : record?.[f]
        if (nv !== ov) vals[f] = nv || false
      }
      if (JSON.stringify(form.user_ids) !== JSON.stringify(record?.user_ids)) {
        const ids = (form.user_ids || []).map((u: any) => Array.isArray(u) ? u[0] : typeof u === 'object' ? u.id : u)
        vals.user_ids = [[6, 0, ids]]
      }
      if (JSON.stringify(form.tag_ids) !== JSON.stringify(record?.tag_ids)) {
        const ids = (form.tag_ids || []).map((t: any) => Array.isArray(t) ? t[0] : typeof t === 'object' ? t.id : t)
        vals.tag_ids = [[6, 0, ids]]
      }
      if (isNew) {
        if (!vals.project_id && form.project_id) vals.project_id = Array.isArray(form.project_id) ? form.project_id[0] : form.project_id
        const { data } = await erpClient.raw.post('/model/project.task/create', { vals: { name: form.name, ...vals } })
        return data
      }
      const { data } = await erpClient.raw.put(`/model/project.task/${recordId}`, { vals })
      return data
    },
    onSuccess: (data) => {
      setEditing(false)
      setErrors({})
      toast.success('Saved', 'Task saved successfully')
      queryClient.invalidateQueries({ queryKey: ['task'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      if (isNew && data?.id) navigate(`/admin/projects/tasks/${data.id}`, { replace: true })
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
  const currentStage = Array.isArray(form.stage_id) ? String(form.stage_id[0]) : String(form.stage_id || '')
  const stageSteps = (stages || []).filter((s: any) => !s.fold).map((s: any) => ({ key: String(s.id), label: s.name }))

  const M2O = ({ field, model, label, required, errorMsg, onSelect }: { field: string; model: string; label: string; required?: boolean; errorMsg?: string; onSelect?: () => void }) => {
    const [open, setOpen] = useState(false)
    const [q, setQ] = useState('')
    if (!editing) return <ReadonlyField label={label} value={m2oVal(form[field])} />
    return (
      <FormField label={label} required={required}>
        <div className="relative">
          <Input value={open ? q : m2oVal(form[field])} className={`rounded-xl h-9${errorMsg ? ' ring-2 ring-red-500/50' : ''}`} autoComplete="off"
            onChange={e => { setQ(e.target.value); searchM2o(model, e.target.value, field) }}
            onFocus={() => { setQ(m2oVal(form[field])); setOpen(true) }}
            onBlur={() => setTimeout(() => setOpen(false), 200)} placeholder="Search..." />
          {open && (m2oResults[field] || []).length > 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-xl border border-border/60 bg-popover shadow-lg max-h-48 overflow-y-auto">
              {(m2oResults[field] || []).map((r: any) => (
                <button key={r.id} className="w-full px-3 py-2 text-left text-sm hover:bg-accent first:rounded-t-xl last:rounded-b-xl"
                  onMouseDown={() => { setField(field, [r.id, r.display_name]); setOpen(false); onSelect?.() }}>{r.display_name}</button>
              ))}
            </div>
          )}
        </div>
        {errorMsg && <p className="text-xs text-destructive mt-1">{errorMsg}</p>}
      </FormField>
    )
  }

  const TF = ({ field, label, type = 'text' }: { field: string; label: string; type?: string }) => {
    if (!editing) return <ReadonlyField label={label} value={form[field]} />
    return <FormField label={label}><Input type={type} value={form[field] || ''} onChange={e => setField(field, e.target.value)} className="rounded-xl h-9" /></FormField>
  }

  const tabs: FormTab[] = [
    {
      key: 'description', label: 'Description',
      content: editing
        ? <Textarea value={form.description || ''} onChange={e => setField('description', e.target.value)} rows={8} placeholder="Task description..." className="rounded-xl resize-y" />
        : form.description ? <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={sanitizedHtml(form.description)} /> : <p className="text-sm text-muted-foreground">No description</p>,
    },
    {
      key: 'subtasks', label: 'Sub-tasks',
      content: (
        <div className="space-y-2">
          {Array.isArray(form.child_ids) && form.child_ids.length > 0 ? (
            form.child_ids.map((child: any) => {
              const c = typeof child === 'object' ? child : { id: child }
              return (
                <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border/50 p-3 hover:bg-muted/20 cursor-pointer" onClick={() => navigate(`/admin/projects/tasks/${c.id}`)}>
                  <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm">{c.name || c.display_name || `Task #${c.id}`}</span>
                </div>
              )
            })
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No sub-tasks</p>
          )}
        </div>
      ),
    },
    {
      key: 'extra', label: 'Extra Info',
      content: (
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-2">
          <div className="space-y-2">
            <M2O field="partner_id" model="res.partner" label="Customer" />
            <M2O field="parent_id" model="project.task" label="Parent Task" />
            <M2O field="milestone_id" model="project.milestone" label="Milestone" />
          </div>
          <div className="space-y-2">
            <ReadonlyField label="Assigned" value={form.date_assign ? new Date(form.date_assign).toLocaleString() : ''} />
            <ReadonlyField label="Ended" value={form.date_end ? new Date(form.date_end).toLocaleString() : ''} />
          </div>
        </div>
      ),
    },
  ]

  return (
    <RecordForm
      editing={editing} onEdit={() => setEditing(true)} onSave={() => saveMut.mutate()}
      onDiscard={() => { if (isNew) navigate(-1); else { setForm({ ...record }); setEditing(false) } }}
      backTo="/projects/tasks"
      statusBar={stageSteps.length > 0 ? (
        <StatusBar steps={stageSteps} current={currentStage}
          onChange={editing ? key => {
            const stage = stages?.find((s: any) => String(s.id) === key)
            if (stage) setField('stage_id', [stage.id, stage.name])
          } : undefined} />
      ) : undefined}
      topContent={
        <div className="space-y-2 mb-2">
          {editing ? (
            <div>
              <Input value={form.name || ''} onChange={e => { setField('name', e.target.value); setErrors(er => { const n = { ...er }; delete n.name; return n }) }} placeholder="Task title"
                className={`text-xl font-bold border-0 border-b rounded-none px-0 h-auto py-1 focus-visible:ring-0 ${errors.name ? 'border-red-500 focus-visible:border-red-500' : 'border-border/40 focus-visible:border-primary'}`} />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
            </div>
          ) : (
            <h2 className="text-2xl font-bold tracking-tight">{form.name || 'New Task'}</h2>
          )}
          <div className="flex items-center gap-1">
            {[1,2,3].map(i => (
              <button key={i} onClick={() => editing && setField('priority', String(i === parseInt(form.priority) ? 0 : i))} className={cn(editing && 'cursor-pointer')}>
                <Star className={cn('h-4 w-4', i <= (parseInt(form.priority) || 0) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30')} />
              </button>
            ))}
          </div>
        </div>
      }
      leftFields={
        <>
          <M2O field="project_id" model="project.project" label="Project" required
            errorMsg={errors.project_id}
            onSelect={() => setErrors(er => { const n = { ...er }; delete n.project_id; return n })} />
          <TF field="date_deadline" label="Deadline" type="datetime-local" />
          {/* Assignees */}
          {!editing ? (
            <ReadonlyField label="Assignees" value={
              Array.isArray(form.user_ids) && form.user_ids.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {form.user_ids.map((u: any, i: number) => <Badge key={i} variant="secondary" className="rounded-full text-xs">{Array.isArray(u) ? u[1] : u?.display_name || u}</Badge>)}
                </div>
              ) : undefined
            } />
          ) : (
            <FormField label="Assignees">
              <div className="flex flex-wrap gap-1">
                {(form.user_ids || []).map((u: any, i: number) => (
                  <Badge key={i} variant="secondary" className="rounded-full text-xs gap-1">
                    {Array.isArray(u) ? u[1] : u?.display_name || u}
                    <button onClick={() => { const n = [...(form.user_ids || [])]; n.splice(i, 1); setField('user_ids', n) }}>&times;</button>
                  </Badge>
                ))}
              </div>
            </FormField>
          )}
        </>
      }
      rightFields={
        <>
          <M2O field="partner_id" model="res.partner" label="Customer" />
          {/* Tags */}
          {!editing ? (
            <ReadonlyField label="Tags" value={
              Array.isArray(form.tag_ids) && form.tag_ids.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {form.tag_ids.map((t: any, i: number) => <Badge key={i} variant="secondary" className="rounded-full text-xs">{Array.isArray(t) ? t[1] : t?.display_name || t}</Badge>)}
                </div>
              ) : undefined
            } />
          ) : (
            <FormField label="Tags">
              <div className="flex flex-wrap gap-1">
                {(form.tag_ids || []).map((t: any, i: number) => (
                  <Badge key={i} variant="secondary" className="rounded-full text-xs gap-1">
                    {Array.isArray(t) ? t[1] : t?.display_name || t}
                    <button onClick={() => { const n = [...(form.tag_ids || [])]; n.splice(i, 1); setField('tag_ids', n) }}>&times;</button>
                  </Badge>
                ))}
              </div>
            </FormField>
          )}
        </>
      }
      tabs={tabs}
      chatter={recordId ? <Chatter model="project.task" resId={recordId} /> : undefined}
    />
  )
}
