import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input, Button, Skeleton, cn } from '@mashora/design-system'
import { Calendar, Plus, Clock, MapPin, Users, ChevronLeft, ChevronRight, Check, X } from 'lucide-react'
import { PageHeader, RecurrenceField, type RecurrenceValue, toast } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

interface CalendarEvent {
  id: number
  name: string
  start: string
  stop?: string
  allday?: boolean
  duration?: number
  location?: string | false
  partner_ids?: [number, string][] | number[]
  user_id?: [number, string] | false
  privacy?: string
  show_as?: string
  categ_ids?: number[] | [number, string][]
  description?: string | false
  [key: string]: unknown
}

const EVENT_FIELDS = [
  'id', 'name', 'start', 'stop', 'allday', 'duration',
  'location', 'partner_ids', 'user_id', 'privacy', 'show_as',
  'categ_ids', 'description',
]

const COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-pink-500', 'bg-cyan-500', 'bg-red-500']

type CalendarView = 'month' | 'week' | 'day' | 'agenda'

const HOUR_HEIGHT = 48 // px per hour for week/day views
const DAY_START = 0   // show full 24h timeline
const DAY_END = 24

function getMonthDays(year: number, month: number) {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startDay = first.getDay()
  const days: { date: Date; inMonth: boolean }[] = []
  // Pad start
  for (let i = startDay - 1; i >= 0; i--) {
    const d = new Date(year, month, -i)
    days.push({ date: d, inMonth: false })
  }
  // Month days
  for (let i = 1; i <= last.getDate(); i++) {
    days.push({ date: new Date(year, month, i), inMonth: true })
  }
  // Pad end
  while (days.length % 7 !== 0) {
    const d = new Date(year, month + 1, days.length - startDay - last.getDate() + 1)
    days.push({ date: d, inMonth: false })
  }
  return days
}

