import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Input, Button, Badge, Skeleton,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cn,
} from '@mashora/design-system'
import { CheckCircle, Printer, RotateCcw, XCircle, Truck, ArrowRight } from 'lucide-react'
import { RecordForm, FormField, ReadonlyField, StatusBar, toast, type FormTab } from '@/components/shared'
import { sanitizedHtml } from '@/lib/sanitize'
import Chatter from '@/components/Chatter'
import { erpClient } from '@/lib/erp-api'

const FORM_FIELDS = [
  'id', 'name', 'partner_id', 'state', 'picking_type_id', 'picking_type_code',
  'origin', 'scheduled_date', 'date_done', 'location_id', 'location_dest_id',
  'move_ids', 'note', 'backorder_id', 'user_id', 'company_id',
]

const MOVE_FIELDS = [
  'id', 'product_id', 'product_uom_qty', 'quantity', 'state',
  'location_id', 'location_dest_id',
]

const STATES = [
  { key: 'draft', label: 'Draft' },
  { key: 'confirmed', label: 'Waiting' },
  { key: 'assigned', label: 'Ready', color: 'success' as const },
  { key: 'done', label: 'Done', color: 'success' as const },
  { key: 'cancel', label: 'Cancelled' },
]

export default function TransferDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = id === 'new'
  const recordId = isNew ? null : parseInt(id || '0')
  const [editing, setEditing] = useState(isNew)
  const [form, setForm] = useState<Record<string, any>>({})
  const [moves, setMoves] = useState<any[]>([])

  const { data: record, isLoading } = useQuery({
    queryKey: ['transfer', recordId],
    queryFn: async () => {
      if (isNew) {
        const { data } = await erpClient.raw.post('/model/stock.picking/defaults', { fields: FORM_FIELDS })
        return { ...data, id: null, state: 'draft' }
      }
      const { data } = await erpClient.raw.get(`/model/stock.picking/${recordId}`)
      return data
    },
  })

  const { data: moveData } = useQuery({
    queryKey: ['transfer-moves', recordId],
    queryFn: async () => {
      if (!recordId) return []
      const { data } = await erpClient.raw.post('/model/stock.move', {
        domain: [['picking_id', '=', recordId]], fields: MOVE_FIELDS, order: 'id asc', limit: 200,
      })
      return data.records || []
    },
    enabled: !!recordId,
  })

  useEffect(() => { if (record) { setForm({ ...record }); setMoves(moveData || []) } }, [record, moveData])
  const setField = useCallback((n: string, v: any) => { setForm(p => ({ ...p, [n]: v })) }, [])

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {}
    const pickingTypeId = Array.isArray(form.picking_type_id) ? form.picking_type_id[0] : form.picking_type_id
    if (!pickingTypeId) errs.picking_type_id = 'Operation Type is required'
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      toast.error('Validation Error', Object.values(errs).join(', '))
      return false
    }
    return true
  }, [form])

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!validate()) throw new Error('Validation failed')
      const vals: Record<string, any> = {}
      for (const f of ['origin', 'scheduled_date', 'note']) {
        if (form[f] !== record?.[f]) vals[f] = form[f] ?? false
      }
      for (const f of ['partner_id', 'picking_type_id', 'location_id', 'location_dest_id', 'user_id']) {
        const nv = Array.isArray(form[f]) ? form[f][0] : form[f]
        const ov = Array.isArray(record?.[f]) ? record[f][0] : record?.[f]
        if (nv !== ov) vals[f] = nv || false
      }
      if (isNew) {
        const { data } = await erpClient.raw.post('/model/stock.picking/create', { vals })
        return data
      }
      const { data } = await erpClient.raw.put(`/model/stock.picking/${recordId}`, { vals })
      return data
    },
    onSuccess: (data) => {
      setEditing(false)
      setErrors({})
      toast.success('Saved', 'Transfer saved successfully')
      queryClient.invalidateQueries({ queryKey: ['transfer'] })
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
      if (isNew && data?.id) navigate(`/admin/inventory/transfers/${data.id}`, { replace: true })
    },
    onError: (e: any) => {
      if (e.message !== 'Validation failed') {
        toast.error('Save Failed', e?.response?.data?.detail || e.message || 'Unknown error')
      }
    },
  })

  const callMethod = useCallback(async (method: string) => {
    if (!validate()) return
    if (!recordId) return
    try {
      await erpClient.raw.post('/model/stock.picking/call', { record_ids: [recordId], method })
      toast.success('Action Complete', `${method.replace('action_', '').replace('button_', '').replace(/_/g, ' ')} executed`)
      queryClient.invalidateQueries({ queryKey: ['transfer', recordId] })
      queryClient.invalidateQueries({ queryKey: ['transfer-moves', recordId] })
    } catch (e: any) {
      toast.error('Action Failed', e?.response?.data?.detail || e.message || 'Unknown error')
    }
  }, [recordId, queryClient, validate])

  const [m2oResults, setM2oResults] = useState<Record<string, any[]>>({})
  const searchM2o = useCallback(async (model: string, q: string, field: string) => {
    if (!q) { setM2oResults(p => ({ ...p, [field]: [] })); return }
    try {
      const { data } = await erpClient.raw.post(`/model/${model}/name_search`, { name: q, limit: 8 })
      setM2oResults(p => ({ ...p, [field]: data.results || [] }))
    } catch { setM2oResults(p => ({ ...p, [field]: [] })) }
  }, [])

  if (isLoading || !record) {
    return <div className="space-y-4"><Skeleton className="h-10 w-full rounded-xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>
  }

  const m2oVal = (v: any) => Array.isArray(v) ? v[1] : ''
  const state = form.state || 'draft'
  const isDraft = state === 'draft'
  const isReady = state === 'assigned'
  const isDone = state === 'done'
  const isWaiting = state === 'confirmed' || state === 'waiting'

  const M2O = ({ field, model, label, required, errorMsg, onSelect }: { field: string; model: string; label: string; required?: boolean; errorMsg?: string; onSelect?: () => void }) => {
    const [open, setOpen] = useState(false)
    const [q, setQ] = useState('')
    if (!editing) return <ReadonlyField label={label} value={m2oVal(form[field])} />
    return (
      <FormField label={label} required={required}>
        <div className="relative">
          <Input value={open ? q : m2oVal(form[field])} className={`rounded-xl h-9${errorMsg ? ' ring-2 ring-red-500/50' : ''}`} autoComplete="off"
            onChange={e => { setQ(e.target.value); searchM2o(model, e.target.value, field) }}
            onFocus={() => { setQ(m2oVal(form[field])); setOpen(true) }}
            onBlur={() => setTimeout(() => setOpen(false), 200)} placeholder="Search..." />
          {open && (m2oResults[field] || []).length > 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-xl border border-border/60 bg-popover shadow-lg max-h-48 overflow-y-auto">
              {(m2oResults[field] || []).map((r: any) => (
                <button key={r.id} className="w-full px-3 py-2 text-left text-sm hover:bg-accent first:rounded-t-xl last:rounded-b-xl"
                  onMouseDown={() => { setField(field, [r.id, r.display_name]); setOpen(false); onSelect?.() }}>{r.display_name}</button>
              ))}
            </div>
          )}
        </div>
        {errorMsg && <p className="text-xs text-destructive mt-1">{errorMsg}</p>}
      </FormField>
    )
  }

  const TF = ({ field, label, type = 'text' }: { field: string; label: string; type?: string }) => {
    if (!editing) return <ReadonlyField label={label} value={form[field]} />
    return <FormField label={label}><Input type={type} value={form[field] || ''} onChange={e => setField(field, e.target.value)} className="rounded-xl h-9" /></FormField>
  }

  const MovesTable = () => (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border/40">
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider w-[35%]">Product</TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-[15%]">Demand</TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right w-[15%]">Done</TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider w-[15%]">From</TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider w-[15%]">To</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {moves.length === 0 ? (
            <TableRow><TableCell colSpan={5} className="h-20 text-center text-muted-foreground">No stock moves</TableCell></TableRow>
          ) : moves.map(move => (
            <TableRow key={move.id} className="border-border/30 hover:bg-muted/10">
              <TableCell className="py-2 text-sm font-medium">{Array.isArray(move.product_id) ? move.product_id[1] : 'Product'}</TableCell>
              <TableCell className="text-right font-mono text-sm">{Number(move.product_uom_qty || 0).toFixed(2)}</TableCell>
              <TableCell className={cn('text-right font-mono text-sm', move.quantity > 0 && 'text-emerald-400')}>{Number(move.quantity || 0).toFixed(2)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{Array.isArray(move.location_id) ? move.location_id[1] : ''}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{Array.isArray(move.location_dest_id) ? move.location_dest_id[1] : ''}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )

  const tabs: FormTab[] = [
    { key: 'moves', label: 'Operations', content: <MovesTable /> },
    {
      key: 'info', label: 'Additional Info',
      content: (
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-2">
          <div className="space-y-2">
            <M2O field="user_id" model="res.users" label="Responsible" />
            <TF field="origin" label="Source Document" />
            {form.backorder_id && <ReadonlyField label="Back Order of" value={m2oVal(form.backorder_id)} />}
          </div>
          <div className="space-y-2">
            <M2O field="location_id" model="stock.location" label="Source Location" />
            <M2O field="location_dest_id" model="stock.location" label="Destination Location" />
          </div>
        </div>
      ),
    },
    {
      key: 'note', label: 'Note',
      content: editing
        ? <FormField label="Note"><Input value={form.note || ''} onChange={e => setField('note', e.target.value)} className="rounded-xl h-9" /></FormField>
        : <ReadonlyField label="Note" value={form.note ? <span dangerouslySetInnerHTML={sanitizedHtml(form.note)} /> : undefined} />,
    },
  ]

  return (
    <RecordForm
      editing={editing} onEdit={() => !isDone && setEditing(true)} onSave={() => saveMut.mutate()}
      onDiscard={() => { if (isNew) navigate(-1); else { setForm({ ...record }); setMoves(moveData || []); setEditing(false) } }}
      backTo="/inventory/transfers"
      statusBar={<StatusBar steps={STATES.filter(s => s.key !== 'cancel' || state === 'cancel')} current={state} />}
      headerActions={
        <>
          {isWaiting && <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => callMethod('action_assign')}><CheckCircle className="h-3.5 w-3.5" /> Check Availability</Button>}
          {isReady && <Button variant="default" size="sm" className="rounded-xl gap-1.5" onClick={() => callMethod('button_validate')}><CheckCircle className="h-3.5 w-3.5" /> Validate</Button>}
          {!isDone && !isNew && <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-muted-foreground"><Printer className="h-3.5 w-3.5" /> Print</Button>}
          {isDone && <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-muted-foreground" onClick={() => callMethod('action_return')}><RotateCcw className="h-3.5 w-3.5" /> Return</Button>}
          {isDraft && recordId && <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-destructive" onClick={async () => {
            if (!confirm('Cancel this transfer?')) return
            try { await erpClient.raw.post('/model/stock.picking/call', { record_ids: [recordId], method: 'action_cancel' }); toast.success('Cancelled'); queryClient.invalidateQueries({ queryKey: ['transfer', recordId] }) }
            catch (e: any) { toast.error('Cancel Failed', e?.response?.data?.detail || e.message) }
          }}><XCircle className="h-3.5 w-3.5" /> Cancel</Button>}
        </>
      }
      topContent={
        <div className="flex items-center gap-3 mb-2">
          <ReadonlyField label="Reference" value={<span className="text-lg font-bold">{!form.name || form.name === '/' ? 'New' : form.name}</span>} />
          {form.picking_type_id && (
            <Badge variant="secondary" className="rounded-full text-xs mt-4">{m2oVal(form.picking_type_id)}</Badge>
          )}
        </div>
      }
      leftFields={
        <>
          <M2O field="partner_id" model="res.partner" label="Contact" />
          <M2O field="picking_type_id" model="stock.picking.type" label="Operation Type" required
            errorMsg={errors.picking_type_id}
            onSelect={() => setErrors(er => { const n = { ...er }; delete n.picking_type_id; return n })} />
          <TF field="origin" label="Source Document" />
        </>
      }
      rightFields={
        <>
          <TF field="scheduled_date" label="Scheduled Date" type="datetime-local" />
          {isDone && <ReadonlyField label="Done" value={form.date_done ? new Date(form.date_done).toLocaleString() : ''} />}
          <M2O field="location_id" model="stock.location" label="Source Location" />
          <M2O field="location_dest_id" model="stock.location" label="Destination" />
        </>
      }
      tabs={tabs}
      chatter={recordId ? <Chatter model="stock.picking" resId={recordId} /> : undefined}
    />
  )
}
