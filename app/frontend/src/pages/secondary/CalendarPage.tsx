import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input, Button, Badge, Skeleton, cn } from '@mashora/design-system'
import { Calendar, Plus, Clock, MapPin, Users, ChevronLeft, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

const EVENT_FIELDS = [
  'id', 'name', 'start', 'stop', 'allday', 'duration',
  'location', 'partner_ids', 'user_id', 'privacy', 'show_as',
  'categ_ids', 'description',
]

const COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-pink-500', 'bg-cyan-500', 'bg-red-500']

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
function fmtTime(s: string) {
  try { return new Date(s).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}

export default function CalendarPage() {
  const queryClient = useQueryClient()
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')

  const days = getMonthDays(year, month)
  const monthStart = new Date(year, month, 1).toISOString()
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
  const monthLabel = new Date(year, month).toLocaleString(undefined, { month: 'long', year: 'numeric' })
  const today = fmt(new Date())

  const { data, isLoading } = useQuery({
    queryKey: ['calendar-events', year, month],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/calendar.event', {
        domain: [['start', '>=', monthStart], ['start', '<=', monthEnd]],
        fields: EVENT_FIELDS, order: 'start asc', limit: 200,
      })
      return data.records || []
    },
  })

  const events = data || []
  const eventsByDate: Record<string, any[]> = {}
  for (const ev of events) {
    const d = ev.start?.split('T')[0] || ev.start?.split(' ')[0]
    if (d) { if (!eventsByDate[d]) eventsByDate[d] = []; eventsByDate[d].push(ev) }
  }

  const createMut = useMutation({
    mutationFn: async ({ name, date }: { name: string; date: string }) => {
      const start = `${date} 09:00:00`
      const stop = `${date} 10:00:00`
      await erpClient.raw.post('/model/calendar.event/create', { vals: { name, start, stop } })
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['calendar-events'] }); setShowCreate(false); setNewName('') },
  })

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const next = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : []

  return (
    <div className="space-y-4">
      <PageHeader title="Calendar" subtitle="calendar" onNew={() => { setShowCreate(true); setSelectedDate(selectedDate || today) }} />

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        {/* Calendar grid */}
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg" onClick={prev}><ChevronLeft className="h-4 w-4" /></Button>
            <h2 className="text-sm font-semibold">{monthLabel}</h2>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg" onClick={next}><ChevronRight className="h-4 w-4" /></Button>
          </div>

          {isLoading ? (
            <div className="p-4"><Skeleton className="h-[400px] w-full rounded-xl" /></div>
          ) : (
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
          )}
        </div>

        {/* Sidebar: selected day events */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">
            {selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : 'Select a day'}
          </h3>

          {showCreate && selectedDate && (
            <div className="rounded-xl border border-primary/50 bg-card p-3 space-y-2">
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Event name..." className="h-8 rounded-lg text-sm" autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) createMut.mutate({ name: newName.trim(), date: selectedDate }); if (e.key === 'Escape') setShowCreate(false) }} />
              <div className="flex gap-1">
                <Button size="sm" className="h-7 rounded-lg text-xs flex-1" onClick={() => newName.trim() && createMut.mutate({ name: newName.trim(), date: selectedDate })}>Create</Button>
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
                {ev.duration > 0 && !ev.allday && <span>{ev.duration}h</span>}
              </div>
              {ev.location && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{ev.location}</p>}
              {Array.isArray(ev.partner_ids) && ev.partner_ids.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3 w-3" />{ev.partner_ids.length} attendee(s)</div>
              )}
            </div>
          ))}

          {selectedDate && !showCreate && (
            <Button variant="outline" size="sm" className="w-full rounded-xl gap-1.5 text-xs" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Event
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