function fmt(d: Date) { return d.toISOString().split('T')[0] }
function fmtTime(s: string | undefined | null) {
  if (!s) return ''
  try { return new Date(s).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}

// Parse ERP date strings — they may be "YYYY-MM-DD HH:MM:SS" or ISO. Treat as UTC if naive.
function parseEventDate(s: string): Date {
  if (!s) return new Date(NaN)
  if (s.includes('T')) return new Date(s)
  // naive "YYYY-MM-DD HH:MM:SS" — treat as UTC for consistency with ERP storage
  return new Date(s.replace(' ', 'T') + 'Z')
}

// Get the Monday of the week containing date.
function startOfWeek(d: Date): Date {
  const out = new Date(d)
  const day = out.getDay() // 0=Sun..6=Sat
  const diff = (day + 6) % 7 // shift Mon=0..Sun=6
  out.setDate(out.getDate() - diff)
  out.setHours(0, 0, 0, 0)
  return out
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

export default function CalendarPage() {
  const queryClient = useQueryClient()
  const [view, setView] = useState<CalendarView>('month')
  // Anchor date drives nav for week / day / agenda; year+month drive month view.
  const [anchor, setAnchor] = useState<Date>(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRecurrence, setNewRecurrence] = useState<RecurrenceValue>({
    enabled: false,
    rule_type: 'weekly',
    interval: 1,
    end_type: 'forever',
    weekdays: [],
    monthly_type: 'date',
    day: 1,
  })

  // Compute the visible range for the current view to drive the query.
  const range = useMemo(() => {
    if (view === 'month') {
      return {
        start: new Date(year, month, 1),
        end: new Date(year, month + 1, 0, 23, 59, 59),
      }
    }
    if (view === 'week') {
      const s = startOfWeek(anchor)
      return { start: s, end: new Date(addDays(s, 6).setHours(23, 59, 59, 999)) }
    }
    if (view === 'day') {
      const s = new Date(anchor); s.setHours(0, 0, 0, 0)
      const e = new Date(anchor); e.setHours(23, 59, 59, 999)
      return { start: s, end: e }
    }
    // agenda — show 30 days from anchor
    const s = new Date(anchor); s.setHours(0, 0, 0, 0)
    return { start: s, end: new Date(addDays(s, 29).setHours(23, 59, 59, 999)) }
  }, [view, anchor, year, month])

  const days = getMonthDays(year, month)
  const today = fmt(new Date())

  const { data, isLoading } = useQuery({
    queryKey: ['calendar-events', view, range.start.toISOString(), range.end.toISOString()],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/calendar.event', {
        domain: [['start', '>=', range.start.toISOString()], ['start', '<=', range.end.toISOString()]],
        fields: EVENT_FIELDS, order: 'start asc', limit: 500,
      })
      return data.records || []
    },
  })

  const events: CalendarEvent[] = data || []
  const eventsByDate: Record<string, CalendarEvent[]> = {}
  for (const ev of events) {
    const d = ev.start?.split('T')[0] || ev.start?.split(' ')[0]
    if (d) { if (!eventsByDate[d]) eventsByDate[d] = []; eventsByDate[d].push(ev) }
  }

  const createMut = useMutation({
    mutationFn: async ({ name, date, recurrence }: { name: string; date: string; recurrence: RecurrenceValue }) => {
      const start = `${date} 09:00:00`
      const stop = `${date} 10:00:00`
      const vals: Record<string, any> = { name, start, stop }
      if (recurrence.enabled) {
        // Calendar events use `recurrency` boolean + recurrence fields.
        vals.recurrency = true
        vals.rrule_type = recurrence.rule_type || 'weekly'
        vals.interval = recurrence.interval || 1
        if (recurrence.end_type === 'count') {
          vals.end_type = 'count'
          vals.count = recurrence.count || 1
        } else if (recurrence.end_type === 'until') {
          vals.end_type = 'end_date'
          if (recurrence.until) vals.until = recurrence.until
        } else {
          vals.end_type = 'forever'
        }
        if (recurrence.rule_type === 'weekly' && recurrence.weekdays?.length) {
          for (const d of recurrence.weekdays) vals[d] = true
        }
        if (recurrence.rule_type === 'monthly') {
          if (recurrence.monthly_type === 'date') {
            vals.month_by = 'date'
            vals.day = recurrence.day || 1
          } else {
            vals.month_by = 'day'
            vals.byday = recurrence.byday || 'first'
            vals.weekday = recurrence.weekday || 'mon'
          }
        }
      }
      await erpClient.raw.post('/model/calendar.event/create', { vals })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
      setShowCreate(false)
      setNewName('')
      setNewRecurrence(r => ({ ...r, enabled: false }))
    },
    onError: (e: unknown) => toast.error('Failed to create event', extractErrorMessage(e)),
  })

  const acceptMut = useMutation({
    mutationFn: async (eventId: number) => {
      await erpClient.raw.post(`/calendar/events/${eventId}/accept`)
    },
    onSuccess: () => {
      toast.success('Invitation accepted')
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
    },
    onError: (e: unknown) => toast.error('Accept failed', extractErrorMessage(e)),
  })

  const declineMut = useMutation({
    mutationFn: async (eventId: number) => {
      await erpClient.raw.post(`/calendar/events/${eventId}/decline`)
    },
    onSuccess: () => {
      toast.success('Invitation declined')
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
    },
    onError: (e: unknown) => toast.error('Decline failed', extractErrorMessage(e)),
  })

  // Navigation handlers depend on view.
  const navPrev = () => {
    if (view === 'month') {
      if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1)
    } else if (view === 'week') {
      setAnchor(d => addDays(d, -7))
    } else if (view === 'day') {
      setAnchor(d => addDays(d, -1))
    } else {
      setAnchor(d => addDays(d, -30))
    }
  }
  const navNext = () => {
    if (view === 'month') {
      if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1)
    } else if (view === 'week') {
      setAnchor(d => addDays(d, 7))
    } else if (view === 'day') {
      setAnchor(d => addDays(d, 1))
    } else {
      setAnchor(d => addDays(d, 30))
    }
  }

  const headerLabel = useMemo(() => {
    if (view === 'month') return new Date(year, month).toLocaleString(undefined, { month: 'long', year: 'numeric' })
    if (view === 'week') {
      const s = startOfWeek(anchor); const e = addDays(s, 6)
      const sameMonth = s.getMonth() === e.getMonth()
      const left = s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      const right = sameMonth
        ? e.toLocaleDateString(undefined, { day: 'numeric', year: 'numeric' })
        : e.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      return `${left} – ${right}`
    }
    if (view === 'day') return anchor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    return `${anchor.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${addDays(anchor, 29).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
  }, [view, year, month, anchor])

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : []

  // Helper to compute top/height for an event in week/day views.
  function eventStyle(ev: CalendarEvent): { top: number; height: number } | null {
    if (ev.allday) return null
    const start = parseEventDate(ev.start)
    const stop = ev.stop ? parseEventDate(ev.stop) : new Date(start.getTime() + 60 * 60 * 1000)
    const startMins = start.getHours() * 60 + start.getMinutes()
    const endMins = stop.getHours() * 60 + stop.getMinutes()
    if (Number.isNaN(startMins)) return null
    const top = ((startMins / 60) - DAY_START) * HOUR_HEIGHT
    const dur = Math.max(20, ((endMins - startMins) / 60) * HOUR_HEIGHT)
    return { top, height: dur }
  }

  const renderTimeGutter = () => (
    <div className="w-12 shrink-0 border-r border-border/30">
      {Array.from({ length: DAY_END - DAY_START }).map((_, i) => (
        <div key={i} className="text-[10px] text-muted-foreground text-right pr-1.5 -mt-1.5" style={{ height: HOUR_HEIGHT }}>
          {String(DAY_START + i).padStart(2, '0')}:00
        </div>
      ))}
    </div>
  )

  const renderDayColumn = (date: Date, opts?: { showHeader?: boolean }) => {
    const key = fmt(date)
    const dayEvents = eventsByDate[key] || []
    const allDay = dayEvents.filter(e => e.allday)
    const timed = dayEvents.filter(e => !e.allday)
    const isToday = key === today
    return (
      <div className="flex-1 min-w-0 border-r border-border/30 last:border-r-0 flex flex-col">
        {opts?.showHeader !== false && (
          <div className={cn('text-center py-2 border-b border-border/30 text-xs font-semibold', isToday && 'bg-primary/10 text-primary')}>
            {date.toLocaleDateString(undefined, { weekday: 'short' })} <span className="text-base ml-1">{date.getDate()}</span>
          </div>
        )}
        {allDay.length > 0 && (
          <div className="border-b border-border/30 px-1 py-1 space-y-0.5">
            {allDay.map((ev, j) => (
              <div key={ev.id} className={cn('text-[10px] truncate rounded px-1.5 py-0.5 text-white', COLORS[j % COLORS.length])} title={ev.name}>
                {ev.name}
              </div>
            ))}
          </div>
        )}
        <div className="relative flex-1" style={{ height: (DAY_END - DAY_START) * HOUR_HEIGHT }}>
          {/* hour grid lines */}
          {Array.from({ length: DAY_END - DAY_START }).map((_, i) => (
            <div key={i} className="border-b border-border/15" style={{ height: HOUR_HEIGHT }} />
          ))}
          {/* events */}
          {timed.map((ev, j) => {
            const style = eventStyle(ev)
            if (!style) return null
            return (
              <div
                key={ev.id}
                className={cn('absolute left-0.5 right-0.5 rounded-md px-1.5 py-1 text-[10px] text-white overflow-hidden cursor-pointer shadow', COLORS[j % COLORS.length])}
                style={{ top: style.top, height: style.height }}
                onClick={() => setSelectedDate(key)}
                title={ev.name}
              >
                <div className="font-semibold truncate">{ev.name}</div>
                <div className="opacity-90 truncate">{fmtTime(ev.start)}{ev.stop ? ` – ${fmtTime(ev.stop)}` : ''}</div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Build agenda data: group events in range by date.
  const agendaGroups = useMemo(() => {
    const out: { date: string; label: string; items: CalendarEvent[] }[] = []
    if (view !== 'agenda') return out
    for (let i = 0; i < 30; i++) {
      const d = addDays(anchor, i)
      const key = fmt(d)
      const items = eventsByDate[key] || []
      if (items.length === 0) continue
      out.push({
        date: key,
        label: d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
        items,
      })
    }
    return out
  }, [view, anchor, eventsByDate])

  const VIEW_TABS: CalendarView[] = ['month', 'week', 'day', 'agenda']

  return (
    <div className="space-y-4">
      <PageHeader title="Calendar" subtitle="calendar" onNew={() => { setShowCreate(true); setSelectedDate(selectedDate || today) }} />

      {/* View tabs + nav */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="inline-flex rounded-xl border border-border/40 bg-muted/30 p-0.5">
          {VIEW_TABS.map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'inline-flex items-center rounded-lg px-3 py-1 text-xs capitalize transition-colors',
                view === v ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg" onClick={navPrev}><ChevronLeft className="h-4 w-4" /></Button>
          <h2 className="text-sm font-semibold min-w-[180px] text-center">{headerLabel}</h2>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg" onClick={navNext}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={() => {
            const now = new Date(); now.setHours(0, 0, 0, 0)
            setAnchor(now); setYear(now.getFullYear()); setMonth(now.getMonth())
          }}>Today</Button>
        </div>
      </div>

      <div className={cn(view === 'month' ? 'grid lg:grid-cols-[1fr_320px] gap-4' : 'grid grid-cols-1 gap-4')}>
        {/* Main panel */}
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          {isLoading ? (
            <div className="p-4"><Skeleton className="h-[400px] w-full rounded-xl" /></div>
          ) : view === 'month' ? (
            <div className="grid grid-cols-7">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-center py-2 border-b border-border/30">{d}</div>
              ))}
              {days.map(({ date, inMonth }, i) => {
                const key = fmt(date)
                const dayEvents = eventsByDate[key] || []
                const isToday = key === today
                const isSelected = key === selectedDate
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(key)}
                    className={cn(
                      'relative h-20 p-1 border-b border-r border-border/20 text-left transition-colors hover:bg-muted/20',
                      !inMonth && 'opacity-30',
                      isSelected && 'bg-primary/5 ring-1 ring-primary/30',
                    )}
                  >
                    <span className={cn(
                      'text-xs font-medium inline-flex items-center justify-center h-5 w-5 rounded-full',
                      isToday && 'bg-primary text-primary-foreground',
                    )}>
                      {date.getDate()}
                    </span>
                    <div className="mt-0.5 space-y-0.5 overflow-hidden">
                      {dayEvents.slice(0, 3).map((ev, j) => (
                        <div key={ev.id} className={cn('text-[9px] font-medium truncate rounded px-1 py-0.5 text-white', COLORS[j % COLORS.length])}>
                          {ev.name}
                        </div>
                      ))}
                      {dayEvents.length > 3 && <div className="text-[9px] text-muted-foreground px-1">+{dayEvents.length - 3} more</div>}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : view === 'week' ? (
            <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
              <div className="flex min-w-[700px]">
                {renderTimeGutter()}
                {Array.from({ length: 7 }).map((_, i) => renderDayColumn(addDays(startOfWeek(anchor), i)))}
              </div>
            </div>
          ) : view === 'day' ? (
            <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
              <div className="flex min-w-[400px]">
                {renderTimeGutter()}
                {renderDayColumn(anchor)}
              </div>
            </div>
          ) : (
            // Agenda view
            <div className="p-4 space-y-4 max-h-[calc(100vh-260px)] overflow-auto">
              {agendaGroups.length === 0 && (
                <div className="text-center text-muted-foreground py-12">
                  <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No events in this range</p>
                </div>
              )}
              {agendaGroups.map(group => (
                <div key={group.date} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{group.label}</h3>
                    <span className="text-xs text-muted-foreground">{group.items.length} event{group.items.length === 1 ? '' : 's'}</span>
                  </div>
                  <div className="space-y-1.5 pl-2 border-l-2 border-border/30">
                    {group.items.map((ev, j) => (
                      <button
                        key={ev.id}
                        onClick={() => setSelectedDate(group.date)}
                        className="w-full text-left rounded-xl border border-border/40 bg-card hover:bg-muted/30 p-2.5 flex items-start gap-3 transition-colors"
                      >
                        <div className={cn('w-1 self-stretch rounded-full', COLORS[j % COLORS.length])} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{ev.name}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{ev.allday ? 'All day' : `${fmtTime(ev.start)} – ${fmtTime(ev.stop)}`}</span>
                            {ev.location && <span className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3" />{ev.location}</span>}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar: only in month view */}
        {view === 'month' && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">
              {selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : 'Select a day'}
            </h3>

            {showCreate && selectedDate && (
              <div className="rounded-xl border border-primary/50 bg-card p-3 space-y-2.5">
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Event name..." className="h-8 rounded-lg text-sm" autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newName.trim()) {
                      createMut.mutate({ name: newName.trim(), date: selectedDate, recurrence: newRecurrence })
                    }
                    if (e.key === 'Escape') setShowCreate(false)
                  }} />
                <RecurrenceField value={newRecurrence} onChange={setNewRecurrence} />
                <div className="flex gap-1">
                  <Button size="sm" className="h-7 rounded-lg text-xs flex-1"
                    onClick={() => newName.trim() && createMut.mutate({ name: newName.trim(), date: selectedDate, recurrence: newRecurrence })}>
                    Create
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 rounded-lg text-xs" onClick={() => setShowCreate(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {selectedEvents.length === 0 && !showCreate && (
              <div className="text-sm text-muted-foreground py-6 text-center">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No events
              </div>
            )}

            {selectedEvents.map(ev => (
              <div key={ev.id} className="rounded-xl border border-border/50 bg-card p-3 space-y-1.5">
                <p className="text-sm font-medium">{ev.name}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{ev.allday ? 'All day' : `${fmtTime(ev.start)} – ${fmtTime(ev.stop)}`}</span>
                  {ev.duration && ev.duration > 0 && !ev.allday && <span>{ev.duration}h</span>}
                </div>
                {ev.location && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{ev.location}</p>}
                {Array.isArray(ev.partner_ids) && ev.partner_ids.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3 w-3" />{ev.partner_ids.length} attendee(s)</div>
                )}
                <div className="flex items-center gap-1.5 pt-1.5 border-t border-border/30">
                  <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs gap-1 flex-1 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                    onClick={() => acceptMut.mutate(ev.id)} disabled={acceptMut.isPending}>
                    <Check className="h-3 w-3" /> Accept
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs gap-1 flex-1 text-red-400 border-red-500/30 hover:bg-red-500/10"
                    onClick={() => declineMut.mutate(ev.id)} disabled={declineMut.isPending}>
                    <X className="h-3 w-3" /> Decline
                  </Button>
                </div>
              </div>
            ))}

            {selectedDate && !showCreate && (
              <Button variant="outline" size="sm" className="w-full rounded-xl gap-1.5 text-xs" onClick={() => setShowCreate(true)}>
                <Plus className="h-3.5 w-3.5" /> Add Event
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
