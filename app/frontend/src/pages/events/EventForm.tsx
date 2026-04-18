import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge, Button, Input, Label, Textarea, Skeleton,
  Card, CardContent,
} from '@mashora/design-system'
import { CalendarDays, Save, CheckCircle, XCircle } from 'lucide-react'
import { PageHeader, M2OInput, toast } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

type M2OTuple = [number, string]

// ─── Types ──────────────────────────────────────────────────────────────────

interface EventForm {
  name: string
  date_begin: string
  date_end: string
  address_id: number | null
  event_type_id: number | null
  organizer_id: number | null
  seats_max: number
  badge_back: string
  description: string
  website_published: boolean
}

const EMPTY: EventForm = {
  name: '',
  date_begin: '',
  date_end: '',
  address_id: null,
  event_type_id: null,
  organizer_id: null,
  seats_max: 0,
  badge_back: '',
  description: '',
  website_published: false,
}

const STATE_BADGE: Record<string, { variant: 'secondary' | 'success' | 'default' | 'destructive'; label: string }> = {
  draft:   { variant: 'secondary',    label: 'Draft' },
  confirm: { variant: 'success',      label: 'Confirmed' },
  done:    { variant: 'default',      label: 'Done' },
  cancel:  { variant: 'destructive',  label: 'Cancelled' },
}

// Convert ISO datetime string → "YYYY-MM-DDTHH:mm" for <input type="datetime-local">
function toLocalInput(dt: string | null | undefined): string {
  if (!dt) return ''
  // Accept "YYYY-MM-DD HH:mm:ss" or ISO
  const s = String(dt).replace(' ', 'T')
  return s.slice(0, 16)
}

// Convert datetime-local input back to "YYYY-MM-DD HH:mm:ss" for the backend
function fromLocalInput(v: string): string {
  if (!v) return ''
  return v.replace('T', ' ') + (v.length === 16 ? ':00' : '')
}

const m2oId = (v: unknown): number | null =>
  Array.isArray(v) ? Number(v[0]) : (typeof v === 'number' ? v : null)
const m2oTuple = (v: unknown): M2OTuple | false =>
  Array.isArray(v) && typeof v[0] === 'number' && typeof v[1] === 'string' ? [v[0], v[1]] : false

// ─── Page ───────────────────────────────────────────────────────────────────

