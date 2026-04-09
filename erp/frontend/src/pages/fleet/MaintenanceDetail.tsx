import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, Skeleton } from '@mashora/design-system'
import { Wrench } from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MaintenanceRequest {
  id: number
  name: string
  request_date: string
  close_date: string
  stage_id: [number, string] | false
  user_id: [number, string] | false
  equipment_id: [number, string] | false
  maintenance_type: 'corrective' | 'preventive'
  priority: '0' | '1' | '2' | '3'
  kanban_state: 'normal' | 'blocked' | 'done'
  duration: number
  description: string | false
  schedule_date: string
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

function fmtDuration(hours: number): string {
  if (!hours && hours !== 0) return '—'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m}m`
  return m > 0 ? `${h}h ${m}m` : `${h}h`
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

// ─── Sub-components ───────────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MaintenanceDetail() {
  const { id } = useParams<{ id: string }>()
  const recordId = parseInt(id || '0')

  const { data: request, isLoading } = useQuery({
    queryKey: ['maintenance-request', recordId],
    queryFn: () =>
      erpClient.raw
        .post('/model/maintenance.request', {
          domain: [['id', '=', recordId]],
          fields: ['id', 'name', 'request_date', 'close_date', 'stage_id', 'user_id', 'equipment_id', 'maintenance_type', 'priority', 'kanban_state', 'duration', 'description', 'schedule_date'],
          limit: 1,
        })
        .then(r => {
          const records = r.data?.records ?? []
          return records[0] as MaintenanceRequest | undefined
        }),
    enabled: !!recordId,
  })

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
      </div>
    )
  }

  const kanbanCfg = KANBAN_BADGE[request.kanban_state] ?? { variant: 'secondary' as const, label: request.kanban_state }
  const typeCfg = TYPE_BADGE[request.maintenance_type] ?? { variant: 'secondary' as const, label: request.maintenance_type }

  return (
    <div className="space-y-6">
      <PageHeader
        title={request.name}
        backTo="/maintenance"
        actions={<Badge variant={kanbanCfg.variant}>{kanbanCfg.label}</Badge>}
      />

      {/* Info card */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-4">
            <InfoRow
              label="Equipment"
              value={Array.isArray(request.equipment_id) ? request.equipment_id[1] : '—'}
            />
            <InfoRow
              label="Type"
              value={<Badge variant={typeCfg.variant}>{typeCfg.label}</Badge>}
            />
            <InfoRow
              label="Priority"
              value={PRIORITY_LABEL[request.priority] ?? request.priority}
            />
            <InfoRow
              label="Assigned To"
              value={Array.isArray(request.user_id) ? request.user_id[1] : '—'}
            />
          </div>
          {/* Right column */}
          <div className="space-y-4">
            <InfoRow label="Request Date" value={fmtDate(request.request_date)} />
            <InfoRow label="Schedule Date" value={fmtDate(request.schedule_date)} />
            <InfoRow label="Close Date" value={fmtDate(request.close_date)} />
            <InfoRow label="Duration" value={fmtDuration(request.duration)} />
          </div>
        </div>
      </div>

      {/* Description card */}
      {request.description && (
        <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
          <h2 className="text-sm font-semibold mb-3">Description</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{request.description}</p>
        </div>
      )}
    </div>
  )
}
