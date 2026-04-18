import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Badge, Button, Input, Label, Skeleton,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Card, CardContent,
  type BadgeVariant,
} from '@mashora/design-system'
import {
  CheckCircle, Play, PackageCheck, XCircle, Save, Pencil, X,
  Trash2, RotateCcw, ListChecks, Clock,
} from 'lucide-react'
import { PageHeader, StatusBar, M2OInput, toast } from '@/components/shared'
import type { M2OValue } from '@/components/shared/OrderLinesEditor'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

interface ComponentLine {
  id: number
  product_id?: [number, string] | false
  product_uom_id?: [number, string] | false
  product_uom_qty?: number
  quantity?: number
  reserved_availability?: number
  state?: string
}

interface WorkOrder {
  id: number
  name: string
  workcenter_id?: [number, string] | false
  duration_expected?: number
  duration?: number
  state?: string
}

const PRODUCTION_STEPS = [
  { key: 'draft',     label: 'Draft' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'progress',  label: 'In Progress' },
  { key: 'done',      label: 'Done', color: 'success' as const },
]

const STATE_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  draft:     { label: 'Draft',       variant: 'secondary' },
  confirmed: { label: 'Confirmed',   variant: 'info' },
  progress:  { label: 'In Progress', variant: 'warning' },
  to_close:  { label: 'To Close',    variant: 'warning' },
  done:      { label: 'Done',        variant: 'success' },
  cancel:    { label: 'Cancelled',   variant: 'destructive' },
}

const WO_STATE_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  pending:  { label: 'Pending',     variant: 'secondary' },
  waiting:  { label: 'Waiting',     variant: 'secondary' },
  ready:    { label: 'Ready',       variant: 'info' },
  progress: { label: 'In Progress', variant: 'warning' },
  done:     { label: 'Done',        variant: 'success' },
  cancel:   { label: 'Cancelled',   variant: 'destructive' },
}

interface ProductionForm {
  name: string
  product_id: number | null
  product_qty: number
  date_start: string
  date_finished: string
  bom_id: number | null
  origin: string
}

const m2oId = (v: unknown): number | null =>
  Array.isArray(v) ? (v[0] as number) : (typeof v === 'number' ? v : null)
const m2oTuple = (v: unknown): [number, string] | false =>
  Array.isArray(v) ? (v as [number, string]) : false

function toLocalInput(dt: string | null | undefined | false): string {
  if (!dt) return ''
  return String(dt).replace(' ', 'T').slice(0, 16)
}
function fromLocalInput(v: string): string {
  if (!v) return ''
  return v.replace('T', ' ') + (v.length === 16 ? ':00' : '')
}

function StateBadge({ state, map }: { state: string; map: Record<string, { label: string; variant: BadgeVariant }> }) {
  const s = map[state] || { label: state, variant: 'secondary' as BadgeVariant }
  return <Badge variant={s.variant} className="rounded-full text-xs">{s.label}</Badge>
}

function InfoRow({ label, value }: { label: string; value?: string | null | false | React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="text-sm">{value || <span className="text-muted-foreground/40">—</span>}</div>
    </div>
  )
}

