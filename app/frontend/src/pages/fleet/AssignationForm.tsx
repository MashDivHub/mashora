import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input, Textarea, Skeleton } from '@mashora/design-system'
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

export default function AssignationForm() {
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
    queryKey: ['fleet-assignation', recordId],
    queryFn: async () => {
      if (isNew) {
        return {
          id: null,
          date_start: new Date().toISOString().slice(0, 10),
          vehicle_id: presetVehicle ? parseInt(presetVehicle) : false,
        }
      }
      const { data } = await erpClient.raw.get(`/model/fleet.vehicle.assignation.log/${recordId}`)
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
        vehicle_id: m2oId(form.vehicle_id) || undefined,
        driver_id: m2oId(form.driver_id) || undefined,
        date_start: form.date_start || undefined,
        date_end: form.date_end || undefined,
        notes: form.notes || undefined,
      }
      if (!vals.vehicle_id) {
        toast.error('Validation Error', 'Vehicle is required')
        throw new Error('Validation failed')
      }
      if (!vals.driver_id) {
        toast.error('Validation Error', 'Driver is required')
        throw new Error('Validation failed')
      }
      if (!vals.date_start) {
        toast.error('Validation Error', 'Start date is required')
        throw new Error('Validation failed')
      }
      for (const k of Object.keys(vals)) if (vals[k] === undefined) delete vals[k]
      if (isNew) {
        const { data } = await erpClient.raw.post('/model/fleet.vehicle.assignation.log/create', { vals })
        return data
      }
      const { data } = await erpClient.raw.put(`/model/fleet.vehicle.assignation.log/${recordId}`, { vals })
      return data
    },
    onSuccess: (data) => {
      setEditing(false)
      toast.success('Saved', 'Assignment saved')
      queryClient.invalidateQueries({ queryKey: ['fleet-assignation'] })
      queryClient.invalidateQueries({ queryKey: ['fleet-assignations'] })
      if (isNew && data?.id) navigate(`/admin/fleet/assignations/${data.id}`, { replace: true })
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
      backTo="/admin/fleet/assignations"
      topContent={
        <div className="mb-2">
          <ReadonlyField
            label="Assignment"
            value={<span className="text-lg font-bold">{m2oVal(form.vehicle_id) || 'New'} {m2oVal(form.driver_id) ? `→ ${m2oVal(form.driver_id)}` : ''}</span>}
          />
        </div>
      }
      leftFields={
        <>
          <FormField label="Vehicle" required>
            {editing
              ? <M2OInput value={form.vehicle_id as [number, string] | false | null | undefined} model="fleet.vehicle" onChange={v => setField('vehicle_id', v)} />
              : <ReadonlyField label="" value={m2oVal(form.vehicle_id)} />}
          </FormField>
          <FormField label="Driver" required>
            {editing
              ? <M2OInput value={form.driver_id as [number, string] | false | null | undefined} model="res.partner" onChange={v => setField('driver_id', v)} />
              : <ReadonlyField label="" value={m2oVal(form.driver_id)} />}
          </FormField>
        </>
      }
      rightFields={
        <>
          <FormField label="Start Date" required>
            {editing
              ? <Input type="date" value={asStr(form.date_start)} onChange={e => setField('date_start', e.target.value)} className="rounded-xl h-9" />
              : <ReadonlyField label="" value={asStr(form.date_start)} />}
          </FormField>
          <FormField label="End Date">
            {editing
              ? <Input type="date" value={asStr(form.date_end)} onChange={e => setField('date_end', e.target.value || false)} className="rounded-xl h-9" />
              : <ReadonlyField label="" value={asStr(form.date_end) || 'Active'} />}
          </FormField>
        </>
      }
      tabs={[
        {
          key: 'notes', label: 'Notes',
          content: editing
            ? <FormField label="Notes"><Textarea value={asStr(form.notes)} onChange={e => setField('notes', e.target.value)} rows={6} className="rounded-xl" /></FormField>
            : <ReadonlyField label="Notes" value={asStr(form.notes)} />,
        },
      ]}
    />
  )
}
