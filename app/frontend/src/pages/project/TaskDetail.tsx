import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input, Textarea, Button, Badge, Skeleton, cn } from '@mashora/design-system'
import { Star, FolderKanban } from 'lucide-react'
import { RecordForm, FormField, ReadonlyField, StatusBar, AttachmentSection, RecurrenceField, type RecurrenceValue, toast, type FormTab } from '@/components/shared'
import Chatter from '@/components/Chatter'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'
import { sanitizedHtml } from '@/lib/sanitize'

type M2O = [number, string] | false | null | undefined

interface TaskStage { id: number; name: string; sequence?: number; fold?: boolean }
interface NameSearchResult { id: number; display_name: string }
/** Tag / user row as exposed by the API — tuple, full object, or bare id. */
type RefValue = [number, string] | { id: number; name?: string; display_name?: string } | number

interface TaskRecord {
  id?: number | null
  name?: string
  project_id?: M2O
  user_ids?: RefValue[]
  stage_id?: M2O
  priority?: string
  state?: string
  date_deadline?: string | false
  date_assign?: string | false
  date_end?: string | false
  tag_ids?: RefValue[]
  description?: string | false
  partner_id?: M2O
  parent_id?: M2O
  child_ids?: RefValue[]
  milestone_id?: M2O
  sequence?: number
  color?: number
  recurring_task?: boolean
  recurrence_id?: string | RecurrenceValue | null
  [key: string]: unknown
}

const FORM_FIELDS = [
  'id', 'name', 'project_id', 'user_ids', 'stage_id', 'priority', 'state',
  'date_deadline', 'date_assign', 'date_end', 'tag_ids', 'description',
  'partner_id', 'parent_id', 'child_ids', 'milestone_id', 'sequence', 'color',
  'recurring_task', 'recurrence_id',
]