export default function ProductionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const recordId = parseInt(id || '0')

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<ProductionForm>({
    name: '', product_id: null, product_qty: 1,
    date_start: '', date_finished: '', bom_id: null, origin: '',
  })
  const [product, setProduct] = useState<M2OValue>(false)
  const [bom, setBom] = useState<M2OValue>(false)
  const [saving, setSaving] = useState(false)

  const { data: production, isLoading } = useQuery({
    queryKey: ['production', recordId],
    queryFn: async () => {
      const { data } = await erpClient.raw.get(`/manufacturing/productions/${recordId}`)
      return data
    },
    enabled: !!recordId,
  })

  useEffect(() => {
    if (!production) return
    setForm({
      name: production.name || '',
      product_id: m2oId(production.product_id),
      product_qty: Number(production.product_qty) || 1,
      date_start: toLocalInput(production.date_start || production.date_planned_start),
      date_finished: toLocalInput(production.date_finished || production.date_planned_finished),
      bom_id: m2oId(production.bom_id),
      origin: production.origin || '',
    })
    setProduct(m2oTuple(production.product_id))
    setBom(m2oTuple(production.bom_id))
  }, [production])

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
    onError: (e: unknown) => {
      toast.error('Action Failed', extractErrorMessage(e))
    },
  })

  // Generic action via raw model methods (for plan/unreserve/validate/draft/delete)
  const rawActionMut = useMutation({
    mutationFn: async ({ method, label }: { method: string; label: string }) => {
      // Try to call the model method via /model/<model>/<id>/<method>
      const { data } = await erpClient.raw.post(`/model/mrp.production/${recordId}/${method}`, {})
      return { data, label }
    },
    onSuccess: ({ label }) => {
      toast.success('Success', label)
      queryClient.invalidateQueries({ queryKey: ['production', recordId] })
      queryClient.invalidateQueries({ queryKey: ['productions'] })
    },
    onError: (e: unknown) => {
      toast.error('Action Failed', extractErrorMessage(e))
    },
  })

  const deleteMut = useMutation({
    mutationFn: async () => {
      await erpClient.raw.delete(`/model/mrp.production/${recordId}`)
    },
    onSuccess: () => {
      toast.success('Production deleted')
      queryClient.invalidateQueries({ queryKey: ['productions'] })
      navigate('/admin/manufacturing/orders')
    },
    onError: (e: unknown) => {
      toast.error('Delete Failed', extractErrorMessage(e))
    },
  })

  function set<K extends keyof ProductionForm>(key: K, value: ProductionForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!form.product_id) {
      toast.error('Product required')
      return
    }
    setSaving(true)
    try {
      const vals: Record<string, unknown> = {
        product_id: form.product_id,
        product_qty: form.product_qty,
        origin: form.origin || false,
      }
      if (form.bom_id) vals.bom_id = form.bom_id
      if (form.date_start) vals.date_start = fromLocalInput(form.date_start)
      if (form.date_finished) vals.date_finished = fromLocalInput(form.date_finished)

      await erpClient.raw.put(`/model/mrp.production/${recordId}`, { vals })
      toast.success('Production saved')
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['production', recordId] })
    } catch (e: unknown) {
      toast.error('Save failed', extractErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

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
  const isProgress  = state === 'progress'
  const isToClose   = state === 'to_close'
  const isDone      = state === 'done'
  const isCancelled = state === 'cancel'

  const components: ComponentLine[] = production.components || []
  const workorders: WorkOrder[] = production.workorders || []

  const fmt = (v: unknown): string => Array.isArray(v) ? String(v[1]) : (v ? String(v) : '')
  const fmtDate = (v: unknown): string => v ? new Date(v as string).toLocaleDateString() : ''
  const fmtDur = (mins: number | null | undefined) => {
    if (!mins) return '—'
    const h = Math.floor(mins / 60)
    const m = Math.round(mins % 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  // State-aware action buttons
  const actionButtons = (
    <div className="flex items-center gap-2 flex-wrap">
      {isDraft && (
        <>
          <Button size="sm" className="rounded-xl gap-1.5"
            onClick={() => actionMut.mutate('confirm')}
            disabled={actionMut.isPending}>
            <CheckCircle className="h-3.5 w-3.5" /> Confirm
          </Button>
          <Button size="sm" variant="ghost" className="rounded-xl gap-1.5 text-destructive hover:text-destructive"
            onClick={() => { if (confirm('Delete this production order?')) deleteMut.mutate() }}
            disabled={deleteMut.isPending}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </>
      )}
      {isConfirmed && (
        <>
          <Button size="sm" variant="outline" className="rounded-xl gap-1.5"
            onClick={() => rawActionMut.mutate({ method: 'action_assign', label: 'Plan completed' })}
            disabled={rawActionMut.isPending}>
            <ListChecks className="h-3.5 w-3.5" /> Plan
          </Button>
          <Button size="sm" className="rounded-xl gap-1.5"
            onClick={() => actionMut.mutate('start')}
            disabled={actionMut.isPending}>
            <Play className="h-3.5 w-3.5" /> Start
          </Button>
        </>
      )}
      {isProgress && (
        <>
          <Button size="sm" className="rounded-xl gap-1.5"
            onClick={() => actionMut.mutate('produce')}
            disabled={actionMut.isPending}>
            <PackageCheck className="h-3.5 w-3.5" /> Mark as Done
          </Button>
          <Button size="sm" variant="outline" className="rounded-xl gap-1.5"
            onClick={() => rawActionMut.mutate({ method: 'do_unreserve', label: 'Unreserved' })}
            disabled={rawActionMut.isPending}>
            <RotateCcw className="h-3.5 w-3.5" /> Unreserve
          </Button>
        </>
      )}
      {isToClose && (
        <Button size="sm" className="rounded-xl gap-1.5"
          onClick={() => actionMut.mutate('produce')}
          disabled={actionMut.isPending}>
          <CheckCircle className="h-3.5 w-3.5" /> Validate
        </Button>
      )}
      {isCancelled && (
        <Button size="sm" variant="outline" className="rounded-xl gap-1.5"
          onClick={() => rawActionMut.mutate({ method: 'action_cancel', label: 'Set to draft' })}
          disabled={rawActionMut.isPending}>
          <Clock className="h-3.5 w-3.5" /> Set to Draft
        </Button>
      )}
      {!isDone && !isCancelled && (
        <Button
          variant="ghost" size="sm"
          className="rounded-xl gap-1.5 text-destructive hover:text-destructive"
          onClick={() => { if (confirm('Cancel this production order?')) actionMut.mutate('cancel') }}
          disabled={actionMut.isPending}
        >
          <XCircle className="h-3.5 w-3.5" /> Cancel
        </Button>
      )}
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeader
        title={production.name || 'Production Order'}
        subtitle="manufacturing"
        backTo="/admin/manufacturing/orders"
        actions={
          <div className="flex items-center gap-2">
            {!isDone && !editing && (
              <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
            {editing && (
              <>
                <Button size="sm" className="rounded-xl gap-1.5" onClick={handleSave} disabled={saving}>
                  <Save className="h-3.5 w-3.5" /> {saving ? 'Saving...' : 'Save'}
                </Button>
                <Button size="sm" variant="ghost" className="rounded-xl gap-1.5" onClick={() => setEditing(false)}>
                  <X className="h-3.5 w-3.5" /> Cancel
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* State actions */}
      {!editing && actionButtons}

      {/* Status Bar */}
      <StatusBar
        steps={isCancelled
          ? [...PRODUCTION_STEPS, { key: 'cancel', label: 'Cancelled', color: 'danger' as const }]
          : PRODUCTION_STEPS}
        current={isCancelled ? 'cancel' : (isToClose ? 'progress' : state)}
      />

      {/* Info / Edit Card */}
      {editing ? (
        <Card className="rounded-2xl">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-sm font-semibold mb-1">Edit Production Order</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Reference</Label>
                <Input id="name" value={form.name} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="origin">Source</Label>
                <Input id="origin" value={form.origin} onChange={e => set('origin', e.target.value)} placeholder="SO123" />
              </div>
              <div className="space-y-2">
                <Label>Product</Label>
                <M2OInput
                  value={product}
                  model="product.product"
                  onChange={v => { setProduct(v); set('product_id', m2oId(v)) }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product_qty">Quantity</Label>
                <Input id="product_qty" type="number" step="0.01" min="0"
                  value={form.product_qty}
                  onChange={e => set('product_qty', parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label>Bill of Materials</Label>
                <M2OInput
                  value={bom}
                  model="mrp.bom"
                  onChange={v => { setBom(v); set('bom_id', m2oId(v)) }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_start">Planned Start</Label>
                <Input id="date_start" type="datetime-local"
                  value={form.date_start}
                  onChange={e => set('date_start', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_finished">Planned Finish</Label>
                <Input id="date_finished" type="datetime-local"
                  value={form.date_finished}
                  onChange={e => set('date_finished', e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
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
              <InfoRow label="Status" value={<StateBadge state={state} map={STATE_BADGE} />} />
            </div>
          </div>
        </div>
      )}

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
