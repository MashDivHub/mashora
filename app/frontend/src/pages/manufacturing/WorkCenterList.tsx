import { useQuery } from '@tanstack/react-query'
import { Badge, Skeleton, cn } from '@mashora/design-system'
import { Wrench } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface WorkCenter {
  id: number
  name: string
  code: string
  active: boolean
  time_start: number
  time_stop: number
  time_efficiency: number
  capacity: number
  sequence: number
  color: number
  working_state: 'normal' | 'blocked' | 'done'
  oee: number
  blocked_time: number
  productive_time: number
}

interface WorkCenterListResponse {
  records: WorkCenter[]
  total: number
}

const STATE_CONFIG: Record<string, { label: string; dot: string }> = {
  normal: { label: 'Normal', dot: 'bg-emerald-400' },
  blocked: { label: 'Blocked', dot: 'bg-red-400' },
  done: { label: 'In Progress', dot: 'bg-blue-400' },
}

function oeeColor(oee: number): string {
  if (oee >= 80) return 'text-emerald-400'
  if (oee >= 60) return 'text-amber-400'
  return 'text-red-400'
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  )
}

function WorkCenterCard({ wc }: { wc: WorkCenter }) {
  const state = STATE_CONFIG[wc.working_state] ?? STATE_CONFIG.normal

  return (
    <div className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm leading-tight truncate">{wc.name}</p>
          <Badge variant="secondary" className="mt-1 rounded-md font-mono text-[11px] px-1.5 py-0">
            {wc.code}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn('h-2 w-2 rounded-full shrink-0', state.dot)} />
          <span className="text-xs text-muted-foreground">{state.label}</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">OEE</span>
          <span className={cn('text-sm font-semibold tabular-nums', oeeColor(wc.oee))}>
            {wc.oee}%
          </span>
        </div>
        <StatItem label="Capacity" value={String(wc.capacity)} />
        <StatItem label="Efficiency" value={`${wc.time_efficiency}%`} />
        <StatItem label="Setup Time" value={`${wc.time_start} min`} />
        <StatItem label="Cleanup Time" value={`${wc.time_stop} min`} />
        <StatItem label="Productive Time" value={`${wc.productive_time}h`} />
      </div>
    </div>
  )
}

export default function WorkCenterList() {
  const { data, isLoading } = useQuery<WorkCenterListResponse>({
    queryKey: ['manufacturing', 'workcenters'],
    queryFn: () => erpClient.raw.get('/manufacturing/workcenters').then((r) => r.data).catch(() => ({ records: [], total: 0 })),
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Work Centers" subtitle="manufacturing" />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : !data?.records?.length ? (
        <EmptyState
          icon={<Wrench className="h-12 w-12" />}
          title="No work centers yet"
          description="Add a work center to track production capacity and efficiency."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.records.map((wc) => (
            <WorkCenterCard key={wc.id} wc={wc} />
          ))}
        </div>
      )}
    </div>
  )
}
