import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input, Skeleton } from '@mashora/design-system'
import {
  RecordForm, FormField, ReadonlyField, M2OInput, toast,
} from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

const asStr = (v: unknown): string => {
  if (v == null || v === false) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return ''
}

const UNITS = [
  { value: 'kilometers', label: 'Kilometers' },
  { value: 'miles', label: 'Miles' },
]

export default function OdometerForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const isNew = !id || id === 'new'
  const recordId = isNew ? null : parseInt(id || '0')
  const presetVehicle = searchParams.get('vehicle')
  const [editing, setEditing] = useState(isNew)
  const [form, setForm] = useState<Record<string, unknown>>({})

  const { data: record, isLoading } = useQuery({
    queryKey: ['fleet-odometer', recordId],
    queryFn: async () => {
      if (isNew) {
        return {
          id: null,
          date: new Date().toISOString().slice(0, 10),
          unit: 'kilometers',
          value: 0,
          vehicle_id: presetVehicle ? parseInt(presetVehicle) : false,
        }
      }
      const { data } = await erpClient.raw.get(`/model/fleet.vehicle.odometer/${recordId}`)
      return data
    },
  })

  useEffect(() => { if (record) setForm({ ...record }) }, [record])

  const setField = useCallback((n: string, v: unknown) => { setForm(p => ({ ...p, [n]: v })) }, [])
  const m2oId = (v: unknown): number | null => Array.isArray(v) ? Number(v[0]) : (typeof v === 'number' ? v : null)
  const m2oVal = (v: unknown): string => Array.isArray(v) ? String(v[1] ?? '') : ''

  const saveMut = useMutation({
    mutationFn: async () => {
      const vals: Record<string, unknown> = {
        name: form.name || undefined,
        vehicle_id: m2oId(form.vehicle_id) || undefined,
        driver_id: m2oId(form.driver_id) || undefined,
        date: form.date || undefined,
        value: form.value != null ? Number(form.value) : undefined,
        unit: form.unit || undefined,
      }
      if (!vals.vehicle_id) {
        toast.error('Validation Error', 'Vehicle is required')
        throw new Error('Validation failed')
      }
      if (vals.value == null) {
        toast.error('Validation Error', 'Reading is required')
        throw new Error('Validation failed')
      }
      for (const k of Object.keys(vals)) if (vals[k] === undefined) delete vals[k]
      if (isNew) {
        const { data } = await erpClient.raw.post('/model/fleet.vehicle.odometer/create', { vals })
        return data
      }
      const { data } = await erpClient.raw.put(`/model/fleet.vehicle.odometer/${recordId}`, { vals })
      return data
    },
    onSuccess: (data) => {
      setEditing(false)
      toast.success('Saved', 'Odometer reading saved')
      queryClient.invalidateQueries({ queryKey: ['fleet-odometer'] })
      if (isNew && data?.id) navigate(`/admin/fleet/odometer/${data.id}`, { replace: true })
    },
    onError: (e: unknown) => {
      if (e instanceof Error && e.message === 'Validation failed') return
      toast.error('Save Failed', extractErrorMessage(e))
    },
  })

  if (isLoading || !record) {
    return <div className="space-y-4"><Skeleton className="h-10 w-full rounded-xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>
  }

  return (
    <RecordForm
      editing={editing}
      onEdit={() => setEditing(true)}
      onSave={() => saveMut.mutate()}
      onDiscard={() => { if (isNew) navigate(-1); else { setForm({ ...record }); setEditing(false) } }}
      backTo="/admin/fleet/odometer"
      topContent={
        <div className="mb-2">
          <ReadonlyField label="Reading" value={<span className="text-lg font-bold">{form.value != null ? Number(form.value as number | string).toLocaleString() : 'New'}</span>} />
        </div>
      }
      leftFields={
        <>
          <FormField label="Vehicle" required>
            {editing
              ? <M2OInput value={form.vehicle_id as [number, string] | false | null | undefined} model="fleet.vehicle" onChange={v => setField('vehicle_id', v)} />
              : <ReadonlyField label="" value={m2oVal(form.vehicle_id)} />}
          </FormField>
          <FormField label="Driver">
            {editing
              ? <M2OInput value={form.driver_id as [number, string] | false | null | undefined} model="res.partner" onChange={v => setField('driver_id', v)} />
              : <ReadonlyField label="" value={m2oVal(form.driver_id)} />}
          </FormField>
          <FormField label="Description">
            {editing
              ? <Input value={asStr(form.name)} onChange={e => setField('name', e.target.value)} className="rounded-xl h-9" />
              : <ReadonlyField label="" value={asStr(form.name)} />}
          </FormField>
        </>
      }
      rightFields={
        <>
          <FormField label="Date" required>
            {editing
              ? <Input type="date" value={asStr(form.date)} onChange={e => setField('date', e.target.value)} className="rounded-xl h-9" />
              : <ReadonlyField label="" value={asStr(form.date)} />}
          </FormField>
          <FormField label="Reading" required>
            {editing
              ? <Input type="number" step="0.01" value={form.value == null ? '' : asStr(form.value)} onChange={e => setField('value', parseFloat(e.target.value) || 0)} className="rounded-xl h-9" />
              : <ReadonlyField label="" value={form.value != null ? Number(form.value as number | string).toLocaleString() : ''} />}
          </FormField>
          <FormField label="Unit">
            {editing ? (
              <select
                value={asStr(form.unit) || 'kilometers'}
                onChange={e => setField('unit', e.target.value)}
                className="w-full rounded-xl h-9 border border-input bg-background px-3 text-sm"
              >
                {UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            ) : (
              <ReadonlyField label="" value={UNITS.find(u => u.value === form.unit)?.label || asStr(form.unit)} />
            )}
          </FormField>
        </>
      }
    />
  )
}
