import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge, Button, Input, Label, Textarea, Skeleton,
  Card, CardContent,
} from '@mashora/design-system'
import { Wrench, Save, CheckCircle, Play, PackageCheck, XCircle } from 'lucide-react'
import { PageHeader, M2OInput, StatusBar, toast } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

type M2OTuple = [number, string]

// ─── Types ──────────────────────────────────────────────────────────────────

interface RepairForm {
  name: string
  partner_id: number | null
  product_id: number | null
  product_qty: number
  location_id: number | null
  lot_id: number | null
  description: string
  internal_notes: string
  schedule_date: string
}

const EMPTY: RepairForm = {
  name: '',
  partner_id: null,
  product_id: null,
  product_qty: 1,
  location_id: null,
  lot_id: null,
  description: '',
  internal_notes: '',
  schedule_date: '',
}

const STATE_BADGE: Record<string, { variant: 'secondary' | 'info' | 'warning' | 'success' | 'destructive'; label: string }> = {
  draft:        { variant: 'secondary',   label: 'Draft' },
  confirmed:    { variant: 'info',        label: 'Confirmed' },
  under_repair: { variant: 'warning',     label: 'In Repair' },
  done:         { variant: 'success',     label: 'Done' },
  cancel:       { variant: 'destructive', label: 'Cancelled' },
}

const REPAIR_STEPS = [
  { key: 'draft',        label: 'Draft' },
  { key: 'confirmed',    label: 'Confirmed' },
  { key: 'under_repair', label: 'In Repair' },
  { key: 'done',         label: 'Done', color: 'success' as const },
]

const m2oId = (v: unknown): number | null =>
  Array.isArray(v) ? Number(v[0]) : (typeof v === 'number' ? v : null)
const m2oTuple = (v: unknown): M2OTuple | false =>
  Array.isArray(v) && typeof v[0] === 'number' && typeof v[1] === 'string' ? [v[0], v[1]] : false

