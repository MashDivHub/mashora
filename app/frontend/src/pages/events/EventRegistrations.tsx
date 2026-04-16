import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@mashora/design-system'
import { Users } from 'lucide-react'
import { DataTable, PageHeader, type Column } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface Registration {
  id: number
  name: string
  email: string
  phone: string
  event_id: [number, string]
  state: 'draft' | 'open' | 'done' | 'cancel'
  date_open: string
  origin: string
}

const STATE_BADGE: Record<string, { variant: 'secondary' | 'success' | 'default' | 'destructive'; label: string }> = {
  draft:  { variant: 'secondary',   label: 'Draft' },
  open:   { variant: 'success',     label: 'Registered' },
  done:   { variant: 'default',     label: 'Done' },
  cancel: { variant: 'destructive', label: 'Cancelled' },
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

export default function EventRegistrations() {
  const { id } = useParams<{ id: string }>()
  const eventId = parseInt(id || '0')

  const { data, isLoading } = useQuery({
    queryKey: ['event-registrations', eventId],
    queryFn: async () => {
      const { data: res } = await erpClient.raw.post('/model/event.registration', {
        domain: [['event_id', '=', eventId]],
        fields: ['id', 'name', 'email', 'phone', 'event_id', 'state', 'date_open', 'origin'],
        order: 'date_open desc',
        limit: 100,
      })
      return res
    },
    enabled: !!eventId,
  })

  const columns: Column<Registration>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (v) => <span className="font-medium text-sm">{v || '—'}</span>,
    },
    {
      key: 'email',
      label: 'Email',
      render: (v) => (
        <span className="text-sm text-muted-foreground">{v || '—'}</span>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (v) => (
        <span className="text-sm text-muted-foreground">{v || '—'}</span>
      ),
    },
    {
      key: 'state',
      label: 'Status',
      render: (v) => {
        const cfg = STATE_BADGE[v] ?? { variant: 'secondary' as const, label: v }
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>
      },
    },
    {
      key: 'date_open',
      label: 'Registration Date',
      sortable: false,
      render: (v) => (
        <span className="font-mono text-xs text-muted-foreground">{fmtDateTime(v)}</span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Event Registrations"
        backTo={`/admin/events/${eventId}`}
        subtitle={data?.total != null ? `${data.total} registration${data.total !== 1 ? 's' : ''}` : undefined}
      />
      <DataTable
        columns={columns}
        data={data?.records ?? []}
        total={data?.total}
        loading={isLoading}
        emptyMessage="No registrations found"
        emptyIcon={<Users className="h-10 w-10" />}
      />
    </div>
  )
}
