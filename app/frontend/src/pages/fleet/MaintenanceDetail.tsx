import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge, Button, Input, Label, Textarea, Skeleton,
  Card, CardContent,
} from '@mashora/design-system'
import { Wrench, Save, Pencil, Play, CheckCircle, Ban, X } from 'lucide-react'
import { PageHeader, M2OInput, toast } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MaintenanceForm {
  name: string
  request_date: string
  schedule_date: string
  equipment_id: number | null
  category_id: number | null
  user_id: number | null            // technician (res.users)
  description: string
  stage_id: number | null
}

interface MaintenanceStage {
  id: number
  name: string
  done: boolean
  sequence: number
}

const KANBAN_BADGE: Record<string, { variant: 'secondary' | 'destructive' | 'success'; label: string }> = {
  normal:  { variant: 'secondary',   label: 'In Progress' },
  blocked: { variant: 'destructive', label: 'Blocked' },
  done:    { variant: 'success',     label: 'Done' },
}

const TYPE_BADGE: Record<string, { variant: 'secondary' | 'info'; label: string }> = {
  corrective:  { variant: 'secondary', label: 'Corrective' },
  preventive:  { variant: 'info',      label: 'Preventive' },
}

const PRIORITY_LABEL: Record<string, string> = {
  '0': 'Normal',
  '1': 'Important',
  '2': 'Very Urgent',
  '3': 'Critical',
}

const m2oId = (v: unknown): number | null =>
  Array.isArray(v) ? ((v[0] as number) ?? null) : (typeof v === 'number' ? v : null)
const m2oTuple = (v: unknown): [number, string] | false =>
  Array.isArray(v) ? (v as [number, string]) : false

function fmtDate(dt: string | false | null | undefined): string {
  if (!dt) return '—'
  try {
    const [date] = String(dt).split(' ')
    const [y, m, d] = date.split('-')
    return `${d}/${m}/${y}`
  } catch {
    return String(dt)
  }
}