function toLocalInput(dt: string | null | undefined): string {
  if (!dt) return ''
  return String(dt).replace(' ', 'T').slice(0, 16)
}
function fromLocalInput(v: string): string {
  if (!v) return ''
  return v.replace('T', ' ') + (v.length === 16 ? ':00' : '')
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function RepairDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id || id === 'new'
  const recordId = isNew ? null : Number(id)

  const [form, setForm] = useState<RepairForm>(EMPTY)
  const [partner, setPartner] = useState<M2OTuple | false>(false)
  const [product, setProduct] = useState<M2OTuple | false>(false)
  const [location, setLocation] = useState<M2OTuple | false>(false)
  const [lot, setLot] = useState<M2OTuple | false>(false)
  const [state, setState] = useState<string>('draft')
  const [saving, setSaving] = useState(false)
  const [actioning, setActioning] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['repair', recordId],
    queryFn: () => erpClient.raw.get(`/repair/orders/${recordId}`).then(r => r.data),
    enabled: !!recordId,
  })

  useEffect(() => {
    if (!data) return
    setForm({
      name: data.name || '',
      partner_id: m2oId(data.partner_id),
      product_id: m2oId(data.product_id),
      product_qty: Number(data.product_qty) || 1,
      location_id: m2oId(data.location_id),
      lot_id: m2oId(data.lot_id),
      description: typeof data.description === 'string' ? data.description : '',
      internal_notes: typeof data.internal_notes === 'string' ? data.internal_notes : '',
      schedule_date: toLocalInput(data.schedule_date),
    })
    setPartner(m2oTuple(data.partner_id))
    setProduct(m2oTuple(data.product_id))
    setLocation(m2oTuple(data.location_id))
    setLot(m2oTuple(data.lot_id))
    setState(data.state || 'draft')
  }, [data])

  function set<K extends keyof RepairForm>(key: K, value: RepairForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!form.product_id) {
      toast.error('Product required', 'Please select a product to repair')
      return
    }
    setSaving(true)
    try {
      const vals: Record<string, unknown> = {
        product_id: form.product_id,
        product_qty: form.product_qty,
        description: form.description || false,
        internal_notes: form.internal_notes || false,
      }
      if (form.partner_id) vals.partner_id = form.partner_id
      if (form.location_id) vals.location_id = form.location_id
      if (form.lot_id) vals.lot_id = form.lot_id
      if (form.schedule_date) vals.schedule_date = fromLocalInput(form.schedule_date)

      if (isNew) {
        const { data: created } = await erpClient.raw.post('/repair/orders/create', vals)
        toast.success('Repair order created')
        const newId: number | undefined = created?.id || created?.record?.id
        if (newId) navigate(`/admin/repairs/${newId}`, { replace: true })
        else navigate('/admin/repairs', { replace: true })
      } else {
        await erpClient.raw.put(`/model/repair.order/${recordId}`, { vals })
        toast.success('Repair order saved')
        queryClient.invalidateQueries({ queryKey: ['repair', recordId] })
        queryClient.invalidateQueries({ queryKey: ['repairs'] })
      }
    } catch (e: unknown) {
      toast.error('Save failed', extractErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function runAction(action: 'confirm' | 'start' | 'done' | 'cancel') {
    if (!recordId) return
    setActioning(action)
    try {
      await erpClient.raw.post(`/repair/orders/${recordId}/${action}`)
      const labels: Record<string, string> = {
        confirm: 'Repair confirmed',
        start: 'Repair started',
        done: 'Repair completed',
        cancel: 'Repair cancelled',
      }
      toast.success(labels[action])
      queryClient.invalidateQueries({ queryKey: ['repair', recordId] })
      queryClient.invalidateQueries({ queryKey: ['repairs'] })
    } catch (e: unknown) {
      toast.error('Action failed', extractErrorMessage(e))
    } finally {
      setActioning(null)
    }
  }

  if (!isNew && isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!isNew && !data && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <Wrench className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium">Repair order not found.</p>
        <Button variant="outline" className="rounded-xl" onClick={() => navigate('/admin/repairs')}>
          Back to Repairs
        </Button>
      </div>
    )
  }

  const stateCfg = STATE_BADGE[state] ?? { variant: 'secondary' as const, label: state }
  const isDraft = state === 'draft'
  const isConfirmed = state === 'confirmed'
  const isUnderRepair = state === 'under_repair'
  const isDone = state === 'done'
  const isCancelled = state === 'cancel'

  return (
    <div className="space-y-6">
      <PageHeader
        title={isNew ? 'New Repair Order' : form.name || 'Repair Order'}
        subtitle="repair"
        backTo="/admin/repairs"
        actions={!isNew ? <Badge variant={stateCfg.variant}>{stateCfg.label}</Badge> : undefined}
      />

      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={handleSave} disabled={saving} className="rounded-xl gap-1.5">
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
        {!isNew && isDraft && (
          <Button size="sm" variant="outline" className="rounded-xl gap-1.5"
            onClick={() => runAction('confirm')} disabled={actioning !== null}>
            <CheckCircle className="h-3.5 w-3.5" /> Confirm
          </Button>
        )}
        {!isNew && isConfirmed && (
          <Button size="sm" variant="outline" className="rounded-xl gap-1.5"
            onClick={() => runAction('start')} disabled={actioning !== null}>
            <Play className="h-3.5 w-3.5" /> Start
          </Button>
        )}
        {!isNew && isUnderRepair && (
          <Button size="sm" variant="outline" className="rounded-xl gap-1.5"
            onClick={() => runAction('done')} disabled={actioning !== null}>
            <PackageCheck className="h-3.5 w-3.5" /> Done
          </Button>
        )}
        {!isNew && !isCancelled && !isDone && (
          <Button size="sm" variant="ghost" className="rounded-xl gap-1.5 text-destructive hover:text-destructive"
            onClick={() => { if (confirm('Cancel this repair order?')) runAction('cancel') }}
            disabled={actioning !== null}>
            <XCircle className="h-3.5 w-3.5" /> Cancel
          </Button>
        )}
      </div>

      {/* Status bar */}
      {!isNew && (
        <StatusBar
          steps={isCancelled
            ? [...REPAIR_STEPS, { key: 'cancel', label: 'Cancelled', color: 'danger' as const }]
            : REPAIR_STEPS}
          current={state}
        />
      )}

      {/* 2-column form */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Left card */}
        <Card className="rounded-2xl">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-sm font-semibold mb-1">Repair Details</h2>

            <div className="space-y-2">
              <Label htmlFor="name">Reference</Label>
              <Input
                id="name"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Auto-generated on save"
                disabled={!isNew}
              />
            </div>

            <div className="space-y-2">
              <Label>Product</Label>
              <M2OInput
                value={product}
                model="product.product"
                onChange={v => { setProduct(v); set('product_id', m2oId(v)) }}
                placeholder="Choose product..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product_qty">Quantity</Label>
              <Input
                id="product_qty"
                type="number"
                step="0.01"
                min="0"
                value={form.product_qty}
                onChange={e => set('product_qty', parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label>Customer</Label>
              <M2OInput
                value={partner}
                model="res.partner"
                onChange={v => { setPartner(v); set('partner_id', m2oId(v)) }}
                placeholder="Choose customer..."
              />
            </div>

            <div className="space-y-2">
              <Label>Lot / Serial</Label>
              <M2OInput
                value={lot}
                model="stock.lot"
                onChange={v => { setLot(v); set('lot_id', m2oId(v)) }}
                placeholder="Choose lot..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Right card */}
        <Card className="rounded-2xl">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-sm font-semibold mb-1">Logistics & Notes</h2>

            <div className="space-y-2">
              <Label>Location</Label>
              <M2OInput
                value={location}
                model="stock.location"
                onChange={v => { setLocation(v); set('location_id', m2oId(v)) }}
                placeholder="Choose location..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="schedule_date">Schedule Date</Label>
              <Input
                id="schedule_date"
                type="datetime-local"
                value={form.schedule_date}
                onChange={e => set('schedule_date', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={4}
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Customer-visible description..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="internal_notes">Internal Notes</Label>
              <Textarea
                id="internal_notes"
                rows={4}
                value={form.internal_notes}
                onChange={e => set('internal_notes', e.target.value)}
                placeholder="Internal notes for technicians..."
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
