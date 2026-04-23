import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button, Skeleton } from '@mashora/design-system'
import { Mic, Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventTrack {
  id: number
  name: string
  partner_id: [number, string] | false
  stage_id: [number, string] | false
  date: string
  duration: number
  location_id: [number, string] | false
  description: string | false
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(dt: string): string {
  if (!dt) return '—'
  try {
    const [date] = dt.split(' ')
    const [y, m, d] = date.split('-')
    return `${d}/${m}/${y}`
  } catch {
    return dt
  }
}

function fmtTime(dt: string): string {
  if (!dt) return '—'
  try {
    const parts = dt.split(' ')
    return parts[1] ? parts[1].substring(0, 5) : '—'
  } catch {
    return '—'
  }
}

function fmtDuration(hours: number): string {
  if (!hours && hours !== 0) return '—'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m}m`
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function groupByDate(tracks: EventTrack[]): Map<string, EventTrack[]> {
  const map = new Map<string, EventTrack[]>()
  for (const track of tracks) {
    const key = track.date ? fmtDate(track.date) : 'No Date'
    const existing = map.get(key) ?? []
    existing.push(track)
    map.set(key, existing)
  }
  return map
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EventTracks() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const eventId = parseInt(id || '0')
  const newTrackUrl = `/admin/model/event.track/new?event_id=${eventId}`

  const { data, isLoading, isError } = useQuery({
    queryKey: ['event-tracks', eventId],
    queryFn: () =>
      erpClient.raw
        .post('/model/event.track', {
          domain: [['event_id', '=', eventId]],
          fields: ['id', 'name', 'partner_id', 'stage_id', 'date', 'duration', 'location_id', 'description'],
          order: 'date asc',
          limit: 100,
        })
        .then(r => r.data),
    enabled: !!eventId,
    retry: false,
  })

  if (isError) {
    return (
      <div className="space-y-4">
        <PageHeader title="Event Tracks" backTo={`/admin/events/${eventId}`} />
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/30 bg-card/50 py-20 text-muted-foreground">
          <Mic className="h-10 w-10" />
          <p className="text-sm font-medium">Event tracks module not installed</p>
          <p className="text-xs">Enable the Event Tracks module to use this feature.</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  }

  const tracks: EventTrack[] = data?.records ?? []
  const grouped = groupByDate(tracks)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Event Tracks"
        backTo={`/admin/events/${eventId}`}
        subtitle={`${tracks.length} track${tracks.length !== 1 ? 's' : ''}`}
        onNew={() => navigate(newTrackUrl)}
        newLabel="New Track"
      />

      {tracks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-12 text-center space-y-4">
          <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-primary">
            <Mic className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">No tracks scheduled</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Tracks are individual sessions or talks within an event. Add speakers, times, and rooms.
            </p>
          </div>
          <Button onClick={() => navigate(newTrackUrl)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add First Track
          </Button>
        </div>
      ) : (
        Array.from(grouped.entries()).map(([dateLabel, dateTracks]) => (
          <div key={dateLabel} className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
              {dateLabel}
            </h2>
            <div className="space-y-3">
              {dateTracks.map(track => (
                <button
                  type="button"
                  key={track.id}
                  onClick={() => navigate(`/admin/model/event.track/${track.id}`)}
                  className="rounded-2xl border border-border/30 bg-card/50 p-5 w-full text-left hover:bg-card/80 hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <p className="text-sm font-bold leading-tight truncate">{track.name}</p>
                      {Array.isArray(track.partner_id) && (
                        <p className="text-xs text-muted-foreground">{track.partner_id[1]}</p>
                      )}
                    </div>
                    {Array.isArray(track.stage_id) && (
                      <Badge variant="secondary" className="shrink-0">{track.stage_id[1]}</Badge>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>
                      <span className="font-medium text-foreground">{fmtTime(track.date)}</span>
                    </span>
                    {track.duration > 0 && (
                      <span>{fmtDuration(track.duration)}</span>
                    )}
                    {Array.isArray(track.location_id) && (
                      <span>{track.location_id[1]}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