function fmtDuration(hours: number): string {
  if (!hours && hours !== 0) return '—'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m}m`
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// Date input helpers - "YYYY-MM-DD" for <input type="date">
function toDateInput(dt: string | null | undefined | false): string {
  if (!dt) return ''
  return String(dt).split(' ')[0]
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="text-sm font-medium">{value || '—'}</div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MaintenanceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const recordId = parseInt(id || '0')

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<MaintenanceForm>({
    name: '', request_date: '', schedule_date: '',
    equipment_id: null, category_id: null, user_id: null,
    description: '', stage_id: null,
  })
  const [equipment, setEquipment] = useState<[number, string] | false>(false)
  const [category, setCategory] = useState<[number, string] | false>(false)
  const [technician, setTechnician] = useState<[number, string] | false>(false)
  const [saving, setSaving] = useState(false)
  const [actioning, setActioning] = useState<string | null>(null)

  const { data: request, isLoading } = useQuery<Record<string, any> | undefined>({
    queryKey: ['maintenance-request', recordId],
    queryFn: () =>
      erpClient.raw
        .post('/model/maintenance.request', {
          domain: [['id', '=', recordId]],
          fields: ['id', 'name', 'request_date', 'close_date', 'stage_id', 'user_id', 'equipment_id', 'category_id', 'maintenance_type', 'priority', 'kanban_state', 'duration', 'description', 'schedule_date'],
          limit: 1,
        })
        .then(r => {
          const records: Array<Record<string, any>> = r.data?.records ?? []
          return records[0]
        }),
    enabled: !!recordId,
  })

  // Load maintenance stages once
  const { data: stages } = useQuery({
    queryKey: ['maintenance-stages'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/maintenance.stage', {
        fields: ['id', 'name', 'done', 'sequence'],
        order: 'sequence asc',
        limit: 50,
      })
      return (data?.records ?? []) as MaintenanceStage[]
    },
  })

  useEffect(() => {
    if (!request) return
    setForm({
      name: request.name || '',
      request_date: toDateInput(request.request_date),
      schedule_date: toDateInput(request.schedule_date),
      equipment_id: m2oId(request.equipment_id),
      category_id: m2oId(request.category_id),
      user_id: m2oId(request.user_id),
      description: typeof request.description === 'string' ? request.description : '',
      stage_id: m2oId(request.stage_id),
    })
    setEquipment(m2oTuple(request.equipment_id))
    setCategory(m2oTuple(request.category_id))
    setTechnician(m2oTuple(request.user_id))
  }, [request])

  function set<K extends keyof MaintenanceForm>(key: K, value: MaintenanceForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error('Name required')
      return
    }
    setSaving(true)
    try {
      const vals: Record<string, unknown> = {
        name: form.name,
        request_date: form.request_date || false,
        schedule_date: form.schedule_date || false,
        description: form.description || false,
      }
      if (form.equipment_id) vals.equipment_id = form.equipment_id
      if (form.category_id) vals.category_id = form.category_id
      if (form.user_id) vals.user_id = form.user_id

      await erpClient.raw.put(`/model/maintenance.request/${recordId}`, { vals })
      toast.success('Saved')
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['maintenance-request', recordId] })
    } catch (e: unknown) {
      toast.error('Save failed', extractErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  function findStageId(targetDone: boolean | null, mode: 'in_progress' | 'done'): number | null {
    if (!stages || stages.length === 0) return null
    if (mode === 'done') {
      const doneStage = stages.find(s => s.done)
      return doneStage?.id ?? null
    }
    // in_progress: pick the first non-done stage that isn't the current one (or just the first)
    const nonDone = stages.filter(s => !s.done)
    if (nonDone.length === 0) return null
    return nonDone[0].id
    void targetDone
  }

  async function setStage(mode: 'in_progress' | 'done') {
    const stageId = findStageId(null, mode)
    if (!stageId) {
      toast.error('No stage available', `Could not find a ${mode === 'done' ? 'done' : 'in-progress'} stage`)
      return
    }
    setActioning(mode)
    try {
      await erpClient.raw.put(`/model/maintenance.request/${recordId}`, {
        vals: {
          stage_id: stageId,
          ...(mode === 'in_progress' ? { kanban_state: 'normal' } : {}),
        },
      })
      toast.success(mode === 'done' ? 'Marked as done' : 'Set to in progress')
      queryClient.invalidateQueries({ queryKey: ['maintenance-request', recordId] })
    } catch (e: unknown) {
      toast.error('Action failed', extractErrorMessage(e))
    } finally {
      setActioning(null)
    }
  }

  async function toggleBlock() {
    setActioning('block')
    try {
      const newState = request?.kanban_state === 'blocked' ? 'normal' : 'blocked'
      await erpClient.raw.put(`/model/maintenance.request/${recordId}`, {
        vals: { kanban_state: newState },
      })
      toast.success(newState === 'blocked' ? 'Blocked' : 'Unblocked')
      queryClient.invalidateQueries({ queryKey: ['maintenance-request', recordId] })
    } catch (e: unknown) {
      toast.error('Action failed', extractErrorMessage(e))
    } finally {
      setActioning(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    )
  }

  if (!request) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <Wrench className="h-10 w-10" />
        <p>Maintenance request not found.</p>
        <Button variant="outline" className="rounded-xl" onClick={() => navigate('/admin/maintenance')}>
          Back to Maintenance
        </Button>
      </div>
    )
  }

  const kanbanCfg = KANBAN_BADGE[request.kanban_state] ?? { variant: 'secondary' as const, label: request.kanban_state }
  const typeCfg = TYPE_BADGE[request.maintenance_type] ?? { variant: 'secondary' as const, label: request.maintenance_type }
  const isBlocked = request.kanban_state === 'blocked'
  const isDone = request.kanban_state === 'done'

  return (
    <div className="space-y-6">
      <PageHeader
        title={request.name}
        subtitle="maintenance"
        backTo="/admin/maintenance"
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={kanbanCfg.variant}>{kanbanCfg.label}</Badge>
            {!editing ? (
              <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            ) : (
              <>
                <Button size="sm" className="rounded-xl gap-1.5" onClick={handleSave} disabled={saving}>
                  <Save className="h-3.5 w-3.5" /> {saving ? 'Saving...' : 'Save'}
                </Button>
                <Button size="sm" variant="ghost" className="rounded-xl gap-1.5" onClick={() => {
                  setEditing(false)
                  // Restore from request
                  if (request) {
                    setForm({
                      name: request.name || '',
                      request_date: toDateInput(request.request_date),
                      schedule_date: toDateInput(request.schedule_date),
                      equipment_id: m2oId(request.equipment_id),
                      category_id: m2oId(request.category_id),
                      user_id: m2oId(request.user_id),
                      description: typeof request.description === 'string' ? request.description : '',
                      stage_id: m2oId(request.stage_id),
                    })
                    setEquipment(m2oTuple(request.equipment_id))
                    setCategory(m2oTuple(request.category_id))
                    setTechnician(m2oTuple(request.user_id))
                  }
                }}>
                  <X className="h-3.5 w-3.5" /> Cancel
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* State action bar */}
      {!editing && (
        <div className="flex items-center gap-2 flex-wrap">
          {!isDone && (
            <Button size="sm" variant="outline" className="rounded-xl gap-1.5"
              onClick={() => setStage('in_progress')} disabled={actioning !== null}>
              <Play className="h-3.5 w-3.5" /> In Progress
            </Button>
          )}
          {!isDone && (
            <Button size="sm" variant="outline" className="rounded-xl gap-1.5"
              onClick={() => setStage('done')} disabled={actioning !== null}>
              <CheckCircle className="h-3.5 w-3.5" /> Mark Done
            </Button>
          )}
          <Button size="sm" variant={isBlocked ? 'default' : 'ghost'}
            className="rounded-xl gap-1.5"
            onClick={toggleBlock} disabled={actioning !== null}>
            <Ban className="h-3.5 w-3.5" /> {isBlocked ? 'Unblock' : 'Block'}
          </Button>
        </div>
      )}

      {/* Info / Edit card */}
      {editing ? (
        <Card className="rounded-2xl">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-sm font-semibold mb-1">Edit Maintenance Request</h2>

            <div className="space-y-2">
              <Label htmlFor="name">Subject</Label>
              <Input
                id="name"
                value={form.name}
                onChange={e => set('name', e.target.value)}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="request_date">Request Date</Label>
                <Input
                  id="request_date"
                  type="date"
                  value={form.request_date}
                  onChange={e => set('request_date', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule_date">Schedule Date</Label>
                <Input
                  id="schedule_date"
                  type="date"
                  value={form.schedule_date}
                  onChange={e => set('schedule_date', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Equipment</Label>
                <M2OInput
                  value={equipment}
                  model="maintenance.equipment"
                  onChange={v => { setEquipment(v); set('equipment_id', m2oId(v)) }}
                  placeholder="Choose equipment..."
                />
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <M2OInput
                  value={category}
                  model="maintenance.equipment.category"
                  onChange={v => { setCategory(v); set('category_id', m2oId(v)) }}
                  placeholder="Choose category..."
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Technician</Label>
                <M2OInput
                  value={technician}
                  model="res.users"
                  onChange={v => { setTechnician(v); set('user_id', m2oId(v)) }}
                  placeholder="Assign technician..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={5}
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Describe the issue..."
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <InfoRow label="Equipment" value={Array.isArray(request.equipment_id) ? request.equipment_id[1] : '—'} />
                <InfoRow label="Category" value={Array.isArray(request.category_id) ? request.category_id[1] : '—'} />
                <InfoRow label="Type" value={<Badge variant={typeCfg.variant}>{typeCfg.label}</Badge>} />
                <InfoRow label="Priority" value={PRIORITY_LABEL[request.priority] ?? request.priority} />
                <InfoRow label="Stage" value={Array.isArray(request.stage_id) ? request.stage_id[1] : '—'} />
                <InfoRow label="Assigned To" value={Array.isArray(request.user_id) ? request.user_id[1] : '—'} />
              </div>
              <div className="space-y-4">
                <InfoRow label="Request Date" value={fmtDate(request.request_date)} />
                <InfoRow label="Schedule Date" value={fmtDate(request.schedule_date)} />
                <InfoRow label="Close Date" value={fmtDate(request.close_date)} />
                <InfoRow label="Duration" value={fmtDuration(request.duration)} />
              </div>
            </div>
          </div>

          {request.description && (
            <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
              <h2 className="text-sm font-semibold mb-3">Description</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{request.description}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
