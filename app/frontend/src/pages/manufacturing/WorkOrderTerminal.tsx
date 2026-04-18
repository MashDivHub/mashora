import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Input, Skeleton, cn, type BadgeVariant } from '@mashora/design-system'
import { Pause, Play, CheckCircle2, Timer, Package } from 'lucide-react'
import { PageHeader, toast } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

const STATE_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
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

function fmt(v: unknown): string {
  if (Array.isArray(v)) return String(v[1] ?? '')
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return ''
}

function fmtElapsed(seconds: number) {
  if (seconds < 0) seconds = 0
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
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
  const queryClient = useQueryClient()
  const [qtyInput, setQtyInput] = useState<string>('')

  const { data: wo, isLoading } = useQuery({
    queryKey: ['workorder', recordId],
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

  const state: string = wo?.state || 'pending'
  const isProgress = state === 'progress'

  // Live timer that ticks each second while state == 'progress'
  const [now, setNow] = useState<number>(() => Date.now())
  useEffect(() => {
    if (!isProgress) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [isProgress])

  const startMut = useMutation({
    mutationFn: async () => { await erpClient.raw.post(`/manufacturing/workorders/${recordId}/start`) },
    onSuccess: () => {
      toast.success('Work order started')
      queryClient.invalidateQueries({ queryKey: ['workorder', recordId] })
    },
    onError: (e: unknown) => toast.error(extractErrorMessage(e, 'Start failed')),
  })

  const pauseMut = useMutation({
    mutationFn: async () => { await erpClient.raw.post(`/manufacturing/workorders/${recordId}/pause`) },
    onSuccess: () => {
      toast.success('Paused')
      queryClient.invalidateQueries({ queryKey: ['workorder', recordId] })
    },
    onError: (e: unknown) => toast.error(extractErrorMessage(e, 'Pause failed')),
  })

  const finishMut = useMutation({
    mutationFn: async (qty?: number) => {
      await erpClient.raw.post(
        `/manufacturing/workorders/${recordId}/finish`,
        qty != null ? { qty_produced: qty } : {},
      )
    },
    onSuccess: () => {
      toast.success('Work order completed')
      queryClient.invalidateQueries({ queryKey: ['workorder', recordId] })
    },
    onError: (e: unknown) => toast.error(extractErrorMessage(e, 'Finish failed')),
  })

  if (isLoading || !wo) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="h-48 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
      </div>
    )
  }

  const badge = STATE_BADGE[state] || { label: state, variant: 'secondary' as BadgeVariant }
  const produced = Number(wo.qty_produced ?? 0)
  const producing = Number(wo.qty_producing ?? 0)
  const pct = producing > 0 ? Math.min(100, Math.round((produced / producing) * 100)) : 0
  const isReady = state === 'ready' || state === 'pending' || state === 'waiting'

  // Compute elapsed time since date_start when in progress
  let elapsedSec = 0
  if (isProgress && wo.date_start) {
    const start = new Date(wo.date_start).getTime()
    if (!isNaN(start)) elapsedSec = Math.max(0, Math.floor((now - start) / 1000))
  }

  const onFinishClick = () => {
    const trimmed = qtyInput.trim()
    if (trimmed === '') {
      finishMut.mutate(undefined)
      return
    }
    const parsed = Number(trimmed)
    if (Number.isNaN(parsed) || parsed < 0) {
      toast.error('Invalid quantity')
      return
    }
    finishMut.mutate(parsed)
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <PageHeader
        title={wo.name || 'Work Order'}
        subtitle="manufacturing"
        backTo="/admin/manufacturing/workorders"
        actions={
          <Badge variant={badge.variant} className="rounded-full text-sm px-3 py-1">
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

      {/* Live elapsed timer (only while in progress) */}
      {isProgress && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Elapsed</p>
          <p className="text-5xl font-bold tabular-nums leading-none">{fmtElapsed(elapsedSec)}</p>
        </div>
      )}

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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
      <div className="space-y-3">
        {isReady && (
          <Button
            className="w-full h-16 text-lg rounded-2xl gap-3"
            onClick={() => startMut.mutate()}
            disabled={startMut.isPending}
          >
            <Play className="h-6 w-6" /> Start
          </Button>
        )}

        {isProgress && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-16 text-lg rounded-2xl gap-3"
              onClick={() => pauseMut.mutate()}
              disabled={pauseMut.isPending}
            >
              <Pause className="h-6 w-6" /> Pause
            </Button>

            <div className="flex items-stretch gap-2">
              <Input
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                placeholder={`Qty (${producing || 0})`}
                value={qtyInput}
                onChange={(e) => setQtyInput(e.target.value)}
                className="h-16 rounded-2xl text-lg text-center w-28"
              />
              <Button
                className="h-16 flex-1 text-lg rounded-2xl gap-3 bg-green-600 hover:bg-green-700 text-white"
                onClick={onFinishClick}
                disabled={finishMut.isPending}
              >
                <CheckCircle2 className="h-6 w-6" /> Finish
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
