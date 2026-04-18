import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input, Textarea, Button, Skeleton } from '@mashora/design-system'
import { CheckCircle, XCircle, RotateCcw, FileText } from 'lucide-react'
import {
  RecordForm, FormField, ReadonlyField, StatusBar, M2OInput,
  toast, type FormTab, type StatusStep,
} from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

const STATES: StatusStep[] = [
  { key: 'futur', label: 'New' },
  { key: 'open', label: 'Active', color: 'success' },
  { key: 'expired', label: 'Expired', color: 'danger' },
  { key: 'closed', label: 'Closed' },
]

const FREQUENCIES = [
  { value: 'no', label: 'No' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id || id === 'new'
  const recordId = isNew ? null : parseInt(id || '0')
  const [editing, setEditing] = useState(isNew)
  const [form, setForm] = useState<Record<string, unknown>>({})

  const { data: record, isLoading } = useQuery({
    queryKey: ['fleet-contract', recordId],
    queryFn: async () => {
      if (isNew) {
        return {
          id: null,
          state: 'futur',
          cost_frequency: 'no',
          start_date: new Date().toISOString().slice(0, 10),
        }
      }
      const { data } = await erpClient.raw.get(`/model/fleet.vehicle.log.contract/${recordId}`)
      return data
    },
  })

  useEffect(() => { if (record) setForm({ ...record }) }, [record])

  const setField = useCallback((n: string, v: unknown) => {
    setForm(p => ({ ...p, [n]: v }))
  }, [])

  const m2oId = (v: unknown): number | null => Array.isArray(v) ? ((v[0] as number) ?? null) : (typeof v === 'number' ? v : null)
  const m2oVal = (v: unknown): string => (Array.isArray(v) ? String(v[1] ?? '') : '')
  const asStr = (v: unknown): string => (v == null || v === false ? '' : String(v))

  const saveMut = useMutation({
    mutationFn: async () => {
      const vals: Record<string, unknown> = {
        name: form.name || undefined,
        vehicle_id: m2oId(form.vehicle_id) || undefined,
        insurer_id: m2oId(form.insurer_id) || undefined,
        purchaser_id: m2oId(form.purchaser_id) || undefined,
        start_date: form.start_date || undefined,
        expiration_date: form.expiration_date || undefined,
        cost_amount: form.cost_amount || undefined,
        cost_frequency: form.cost_frequency || undefined,
        notes: form.notes || undefined,
        insurance_company: form.insurance_company || undefined,
      }
      if (!vals.vehicle_id) {
        toast.error('Validation Error', 'Vehicle is required')
        throw new Error('Validation failed')
      }
      if (!vals.start_date) {
        toast.error('Validation Error', 'Start date is required')
        throw new Error('Validation failed')
      }
      for (const k of Object.keys(vals)) if (vals[k] === undefined) delete vals[k]
      if (isNew) {
        const { data } = await erpClient.raw.post('/model/fleet.vehicle.log.contract/create', { vals })
        return data
      }
      const { data } = await erpClient.raw.put(`/model/fleet.vehicle.log.contract/${recordId}`, { vals })
      return data
    },
    onSuccess: (data) => {
      setEditing(false)
      toast.success('Saved', 'Contract saved')
      queryClient.invalidateQueries({ queryKey: ['fleet-contract'] })
      queryClient.invalidateQueries({ queryKey: ['fleet-contracts'] })
      if (isNew && data?.id) navigate(`/admin/fleet/contracts/${data.id}`, { replace: true })
    },
    onError: (e: unknown) => {
      if (!(e instanceof Error && e.message === 'Validation failed')) {
        toast.error('Save Failed', extractErrorMessage(e))
      }
    },
  })

  const setStateMut = useMutation({
    mutationFn: async (newState: string) => {
      if (!recordId) throw new Error('No record')
      const { data } = await erpClient.raw.put(`/model/fleet.vehicle.log.contract/${recordId}`, {
        vals: { state: newState },
      })
      return data
    },
    onSuccess: (_d, newState) => {
      toast.success('Updated', `Contract set to ${newState}`)
      queryClient.invalidateQueries({ queryKey: ['fleet-contract', recordId] })
    },
    onError: (e: unknown) => toast.error('Action Failed', extractErrorMessage(e)),
  })

  if (isLoading || !record) {
    return <div className="space-y-4"><Skeleton className="h-10 w-full rounded-xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>
  }

  const state = form.state || 'futur'

  const tabs: FormTab[] = [
    {
      key: 'general', label: 'General',
      content: (
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-3">
          <div className="space-y-3">
            <FormField label="Insurance Company">
              {editing
                ? <Input value={asStr(form.insurance_company)} onChange={e => setField('insurance_company', e.target.value)} className="rounded-xl h-9" />
                : <ReadonlyField label="" value={asStr(form.insurance_company)} />}
            </FormField>
            <FormField label="Purchaser">
              {editing
                ? <M2OInput value={form.purchaser_id as [number, string] | false | null} model="res.partner" onChange={v => setField('purchaser_id', v)} />
                : <ReadonlyField label="" value={m2oVal(form.purchaser_id)} />}
            </FormField>
          </div>
          <div className="space-y-3">
            <FormField label="Cost Frequency">
              {editing ? (
                <select
                  value={asStr(form.cost_frequency) || 'no'}
                  onChange={e => setField('cost_frequency', e.target.value)}
                  className="w-full rounded-xl h-9 border border-input bg-background px-3 text-sm"
                >
                  {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              ) : (
                <ReadonlyField label="" value={FREQUENCIES.find(f => f.value === form.cost_frequency)?.label || asStr(form.cost_frequency)} />
              )}
            </FormField>
            <FormField label="Cost Amount">
              {editing
                ? <Input type="number" step="0.01" value={form.cost_amount == null ? '' : Number(form.cost_amount)} onChange={e => setField('cost_amount', parseFloat(e.target.value) || 0)} className="rounded-xl h-9" />
                : <ReadonlyField label="" value={form.cost_amount != null ? `$${Number(form.cost_amount).toFixed(2)}` : ''} />}
            </FormField>
          </div>
        </div>
      ),
    },
    {
      key: 'notes', label: 'Notes',
      content: editing
        ? <FormField label="Notes"><Textarea value={asStr(form.notes)} onChange={e => setField('notes', e.target.value)} rows={6} className="rounded-xl" /></FormField>
        : <ReadonlyField label="Notes" value={asStr(form.notes)} />,
    },
  ]

  return (
    <RecordForm
      editing={editing}
      onEdit={() => setEditing(true)}
      onSave={() => saveMut.mutate()}
      onDiscard={() => { if (isNew) navigate(-1); else { setForm({ ...record }); setEditing(false) } }}
      backTo="/admin/fleet/contracts"
      statusBar={<StatusBar steps={STATES} current={String(state)} />}
      headerActions={
        <>
          {state !== 'open' && recordId && (
            <Button variant="default" size="sm" className="rounded-xl gap-1.5" onClick={() => setStateMut.mutate('open')} disabled={setStateMut.isPending}>
              <CheckCircle className="h-3.5 w-3.5" /> Activate
            </Button>
          )}
          {state === 'open' && recordId && (
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => setStateMut.mutate('expired')} disabled={setStateMut.isPending}>
              <XCircle className="h-3.5 w-3.5" /> Mark Expired
            </Button>
          )}
          {state !== 'closed' && recordId && (
            <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-muted-foreground" onClick={() => setStateMut.mutate('closed')} disabled={setStateMut.isPending}>
              <FileText className="h-3.5 w-3.5" /> Close
            </Button>
          )}
          {state === 'closed' && recordId && (
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => setStateMut.mutate('futur')} disabled={setStateMut.isPending}>
              <RotateCcw className="h-3.5 w-3.5" /> Reopen
            </Button>
          )}
        </>
      }
      topContent={
        <div className="mb-2">
          <ReadonlyField label="Reference" value={<span className="text-lg font-bold">{asStr(form.name) || 'New Contract'}</span>} />
        </div>
      }
      leftFields={
        <>
          <FormField label="Reference">
            {editing
              ? <Input value={asStr(form.name)} onChange={e => setField('name', e.target.value)} className="rounded-xl h-9" />
              : <ReadonlyField label="" value={asStr(form.name)} />}
          </FormField>
          <FormField label="Vehicle" required>
            {editing
              ? <M2OInput value={form.vehicle_id as [number, string] | false | null} model="fleet.vehicle" onChange={v => setField('vehicle_id', v)} />
              : <ReadonlyField label="" value={m2oVal(form.vehicle_id)} />}
          </FormField>
          <FormField label="Insurer">
            {editing
              ? <M2OInput value={form.insurer_id as [number, string] | false | null} model="res.partner" onChange={v => setField('insurer_id', v)} />
              : <ReadonlyField label="" value={m2oVal(form.insurer_id)} />}
          </FormField>
        </>
      }
      rightFields={
        <>
          <FormField label="Start Date" required>
            {editing
              ? <Input type="date" value={asStr(form.start_date)} onChange={e => setField('start_date', e.target.value)} className="rounded-xl h-9" />
              : <ReadonlyField label="" value={asStr(form.start_date)} />}
          </FormField>
          <FormField label="Expiration Date">
            {editing
              ? <Input type="date" value={asStr(form.expiration_date)} onChange={e => setField('expiration_date', e.target.value || false)} className="rounded-xl h-9" />
              : <ReadonlyField label="" value={asStr(form.expiration_date)} />}
          </FormField>
          <ReadonlyField label="Days Left" value={form.days_left != null ? `${Number(form.days_left)} days` : '—'} />
        </>
      }
      tabs={tabs}
    />
  )
}
