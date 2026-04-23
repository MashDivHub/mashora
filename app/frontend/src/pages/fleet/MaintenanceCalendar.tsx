import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Skeleton } from '@mashora/design-system'
import { PageHeader } from '@/components/shared'
import { Calendar, Wrench, ChevronRight, Plus } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

interface MaintenanceRequest {
  id: number
  name: string
  request_date: string | false
  close_date: string | false
  stage_id: [number, string] | false
  user_id: [number, string] | false
  equipment_id: [number, string] | false
  maintenance_type: string
  priority: string
  kanban_state: string
  duration: number | false
}

const FIELDS = [
  'id', 'name', 'request_date', 'close_date', 'stage_id', 'user_id',
  'equipment_id', 'maintenance_type', 'priority', 'kanban_state', 'duration',
]

const kanbanColors: Record<string, 'secondary' | 'success' | 'warning' | 'destructive'> = {
  normal: 'secondary',
  done: 'success',
  blocked: 'destructive',
}

const kanbanLabels: Record<string, string> = {
  normal: 'In Progress',
  done: 'Ready',
  blocked: 'Blocked',
}

function formatMonthYear(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
}

function groupByMonth(records: MaintenanceRequest[]): Map<string, MaintenanceRequest[]> {
  const map = new Map<string, MaintenanceRequest[]>()
  for (const r of records) {
    const dateKey = r.request_date || r.close_date
    if (!dateKey) continue
    // Group by YYYY-MM
    const monthKey = String(dateKey).slice(0, 7)
    if (!map.has(monthKey)) map.set(monthKey, [])
    map.get(monthKey)!.push(r)
  }
  // Sort months descending
  const sorted = new Map([...map.entries()].sort((a, b) => b[0].localeCompare(a[0])))
  return sorted
}

function RequestCard({ req, onClick }: { req: MaintenanceRequest; onClick: () => void }) {
  const dateStr = (req.request_date || req.close_date) as string | false
  const isUrgent = req.priority === '1' || req.priority === '2' || req.priority === '3'

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-start gap-4 rounded-2xl border border-border/30 bg-card/50 p-4 hover:border-border/60 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      {/* Date pill */}
      <div className="shrink-0 text-center min-w-[52px]">
        {dateStr ? (
          <div className="rounded-xl bg-primary/10 px-2 py-1.5">
            <p className="text-xs font-bold text-primary">
              {new Date(dateStr).toLocaleDateString('en-US', { day: '2-digit' })}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase">
              {new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' })}
            </p>
          </div>
        ) : (
          <div className="rounded-xl bg-muted/40 px-2 py-1.5">
            <p className="text-xs text-muted-foreground">—</p>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-sm leading-snug">{req.name}</p>
          <Badge variant={kanbanColors[req.kanban_state] ?? 'secondary'} className="shrink-0 text-xs">
            {kanbanLabels[req.kanban_state] ?? req.kanban_state}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {req.equipment_id && (
            <span className="flex items-center gap-1">
              <Wrench className="h-3 w-3" />
              {req.equipment_id[1]}
            </span>
          )}
          {req.stage_id && (
            <span className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              {req.stage_id[1]}
            </span>
          )}
          {req.user_id && (
            <span>Assigned: {req.user_id[1]}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs capitalize py-0">
            {req.maintenance_type === 'preventive' ? 'Preventive' : 'Corrective'}
          </Badge>
          {isUrgent && <Badge variant="warning" className="text-xs py-0">Urgent</Badge>}
          {req.duration && (
            <span className="text-xs text-muted-foreground">{req.duration}h</span>
          )}
        </div>
      </div>
    </button>
  )
}

function SkeletonList() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 2 }).map((_, gi) => (
        <div key={gi} className="space-y-3">
          <Skeleton className="h-5 w-40 rounded-lg" />
          {Array.from({ length: 3 }).map((__, i) => (
            <div key={i} className="rounded-2xl border border-border/30 bg-card/50 p-4 flex gap-4">
              <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function MaintenanceCalendar() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['maintenance-calendar'],
    queryFn: () =>
      erpClient.raw
        .post('/model/maintenance.request', {
          fields: FIELDS,
          domain: [],
          limit: 200,
          order: 'request_date desc',
        })
        .then(r => r.data),
  })

  const records: MaintenanceRequest[] = data?.records ?? []
  const grouped = groupByMonth(records)
  const handleCreate = () => navigate('/admin/model/maintenance.request/new')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance Schedule"
        subtitle={`${data?.total ?? '—'} requests`}
        onNew={handleCreate}
        newLabel="New Request"
      />

      {/* Legend */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-4 flex flex-wrap items-center gap-3">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Status</span>
        <Badge variant="secondary">In Progress</Badge>
        <Badge variant="success">Ready</Badge>
        <Badge variant="destructive">Blocked</Badge>
        <Badge variant="warning">Urgent</Badge>
      </div>

      {isLoading ? (
        <SkeletonList />
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24">
          <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
            <Calendar className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold">No maintenance requests scheduled</p>
            <p className="text-xs text-muted-foreground mt-1">
              Schedule preventive or corrective maintenance to populate the calendar.
            </p>
          </div>
          <Button onClick={handleCreate} className="rounded-xl gap-1.5" size="sm">
            <Plus className="h-3.5 w-3.5" /> New Request
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {[...grouped.entries()].map(([monthKey, reqs]) => (
            <div key={monthKey} className="space-y-3">
              {/* Month header */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border/40" />
                <span className="text-sm font-semibold text-muted-foreground px-2">
                  {formatMonthYear(`${monthKey}-01`)}
                </span>
                <div className="h-px flex-1 bg-border/40" />
              </div>
              {/* Request cards */}
              <div className="space-y-3">
                {reqs.map(req => (
                  <RequestCard
                    key={req.id}
                    req={req}
                    onClick={() => navigate(`/admin/maintenance/${req.id}`)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
