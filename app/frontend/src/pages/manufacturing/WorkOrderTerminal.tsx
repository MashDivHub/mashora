import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button, Skeleton, cn } from '@mashora/design-system'
import { Play, CheckCircle2, Timer, Package } from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

const STATE_BADGE: Record<string, { label: string; variant: string }> = {
  pending:  { label: 'Pending',     variant: 'secondary' },
  waiting:  { label: 'Waiting',     variant: 'secondary' },
  ready:    { label: 'Ready',       variant: 'info' },
  progress: { label: 'In Progress', variant: 'warning' },
  done:     { label: 'Done',        variant: 'success' },
  cancel:   { label: 'Cancelled',   variant: 'destructive' },
}

function fmtDur(mins: number | null | undefined) {
  if (!mins) return '—'
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function fmt(v: any): string {
  if (Array.isArray(v)) return v[1] ?? ''
  return v || ''
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/30 bg-card/50 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-semibold leading-snug">{value || <span className="text-muted-foreground/40">—</span>}</p>
    </div>
  )
}

export default function WorkOrderTerminal() {
  const { id } = useParams<{ id: string }>()
  const recordId = parseInt(id || '0')

  const { data: wo, isLoading } = useQuery({
    queryKey: ['workorder-terminal', recordId],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/mrp.workorder', {
        domain: [['id', '=', recordId]],
        fields: [
          'id', 'name', 'state', 'production_id', 'workcenter_id', 'product_id',
          'qty_producing', 'qty_produced', 'qty_remaining',
          'date_start', 'date_finished', 'duration_expected', 'duration',
        ],
        limit: 1,
      })
      return data?.records?.[0] ?? null
    },
    enabled: !!recordId,
  })

  if (isLoading || !wo) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72 rounded-2xl" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="h-48 rounded-2xl" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
      </div>
    )
  }

  const state: string = wo.state || 'pending'
  const badge = STATE_BADGE[state] || { label: state, variant: 'secondary' }
  const produced = Number(wo.qty_produced ?? 0)
  const producing = Number(wo.qty_producing ?? 0)
  const pct = producing > 0 ? Math.min(100, Math.round((produced / producing) * 100)) : 0
  const isReady = state === 'ready'
  const isProgress = state === 'progress'

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <PageHeader
        title={wo.name || 'Work Order'}
        subtitle="manufacturing"
        backTo="/admin/manufacturing/workorders"
        actions={
          <Badge variant={badge.variant as any} className="rounded-full text-sm px-3 py-1">
            {badge.label}
          </Badge>
        }
      />

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InfoBlock label="Production Order" value={fmt(wo.production_id)} />
        <InfoBlock label="Work Center"      value={fmt(wo.workcenter_id)} />
        <InfoBlock label="Product"          value={fmt(wo.product_id)} />
      </div>

      {/* Progress */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Progress</p>

        <div className="flex items-end gap-3">
          <span className="text-6xl font-bold tabular-nums leading-none">{produced}</span>
          <span className="text-3xl text-muted-foreground mb-1">/ {producing}</span>
          <Package className="h-8 w-8 text-muted-foreground mb-1 ml-2" />
        </div>

        {/* Bar progress */}
        <div className="relative h-4 w-full rounded-full bg-muted/40 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              pct >= 100 ? 'bg-green-500' : 'bg-primary',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">{pct}% complete</p>
      </div>

      {/* Duration */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Timer className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Duration</p>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-[11px] text-muted-foreground mb-1">Expected</p>
            <p className="text-2xl font-semibold tabular-nums">{fmtDur(wo.duration_expected)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground mb-1">Actual</p>
            <p className={cn(
              'text-2xl font-semibold tabular-nums',
              wo.duration > wo.duration_expected && 'text-destructive',
            )}>
              {fmtDur(wo.duration)}
            </p>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {isReady && (
          <Button
            className="h-16 text-lg rounded-2xl gap-3"
            onClick={() => { /* TODO: start work order */ }}
          >
            <Play className="h-6 w-6" /> Start
          </Button>
        )}
        {isProgress && (
          <Button
            className="h-16 text-lg rounded-2xl gap-3 bg-green-600 hover:bg-green-700 text-white"
            onClick={() => { /* TODO: finish work order */ }}
          >
            <CheckCircle2 className="h-6 w-6" /> Finish
          </Button>
        )}
      </div>
    </div>
  )
}