const DEFAULT_RECURRENCE: RecurrenceValue = {
  enabled: false,
  rule_type: 'weekly',
  interval: 1,
  end_type: 'forever',
  weekdays: [],
  monthly_type: 'date',
  day: 1,
}

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id || id === 'new'
  const recordId = isNew ? null : parseInt(id || '0')
  const [editing, setEditing] = useState(isNew)
  const [form, setForm] = useState<TaskRecord>({})

  const { data: stages } = useQuery<TaskStage[]>({
    queryKey: ['task-stages'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/project.task.type', {
        fields: ['id', 'name', 'sequence', 'fold'], order: 'sequence asc', limit: 20,
      })
      return (data.records || []) as TaskStage[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: record, isLoading } = useQuery<TaskRecord>({
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

  // Local recurrence state — serialized to recurrence_id JSON placeholder on save.
  const [recurrence, setRecurrence] = useState<RecurrenceValue>(DEFAULT_RECURRENCE)

  useEffect(() => {
    if (record) {
      setForm({ ...record })
      // Hydrate recurrence from `recurrence_id` (treated as opaque JSON blob)
      // or from the boolean `recurring_task` flag.
      const stored = record?.recurrence_id
      let parsed: RecurrenceValue | null = null
      if (stored && typeof stored === 'string') {
        try { parsed = JSON.parse(stored) } catch { /* ignore */ }
      } else if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
        parsed = stored as RecurrenceValue
      }
      setRecurrence({
        ...DEFAULT_RECURRENCE,
        ...(parsed || {}),
        enabled: !!record?.recurring_task || !!parsed?.enabled,
      })
    }
  }, [record])

  const setField = useCallback((n: string, v: unknown) => { setForm(p => ({ ...p, [n]: v })) }, [])

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
      const vals: Record<string, unknown> = {}
      for (const f of ['name', 'description', 'priority', 'date_deadline', 'sequence']) {
        if (form[f] !== record?.[f]) vals[f] = form[f] ?? false
      }
      for (const f of ['project_id', 'stage_id', 'partner_id', 'parent_id', 'milestone_id']) {
        const fv = form[f]
        const rv = record?.[f]
        const nv = Array.isArray(fv) ? fv[0] : fv
        const ov = Array.isArray(rv) ? rv[0] : rv
        if (nv !== ov) vals[f] = nv || false
      }
      if (JSON.stringify(form.user_ids) !== JSON.stringify(record?.user_ids)) {
        const ids = (form.user_ids || []).map((u: RefValue) =>
          Array.isArray(u) ? u[0] : typeof u === 'object' ? u.id : u,
        )
        vals.user_ids = [[6, 0, ids]]
      }
      if (JSON.stringify(form.tag_ids) !== JSON.stringify(record?.tag_ids)) {
        const ids = (form.tag_ids || []).map((t: RefValue) =>
          Array.isArray(t) ? t[0] : typeof t === 'object' ? t.id : t,
        )
        vals.tag_ids = [[6, 0, ids]]
      }
      // Recurrence: write the boolean flag plus a JSON blob in `recurrence_id`
      // as a forward-compatible placeholder (the actual `calendar.recurrence`
      // wiring lives server-side).
      const recurrenceChanged = JSON.stringify(recurrence) !== JSON.stringify({
        ...DEFAULT_RECURRENCE,
        ...((typeof record?.recurrence_id === 'string'
          ? (() => { try { return JSON.parse(record.recurrence_id) } catch { return {} } })()
          : record?.recurrence_id) || {}),
        enabled: !!record?.recurring_task,
      })
      if (recurrenceChanged) {
        vals.recurring_task = recurrence.enabled
        vals.recurrence_id = recurrence.enabled ? JSON.stringify(recurrence) : false
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
    onError: (e: unknown) => {
      const msg = extractErrorMessage(e)
      if (msg !== 'Validation failed') {
        toast.error('Save Failed', msg)
      }
    },
  })

  const [m2oResults, setM2oResults] = useState<Record<string, NameSearchResult[]>>({})
  const searchM2o = useCallback(async (model: string, q: string, field: string) => {
    if (!q) { setM2oResults(p => ({ ...p, [field]: [] })); return }
    try {
      const { data } = await erpClient.raw.post(`/model/${model}/name_search`, { name: q, limit: 8 })
      setM2oResults(p => ({ ...p, [field]: (data.results || []) as NameSearchResult[] }))
    } catch { setM2oResults(p => ({ ...p, [field]: [] })) }
  }, [])

  if (isLoading || !record) {
    return <div className="space-y-4"><Skeleton className="h-10 w-full rounded-xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>
  }

  const m2oVal = (v: unknown): string => Array.isArray(v) ? String(v[1] ?? '') : ''
  const currentStage = Array.isArray(form.stage_id) ? String(form.stage_id[0]) : String(form.stage_id || '')
  const stageSteps = (stages || []).filter(s => !s.fold).map(s => ({ key: String(s.id), label: s.name }))

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
              {(m2oResults[field] || []).map(r => (
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
    if (!editing) {
      const val = form[field]
      return <ReadonlyField label={label} value={typeof val === 'string' || typeof val === 'number' ? val : ''} />
    }
    const v = form[field]
    const inputVal = typeof v === 'string' || typeof v === 'number' ? String(v) : ''
    return <FormField label={label}><Input type={type} value={inputVal} onChange={e => setField(field, e.target.value)} className="rounded-xl h-9" /></FormField>
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
            form.child_ids.map((child: RefValue) => {
              const c = (typeof child === 'object' && !Array.isArray(child))
                ? child
                : Array.isArray(child)
                  ? { id: child[0], name: child[1] }
                  : { id: child as number }
              return (
                <button
                  type="button"
                  key={c.id}
                  className="w-full flex items-center gap-3 rounded-xl border border-border/50 p-3 text-left hover:bg-muted/20 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => navigate(`/admin/projects/tasks/${c.id}`)}
                >
                  <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm">{c.name || c.display_name || `Task #${c.id}`}</span>
                </button>
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
    {
      key: 'recurrence', label: 'Recurrence',
      content: editing ? (
        <RecurrenceField value={recurrence} onChange={setRecurrence} />
      ) : (
        <ReadonlyField
          label="Recurrence"
          value={recurrence.enabled
            ? `Every ${recurrence.interval || 1} ${recurrence.rule_type || 'week'}(s)`
            : 'Not recurring'}
        />
      ),
    },
    {
      key: 'attachments', label: 'Attachments',
      content: <AttachmentSection resModel="project.task" resId={recordId} />,
    },
  ]

  return (
    <RecordForm
      editing={editing} onEdit={() => setEditing(true)} onSave={() => saveMut.mutate()}
      onDiscard={() => { if (isNew) navigate(-1); else { setForm({ ...record }); setEditing(false) } }}
      backTo="/admin/projects/tasks"
      statusBar={stageSteps.length > 0 ? (
        <StatusBar steps={stageSteps} current={currentStage}
          onChange={editing ? key => {
            const stage = stages?.find(s => String(s.id) === key)
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
              <button key={i} onClick={() => editing && setField('priority', String(i === parseInt(form.priority || '0') ? 0 : i))} className={cn(editing && 'cursor-pointer')}>
                <Star className={cn('h-4 w-4', i <= (parseInt(form.priority || '0') || 0) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30')} />
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
                  {form.user_ids.map((u: RefValue, i: number) => {
                    const key = Array.isArray(u) ? u[0] : typeof u === 'object' ? u.id : i
                    const label = Array.isArray(u) ? u[1] : typeof u === 'object' ? (u.display_name || u.name || '') : String(u)
                    return <Badge key={key} variant="secondary" className="rounded-full text-xs">{label}</Badge>
                  })}
                </div>
              ) : undefined
            } />
          ) : (
            <FormField label="Assignees">
              <div className="flex flex-wrap gap-1">
                {(form.user_ids || []).map((u: RefValue, i: number) => {
                  const key = Array.isArray(u) ? u[0] : typeof u === 'object' ? u.id : i
                  const label = Array.isArray(u) ? u[1] : typeof u === 'object' ? (u.display_name || u.name || '') : String(u)
                  return (
                    <Badge key={key} variant="secondary" className="rounded-full text-xs gap-1">
                      {label}
                      <button onClick={() => { const n = [...(form.user_ids || [])]; n.splice(i, 1); setField('user_ids', n) }}>&times;</button>
                    </Badge>
                  )
                })}
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
                  {form.tag_ids.map((t: RefValue, i: number) => {
                    const key = Array.isArray(t) ? t[0] : typeof t === 'object' ? t.id : i
                    const label = Array.isArray(t) ? t[1] : typeof t === 'object' ? (t.display_name || t.name || '') : String(t)
                    return <Badge key={key} variant="secondary" className="rounded-full text-xs">{label}</Badge>
                  })}
                </div>
              ) : undefined
            } />
          ) : (
            <FormField label="Tags">
              <div className="flex flex-wrap gap-1">
                {(form.tag_ids || []).map((t: RefValue, i: number) => {
                  const key = Array.isArray(t) ? t[0] : typeof t === 'object' ? t.id : i
                  const label = Array.isArray(t) ? t[1] : typeof t === 'object' ? (t.display_name || t.name || '') : String(t)
                  return (
                    <Badge key={key} variant="secondary" className="rounded-full text-xs gap-1">
                      {label}
                      <button onClick={() => { const n = [...(form.tag_ids || [])]; n.splice(i, 1); setField('tag_ids', n) }}>&times;</button>
                    </Badge>
                  )
                })}
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
