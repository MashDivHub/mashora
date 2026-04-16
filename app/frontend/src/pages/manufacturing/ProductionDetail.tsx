import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Badge, Button, Skeleton,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@mashora/design-system'
import { CheckCircle, Play, PackageCheck, XCircle } from 'lucide-react'
import { PageHeader, StatusBar, toast } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

const PRODUCTION_STEPS = [
  { key: 'draft',     label: 'Draft' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'progress',  label: 'In Progress' },
  { key: 'done',      label: 'Done', color: 'success' as const },
]

const STATE_BADGE: Record<string, { label: string; variant: string }> = {
  draft:     { label: 'Draft',       variant: 'secondary' },
  confirmed: { label: 'Confirmed',   variant: 'info' },
  progress:  { label: 'In Progress', variant: 'warning' },
  to_close:  { label: 'To Close',   variant: 'warning' },
  done:      { label: 'Done',        variant: 'success' },
  cancel:    { label: 'Cancelled',   variant: 'destructive' },
}

const WO_STATE_BADGE: Record<string, { label: string; variant: string }> = {
  pending:  { label: 'Pending',     variant: 'secondary' },
  waiting:  { label: 'Waiting',     variant: 'secondary' },
  ready:    { label: 'Ready',       variant: 'info' },
  progress: { label: 'In Progress', variant: 'warning' },
  done:     { label: 'Done',        variant: 'success' },
  cancel:   { label: 'Cancelled',   variant: 'destructive' },
}

function StateBadge({ state, map }: { state: string; map: Record<string, { label: string; variant: string }> }) {
  const s = map[state] || { label: state, variant: 'secondary' }
  return <Badge variant={s.variant as any} className="rounded-full text-xs">{s.label}</Badge>
}

function InfoRow({ label, value }: { label: string; value?: string | null | false }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm">{value || <span className="text-muted-foreground/40">—</span>}</p>
    </div>
  )
}

