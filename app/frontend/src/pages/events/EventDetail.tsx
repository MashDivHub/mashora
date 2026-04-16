import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, Skeleton } from '@mashora/design-system'
import { CalendarDays } from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface EventDetail {
  id: number
  name: string
  date_begin: string
  date_end: string
  state: 'draft' | 'confirm' | 'done' | 'cancel'
  seats_max: number
  seats_reserved: number
  seats_available: number
  registration_ids: number[]
  organizer_id: [number, string] | false
  company_id: [number, string]
}

const STATE_BADGE: Record<string, { variant: 'secondary' | 'success' | 'default' | 'destructive'; label: string }> = {
  draft:   { variant: 'secondary',   label: 'Draft' },
  confirm: { variant: 'success',     label: 'Confirmed' },
  done:    { variant: 'default',     label: 'Done' },
  cancel:  { variant: 'destructive', label: 'Cancelled' },
}

function fmtDateTime(dt: string): string {
  if (!dt) return '—'
  try {
    const [date, time] = dt.split(' ')
    const [y, m, d] = date.split('-')
    return `${d}/${m}/${y}${time ? ' ' + time.substring(0, 5) : ''}`
  } catch {
    return dt
  }
}

interface InfoRowProps {
  label: string
  value: React.ReactNode
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || '—'}</p>
    </div>
  )
}

export default function EventDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const recordId = parseInt(id || '0')

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', recordId],
    queryFn: async () => {
      const { data } = await erpClient.raw.get(`/events/${recordId}`)
      return data as EventDetail
    },
    enabled: !!recordId,
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <CalendarDays className="h-10 w-10" />
        <p>Event not found.</p>
      </div>
    )
  }

  const stateCfg = STATE_BADGE[event.state] ?? { variant: 'secondary' as const, label: event.state }
  const regCount = Array.isArray(event.registration_ids) ? event.registration_ids.length : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={event.name}
        backTo="/admin/events"
        actions={<Badge variant={stateCfg.variant}>{stateCfg.label}</Badge>}
      />

      {/* Info card */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-4">
            <InfoRow label="Event Name" value={event.name} />
            <InfoRow label="Start Date" value={fmtDateTime(event.date_begin)} />
            <InfoRow label="End Date" value={fmtDateTime(event.date_end)} />
            <InfoRow
              label="Organizer"
              value={Array.isArray(event.organizer_id) ? event.organizer_id[1] : '—'}
            />
          </div>
          {/* Right column */}
          <div className="space-y-4">
            <InfoRow
              label="Seats Max"
              value={event.seats_max === 0 ? 'Unlimited' : String(event.seats_max)}
            />
            <InfoRow label="Seats Reserved" value={String(event.seats_reserved ?? 0)} />
            <InfoRow label="Seats Available" value={String(event.seats_available ?? 0)} />
            <InfoRow
              label="Company"
              value={Array.isArray(event.company_id) ? event.company_id[1] : '—'}
            />
          </div>
        </div>
      </div>

      {/* Registrations section */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Registrations</h2>
          <span className="text-xs text-muted-foreground">{regCount} total</span>
        </div>
        <div className="mt-4">
          <button
            onClick={() => navigate(`/admin/events/${event.id}/registrations`)}
            className="text-sm text-primary hover:underline"
          >
            View {regCount} registration{regCount !== 1 ? 's' : ''} &rarr;
          </button>
        </div>
      </div>
    </div>
  )
}