export default function EventForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id || id === 'new'
  const recordId = isNew ? null : Number(id)

  const [form, setForm] = useState<EventForm>(EMPTY)
  // Hold M2O tuples for display (id+label)
  const [organizer, setOrganizer] = useState<M2OTuple | false>(false)
  const [address, setAddress] = useState<M2OTuple | false>(false)
  const [eventType, setEventType] = useState<M2OTuple | false>(false)
  const [state, setState] = useState<string>('draft')
  const [saving, setSaving] = useState(false)
  const [actioning, setActioning] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['event-form', recordId],
    queryFn: () => erpClient.raw.get(`/events/${recordId}`).then(r => r.data),
    enabled: !!recordId,
  })

  useEffect(() => {
    if (!data) return
    setForm({
      name: data.name || '',
      date_begin: toLocalInput(data.date_begin),
      date_end: toLocalInput(data.date_end),
      address_id: m2oId(data.address_id),
      event_type_id: m2oId(data.event_type_id),
      organizer_id: m2oId(data.organizer_id),
      seats_max: Number(data.seats_max) || 0,
      badge_back: typeof data.badge_back === 'string' ? data.badge_back : '',
      description: typeof data.description === 'string' ? data.description : '',
      website_published: !!data.website_published,
    })
    setOrganizer(m2oTuple(data.organizer_id))
    setAddress(m2oTuple(data.address_id))
    setEventType(m2oTuple(data.event_type_id))
    setState(data.state || 'draft')
  }, [data])

  function set<K extends keyof EventForm>(key: K, value: EventForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error('Name required', 'Please enter an event name')
      return
    }
    if (!form.date_begin || !form.date_end) {
      toast.error('Dates required', 'Start and end dates are required')
      return
    }
    setSaving(true)
    try {
      const vals: Record<string, unknown> = {
        name: form.name,
        date_begin: fromLocalInput(form.date_begin),
        date_end: fromLocalInput(form.date_end),
        seats_max: form.seats_max,
        badge_back: form.badge_back || false,
        description: form.description || false,
        website_published: form.website_published,
      }
      if (form.organizer_id) vals.organizer_id = form.organizer_id
      if (form.address_id) vals.address_id = form.address_id
      if (form.event_type_id) vals.event_type_id = form.event_type_id

      if (isNew) {
        const { data: created } = await erpClient.raw.post('/events/create', vals)
        toast.success('Event created')
        const newId: number | undefined = created?.id || created?.record?.id
        if (newId) navigate(`/admin/events/${newId}/edit`, { replace: true })
        else navigate('/admin/events', { replace: true })
      } else {
        await erpClient.raw.put(`/model/event.event/${recordId}`, { vals })
        toast.success('Event saved')
        queryClient.invalidateQueries({ queryKey: ['event-form', recordId] })
        queryClient.invalidateQueries({ queryKey: ['events-list'] })
      }
    } catch (e: unknown) {
      toast.error('Save failed', extractErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function runAction(action: 'confirm' | 'cancel') {
    if (!recordId) return
    setActioning(action)
    try {
      await erpClient.raw.post(`/events/${recordId}/${action}`)
      toast.success(action === 'confirm' ? 'Event confirmed' : 'Event cancelled')
      queryClient.invalidateQueries({ queryKey: ['event-form', recordId] })
      queryClient.invalidateQueries({ queryKey: ['events-list'] })
    } catch (e: unknown) {
      toast.error('Action failed', extractErrorMessage(e))
    } finally {
      setActioning(null)
    }
  }

  if (!isNew && isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!isNew && !data && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <CalendarDays className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium">Event not found.</p>
        <Button variant="outline" className="rounded-xl" onClick={() => navigate('/admin/events')}>
          Back to Events
        </Button>
      </div>
    )
  }

  const stateCfg = STATE_BADGE[state] ?? { variant: 'secondary' as const, label: state }
  const isDraft = state === 'draft'
  const isCancelled = state === 'cancel'

  return (
    <div className="space-y-6">
      <PageHeader
        title={isNew ? 'New Event' : form.name || 'Event'}
        subtitle="events"
        backTo="/admin/events"
        actions={!isNew ? <Badge variant={stateCfg.variant}>{stateCfg.label}</Badge> : undefined}
      />

      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={handleSave} disabled={saving} className="rounded-xl gap-1.5">
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
        {!isNew && isDraft && (
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl gap-1.5"
            onClick={() => runAction('confirm')}
            disabled={actioning !== null}
          >
            <CheckCircle className="h-3.5 w-3.5" /> Confirm
          </Button>
        )}
        {!isNew && !isCancelled && (
          <Button
            size="sm"
            variant="ghost"
            className="rounded-xl gap-1.5 text-destructive hover:text-destructive"
            onClick={() => {
              if (confirm('Cancel this event?')) runAction('cancel')
            }}
            disabled={actioning !== null}
          >
            <XCircle className="h-3.5 w-3.5" /> Cancel
          </Button>
        )}
      </div>

      {/* 2-column form: basic info + content */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic info card */}
        <Card className="rounded-2xl">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-sm font-semibold mb-1">Basic Information</h2>

            <div className="space-y-2">
              <Label htmlFor="name">Event Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Annual Conference 2026"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date_begin">Start Date</Label>
                <Input
                  id="date_begin"
                  type="datetime-local"
                  value={form.date_begin}
                  onChange={e => set('date_begin', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_end">End Date</Label>
                <Input
                  id="date_end"
                  type="datetime-local"
                  value={form.date_end}
                  onChange={e => set('date_end', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Organizer</Label>
              <M2OInput
                value={organizer}
                model="res.partner"
                onChange={v => {
                  setOrganizer(v)
                  set('organizer_id', m2oId(v))
                }}
                placeholder="Choose organizer..."
              />
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <M2OInput
                value={address}
                model="res.partner"
                onChange={v => {
                  setAddress(v)
                  set('address_id', m2oId(v))
                }}
                placeholder="Choose location..."
              />
            </div>

            <div className="space-y-2">
              <Label>Event Type</Label>
              <M2OInput
                value={eventType}
                model="event.type"
                onChange={v => {
                  setEventType(v)
                  set('event_type_id', m2oId(v))
                }}
                placeholder="Choose type..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seats_max">Seats Max</Label>
              <Input
                id="seats_max"
                type="number"
                min="0"
                value={form.seats_max}
                onChange={e => set('seats_max', parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">Use 0 for unlimited.</p>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.website_published}
                onChange={e => set('website_published', e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Published on website
            </label>
          </CardContent>
        </Card>

        {/* Content card */}
        <Card className="rounded-2xl">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-sm font-semibold mb-1">Content</h2>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={10}
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Describe the event..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="badge_back">Badge Back</Label>
              <Textarea
                id="badge_back"
                rows={4}
                value={form.badge_back}
                onChange={e => set('badge_back', e.target.value)}
                placeholder="Text printed on the back of attendee badges..."
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