export default function ProductionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const recordId = parseInt(id || '0')

  const { data: production, isLoading } = useQuery({
    queryKey: ['production', recordId],
    queryFn: async () => {
      const { data } = await erpClient.raw.get(`/manufacturing/productions/${recordId}`)
      return data
    },
    enabled: !!recordId,
  })

  const actionMut = useMutation({
    mutationFn: async (action: string) => {
      const { data } = await erpClient.raw.post(`/manufacturing/productions/${recordId}/${action}`)
      return data
    },
    onSuccess: (_, action) => {
      const labels: Record<string, string> = {
        confirm: 'Production confirmed',
        start:   'Production started',
        produce: 'Marked as done',
        cancel:  'Production cancelled',
      }
      toast.success('Success', labels[action] || 'Action completed')
      queryClient.invalidateQueries({ queryKey: ['production', recordId] })
      queryClient.invalidateQueries({ queryKey: ['productions'] })
    },
    onError: (e: any) => {
      toast.error('Action Failed', e?.response?.data?.detail || e.message || 'Unknown error')
    },
  })

  if (isLoading || !production) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-8 w-80 rounded-full" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  const state: string = production.state || 'draft'
  const isDraft     = state === 'draft'
  const isConfirmed = state === 'confirmed'
  const isProgress  = state === 'progress' || state === 'to_close'
  const isDone      = state === 'done'
  const isCancelled = state === 'cancel'

  const components: any[] = production.components || []
  const workorders: any[]  = production.workorders || []

  const fmt = (v: any) => Array.isArray(v) ? v[1] : (v || '')
  const fmtDate = (v: any) => v ? new Date(v).toLocaleDateString() : ''
  const fmtDur = (mins: number | null | undefined) => {
    if (!mins) return '—'
    const h = Math.floor(mins / 60)
    const m = Math.round(mins % 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeader
        title={production.name || 'Production Order'}
        subtitle="manufacturing"
        backTo="/admin/manufacturing/orders"
        actions={
          <div className="flex items-center gap-2">
            {isDraft && (
              <Button
                size="sm"
                className="rounded-xl gap-1.5"
                onClick={() => actionMut.mutate('confirm')}
                disabled={actionMut.isPending}
              >
                <CheckCircle className="h-3.5 w-3.5" /> Confirm
              </Button>
            )}
            {isConfirmed && (
              <Button
                size="sm"
                className="rounded-xl gap-1.5"
                onClick={() => actionMut.mutate('start')}
                disabled={actionMut.isPending}
              >
                <Play className="h-3.5 w-3.5" /> Start
              </Button>
            )}
            {isProgress && (
              <Button
                size="sm"
                className="rounded-xl gap-1.5"
                onClick={() => actionMut.mutate('produce')}
                disabled={actionMut.isPending}
              >
                <PackageCheck className="h-3.5 w-3.5" /> Mark as Done
              </Button>
            )}
            {!isDone && !isCancelled && (
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl gap-1.5 text-destructive hover:text-destructive"
                onClick={() => {
                  if (confirm('Cancel this production order?')) actionMut.mutate('cancel')
                }}
                disabled={actionMut.isPending}
              >
                <XCircle className="h-3.5 w-3.5" /> Cancel
              </Button>
            )}
          </div>
        }
      />

      {/* Status Bar */}
      <StatusBar
        steps={isCancelled
          ? [...PRODUCTION_STEPS, { key: 'cancel', label: 'Cancelled', color: 'danger' as const }]
          : PRODUCTION_STEPS}
        current={isCancelled ? 'cancel' : state}
      />

      {/* Info Card */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
        <h2 className="text-sm font-semibold mb-4">Production Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <div className="space-y-4">
            <InfoRow label="Product"     value={fmt(production.product_id)} />
            <InfoRow label="Quantity"    value={`${Number(production.product_qty || 0).toFixed(2)} ${fmt(production.product_uom_id)}`} />
            <InfoRow label="Bill of Materials" value={Array.isArray(production.bom_id) ? production.bom_id[1] : undefined} />
            <InfoRow label="Source"      value={production.origin} />
          </div>
          <div className="space-y-4">
            <InfoRow label="Start Date"  value={fmtDate(production.date_start)} />
            <InfoRow label="End Date"    value={fmtDate(production.date_finished)} />
            <InfoRow label="Responsible" value={fmt(production.user_id)} />
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</p>
              <StateBadge state={state} map={STATE_BADGE} />
            </div>
          </div>
        </div>
      </div>

      {/* Components Table */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
        <h2 className="text-sm font-semibold mb-4">Components</h2>
        <div className="rounded-xl border border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/40">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Product</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Demand</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Done</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">UoM</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {components.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">No components</TableCell>
                </TableRow>
              ) : components.map(c => (
                <TableRow key={c.id} className="border-border/30 hover:bg-muted/10">
                  <TableCell className="py-2.5 text-sm font-medium">{fmt(c.product_id)}</TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">{Number(c.product_uom_qty || 0).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">{Number(c.quantity || 0).toFixed(2)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fmt(c.product_uom_id)}</TableCell>
                  <TableCell><StateBadge state={c.state || 'draft'} map={STATE_BADGE} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Work Orders Table */}
      {workorders.length > 0 && (
        <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
          <h2 className="text-sm font-semibold mb-4">Work Orders</h2>
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/40">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Operation</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Work Center</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Expected</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Actual</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workorders.map(wo => (
                  <TableRow key={wo.id} className="border-border/30 hover:bg-muted/10">
                    <TableCell className="py-2.5 text-sm font-medium">{wo.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmt(wo.workcenter_id)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{fmtDur(wo.duration_expected)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{fmtDur(wo.duration)}</TableCell>
                    <TableCell><StateBadge state={wo.state || 'pending'} map={WO_STATE_BADGE} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
