import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input, Textarea, Badge, Button, Skeleton, cn } from '@mashora/design-system'
import { Star, Trophy, XCircle, FileText, ShoppingCart } from 'lucide-react'
import { RecordForm, FormField, FormSection, ReadonlyField, StatusBar, stepsFromSelection, toast, type SmartButton, type FormTab } from '@/components/shared'
import Chatter from '@/components/Chatter'
import { erpClient } from '@/lib/erp-api'
import { sanitizedHtml } from '@/lib/sanitize'

const FORM_FIELDS = [
  'id', 'name', 'partner_id', 'partner_name', 'contact_name', 'email_from', 'phone', 'mobile',
  'stage_id', 'user_id', 'team_id', 'company_id', 'expected_revenue', 'probability',
  'priority', 'type', 'date_deadline', 'date_open', 'date_closed',
  'street', 'street2', 'city', 'state_id', 'zip', 'country_id',
  'description', 'tag_ids', 'won_status',
  'campaign_id', 'medium_id', 'source_id', 'referred',
  'sale_order_count', 'quotation_count',
  'active', 'lost_reason_id',
]

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = id === 'new'
  const recordId = isNew ? null : parseInt(id || '0')
  const [editing, setEditing] = useState(isNew)
  const [form, setForm] = useState<Record<string, any>>({})
  const [dirty, setDirty] = useState(false)

  // Load stages for status bar
  const { data: stages } = useQuery({
    queryKey: ['crm-stages'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/crm.stage', {
        fields: ['id', 'name', 'sequence', 'is_won'], order: 'sequence asc', limit: 20,
      })
      return data.records || []
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: record, isLoading } = useQuery({
    queryKey: ['crm-lead', recordId],
    queryFn: async () => {
      if (isNew) {
        const { data } = await erpClient.raw.post('/model/crm.lead/defaults', { fields: FORM_FIELDS })
        return { ...data, id: null, type: 'opportunity', priority: '1' }
      }
      const { data } = await erpClient.raw.get(`/model/crm.lead/${recordId}`)
      return data
    },
  })

  useEffect(() => { if (record) { setForm({ ...record }); setDirty(false) } }, [record])

  const setField = useCallback((n: string, v: any) => { setForm(p => ({ ...p, [n]: v })); setDirty(true) }, [])

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
      const simple = ['name', 'partner_name', 'contact_name', 'email_from', 'phone', 'mobile',
        'expected_revenue', 'probability', 'priority', 'type', 'date_deadline',
        'street', 'street2', 'city', 'zip', 'description', 'referred']
      for (const f of simple) if (form[f] !== record?.[f]) vals[f] = form[f] ?? false
      for (const f of ['partner_id', 'stage_id', 'user_id', 'team_id', 'state_id', 'country_id', 'campaign_id', 'medium_id', 'source_id', 'lost_reason_id']) {
        const nv = Array.isArray(form[f]) ? form[f][0] : form[f]
        const ov = Array.isArray(record?.[f]) ? record[f][0] : record?.[f]
        if (nv !== ov) vals[f] = nv || false
      }
      if (JSON.stringify(form.tag_ids) !== JSON.stringify(record?.tag_ids)) {
        const ids = (form.tag_ids || []).map((t: any) => Array.isArray(t) ? t[0] : typeof t === 'object' ? t.id : t)
        vals.tag_ids = [[6, 0, ids]]
      }
      if (isNew) {
        const { data } = await erpClient.raw.post('/model/crm.lead/create', { vals: { ...form, ...vals } })
        return data
      }
      const { data } = await erpClient.raw.put(`/model/crm.lead/${recordId}`, { vals })
      return data
    },
    onSuccess: (data) => {
      setDirty(false); setEditing(false)
      setErrors({})
      toast.success('Saved', 'Lead saved successfully')
      queryClient.invalidateQueries({ queryKey: ['crm-lead'] })
      queryClient.invalidateQueries({ queryKey: ['crm-pipeline'] })
      if (isNew && data?.id) navigate(`/admin/crm/leads/${data.id}`, { replace: true })
    },
    onError: (e: any) => {
      if (e.message !== 'Validation failed') {
        toast.error('Save Failed', e?.response?.data?.detail || e.message || 'Unknown error')
      }
    },
  })

  // Won / Lost actions
  const wonMut = useMutation({
    mutationFn: () => erpClient.raw.post(`/crm/leads/${recordId}/won`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crm-lead', recordId] }),
  })
  const lostMut = useMutation({
    mutationFn: () => erpClient.raw.post(`/crm/leads/${recordId}/lost`, { lost_reason_id: 1 }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crm-lead', recordId] }),
  })

  // M2O search
  const [m2oResults, setM2oResults] = useState<Record<string, any[]>>({})
  const searchM2o = useCallback(async (model: string, query: string, field: string) => {
    if (!query) { setM2oResults(p => ({ ...p, [field]: [] })); return }
    try {
      const { data } = await erpClient.raw.post(`/model/${model}/name_search`, { name: query, limit: 8 })
      setM2oResults(p => ({ ...p, [field]: data.results || [] }))
    } catch { setM2oResults(p => ({ ...p, [field]: [] })) }
  }, [])

  if (isLoading || !record) {
    return <div className="space-y-4"><Skeleton className="h-10 w-full rounded-xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>
  }

  const m2oVal = (v: any) => Array.isArray(v) ? v[1] : ''
  const stageSteps = (stages || []).map((s: any) => ({ key: String(s.id), label: s.name, color: s.is_won ? 'success' as const : undefined }))
  const currentStage = Array.isArray(form.stage_id) ? String(form.stage_id[0]) : String(form.stage_id || '')
  const isWon = form.won_status === 'won'
  const isLost = form.won_status === 'lost' || !form.active

  const smartButtons: SmartButton[] = [
    form.quotation_count > 0 && { label: 'Quotations', value: form.quotation_count, icon: <FileText className="h-5 w-5" /> },
    form.sale_order_count > 0 && { label: 'Orders', value: form.sale_order_count, icon: <ShoppingCart className="h-5 w-5" /> },
  ].filter(Boolean) as SmartButton[]

  // M2O field helper
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

  const TF = ({ field, label, required, type = 'text' }: { field: string; label: string; required?: boolean; type?: string }) => {
    if (!editing) return <ReadonlyField label={label} value={form[field]} />
    return <FormField label={label} required={required}><Input type={type} value={form[field] || ''} onChange={e => setField(field, e.target.value)} className="rounded-xl h-9" /></FormField>
  }

  const tabs: FormTab[] = [
    {
      key: 'notes', label: 'Internal Notes',
      content: editing
        ? <Textarea value={form.description || ''} onChange={e => setField('description', e.target.value)} rows={6} placeholder="Internal notes..." className="rounded-xl resize-y" />
        : form.description ? <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={sanitizedHtml(form.description)} /> : <p className="text-sm text-muted-foreground">No notes</p>,
    },
    {
      key: 'extra', label: 'Extra Info',
      content: (
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-2">
          <div className="space-y-2">
            <FormSection title="Marketing">
              <M2O field="campaign_id" model="utm.campaign" label="Campaign" />
              <M2O field="medium_id" model="utm.medium" label="Medium" />
              <M2O field="source_id" model="utm.source" label="Source" />
              <TF field="referred" label="Referred By" />
            </FormSection>
          </div>
          <div className="space-y-2">
            <FormSection title="Assignment">
              <M2O field="user_id" model="res.users" label="Salesperson" />
              <M2O field="team_id" model="crm.team" label="Sales Team" />
            </FormSection>
          </div>
        </div>
      ),
    },
  ]

  return (
    <RecordForm
      editing={editing} onEdit={() => setEditing(true)} onSave={() => saveMut.mutate()}
      onDiscard={() => { if (isNew) navigate(-1); else { setForm({ ...record }); setDirty(false); setEditing(false) } }}
      backTo="/crm/pipeline"
      statusBar={stageSteps.length > 0 ? (
        <StatusBar steps={stageSteps} current={currentStage}
          onChange={editing ? (key) => {
            const stage = stages?.find((s: any) => String(s.id) === key)
            if (stage) setField('stage_id', [stage.id, stage.name])
          } : undefined} />
      ) : undefined}
      headerActions={
        !isNew && !isLost && !isWon ? (
          <>
            <Button variant="default" size="sm" className="rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => wonMut.mutate()}><Trophy className="h-3.5 w-3.5" /> Won</Button>
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5 text-red-400 border-red-400/30 hover:bg-red-500/10"
              onClick={() => lostMut.mutate()}><XCircle className="h-3.5 w-3.5" /> Lost</Button>
          </>
        ) : isWon ? (
          <Badge variant="default" className="bg-emerald-600 text-white rounded-full px-3">Won</Badge>
        ) : isLost ? (
          <Badge variant="destructive" className="rounded-full px-3">Lost</Badge>
        ) : undefined
      }
      smartButtons={smartButtons}
      topContent={
        <div className="space-y-2 mb-2">
          {editing ? (
            <div>
              <Input value={form.name || ''} onChange={e => { setField('name', e.target.value); setErrors(er => { const n = { ...er }; delete n.name; return n }) }} placeholder="Opportunity name"
                className={`text-xl font-bold border-0 border-b rounded-none px-0 h-auto py-1 focus-visible:ring-0 ${errors.name ? 'border-red-500 focus-visible:border-red-500' : 'border-border/40 focus-visible:border-primary'}`} />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
            </div>
          ) : (
            <h2 className="text-2xl font-bold tracking-tight">{form.name || 'New Opportunity'}</h2>
          )}
          {/* Priority stars */}
          <div className="flex items-center gap-1">
            {[1,2,3].map(i => (
              <button key={i} onClick={() => editing && setField('priority', String(i === parseInt(form.priority) ? 0 : i))}
                className={cn(editing && 'cursor-pointer')}>
                <Star className={cn('h-4 w-4', i <= (parseInt(form.priority) || 0) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30')} />
              </button>
            ))}
          </div>
        </div>
      }
      leftFields={
        <>
          <TF field="expected_revenue" label="Expected Revenue" type="number" />
          <TF field="probability" label="Probability (%)" type="number" />
          <M2O field="partner_id" model="res.partner" label="Contact" />
          <TF field="partner_name" label="Company Name" />
          <TF field="contact_name" label="Contact Name" />
          <TF field="email_from" label="Email" type="email" />
          <TF field="phone" label="Phone" type="tel" />
        </>
      }
      rightFields={
        <>
          <M2O field="user_id" model="res.users" label="Salesperson" />
          <M2O field="team_id" model="crm.team" label="Sales Team" />
          <TF field="date_deadline" label="Expected Closing" type="date" />
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
      chatter={recordId ? <Chatter model="crm.lead" resId={recordId} /> : undefined}
    />
  )
}
