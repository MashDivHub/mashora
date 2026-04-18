import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Input, Skeleton, Badge } from '@mashora/design-system'
import {
  RecordForm, FormField, ReadonlyField, StatusBar, DataTable, toast, type FormTab,
} from '@/components/shared'
import type { Column } from '@/components/shared/DataTable'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'
import { Check, X, RotateCcw, FileText } from 'lucide-react'

const STATUS_STEPS = [
  { key: 'draft', label: 'Draft' },
  { key: 'verify', label: 'To Approve' },
  { key: 'done', label: 'Done', color: 'success' as const },
]

interface PayslipRow {
  id: number
  name: string
  number: string | false
  employee_id: [number, string] | false
  state: string
  net_wage: number | false
}

const STATE_BADGES: Record<string, string> = {
  draft: 'bg-zinc-500/10 text-zinc-500',
  verify: 'bg-amber-500/10 text-amber-600',
  done: 'bg-emerald-500/10 text-emerald-600',
  cancel: 'bg-red-500/10 text-red-600',
}

export default function PayslipBatchDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id || id === 'new'
  const recordId = isNew ? null : parseInt(id || '0')
  const [editing, setEditing] = useState(isNew)
  const [form, setForm] = useState<Record<string, unknown>>({})
  const asStr = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: record, isLoading } = useQuery({
    queryKey: ['payslip-batch', recordId],
    queryFn: async () => {
      if (isNew) {
        return { id: null, state: 'draft', name: '', date_start: '', date_end: '' }
      }
      const { data } = await erpClient.raw.get(`/model/hr.payslip.run/${recordId}`)
      return data
    },
  })

  const { data: payslips } = useQuery({
    queryKey: ['payslip-batch-children', recordId],
    enabled: !isNew && !!recordId,
    queryFn: () =>
      erpClient.raw
        .post('/model/hr.payslip', {
          domain: [['payslip_run_id', '=', recordId]],
          fields: ['id', 'name', 'number', 'employee_id', 'state', 'net_wage'],
          limit: 200,
        })
        .then((r) => r.data),
  })

  useEffect(() => { if (record) setForm({ ...record }) }, [record])
  const setField = useCallback((n: string, v: unknown) => { setForm((p) => ({ ...p, [n]: v })) }, [])

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {}
    if (!asStr(form.name).trim()) errs.name = 'Name is required'
    if (!form.date_start) errs.date_start = 'Start date required'
    if (!form.date_end) errs.date_end = 'End date required'
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
      const vals: Record<string, unknown> = {}
      for (const f of ['name', 'date_start', 'date_end']) {
        if (form[f] !== record?.[f]) vals[f] = form[f] ?? false
      }
      if (isNew) {
        const { data } = await erpClient.raw.post('/model/hr.payslip.run/create', {
          vals: { name: form.name, date_start: form.date_start, date_end: form.date_end, ...vals },
        })
        return data
      }
      const { data } = await erpClient.raw.put(`/model/hr.payslip.run/${recordId}`, { vals })
      return data
    },
    onSuccess: (data) => {
      setEditing(false)
      setErrors({})
      toast.success('Saved', 'Batch saved')
      queryClient.invalidateQueries({ queryKey: ['payslip-batch'] })
      queryClient.invalidateQueries({ queryKey: ['hr-payslip-batches'] })
      if (isNew && data?.id) navigate(`/admin/hr/payslip-batches/${data.id}`, { replace: true })
    },
    onError: (e: unknown) => {
      if (e instanceof Error && e.message === 'Validation failed') return
      toast.error('Save Failed', extractErrorMessage(e))
    },
  })

  const setStateMut = useMutation({
    mutationFn: async (newState: string) => {
      const { data } = await erpClient.raw.put(`/model/hr.payslip.run/${recordId}`, { vals: { state: newState } })
      return data
    },
    onSuccess: (_d, newState) => {
      toast.success('Updated', `Batch set to ${newState}`)
      queryClient.invalidateQueries({ queryKey: ['payslip-batch', recordId] })
      queryClient.invalidateQueries({ queryKey: ['hr-payslip-batches'] })
    },
    onError: (e: unknown) => toast.error('Error', extractErrorMessage(e)),
  })

  if (isLoading || !record) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  const state = asStr(form.state) || 'draft'
  const records: PayslipRow[] = payslips?.records ?? []

  const stateActions = !isNew && !editing ? (
    <>
      {state === 'draft' && (
        <Button size="sm" className="rounded-xl gap-1.5" onClick={() => setStateMut.mutate('verify')} disabled={setStateMut.isPending}>
          <Check className="h-3.5 w-3.5" /> Confirm
        </Button>
      )}
      {state === 'verify' && (
        <Button size="sm" className="rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => setStateMut.mutate('done')} disabled={setStateMut.isPending}>
          <Check className="h-3.5 w-3.5" /> Mark Done
        </Button>
      )}
      {state !== 'draft' && (
        <Button size="sm" variant="outline" className="rounded-xl gap-1.5"
          onClick={() => setStateMut.mutate('draft')} disabled={setStateMut.isPending}>
          <RotateCcw className="h-3.5 w-3.5" /> Reset to Draft
        </Button>
      )}
      <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={() => navigate('/admin/hr/payslips/new')}>
        <FileText className="h-3.5 w-3.5" /> Add Payslip
      </Button>
    </>
  ) : null

  const TF = ({ field, label, type = 'text' }: { field: string; label: string; type?: string }) => {
    if (!editing) return <ReadonlyField label={label} value={asStr(form[field])} />
    return (
      <FormField label={label}>
        <Input type={type} value={asStr(form[field])} onChange={(e) => setField(field, e.target.value)}
          className={`rounded-xl h-9 ${errors[field] ? 'border-red-500' : ''}`} />
        {errors[field] && <p className="text-xs text-destructive mt-1">{errors[field]}</p>}
      </FormField>
    )
  }

  const psColumns: Column<PayslipRow>[] = [
    { key: 'number', label: 'Reference', render: (_v, row) => row.number || row.name },
    { key: 'employee_id', label: 'Employee', render: (v) => (Array.isArray(v) ? v[1] : '—') },
    {
      key: 'net_wage', label: 'Net', align: 'right' as const,
      render: (v) => <span className="font-mono tabular-nums">{typeof v === 'number' ? `$${v.toFixed(2)}` : '—'}</span>,
    },
    {
      key: 'state', label: 'Status',
      render: (v: string) => <Badge className={`rounded-full text-xs ${STATE_BADGES[v] || ''}`}>{v}</Badge>,
    },
  ]

  const tabs: FormTab[] = isNew ? [] : [
    {
      key: 'payslips',
      label: `Payslips (${records.length})`,
      content: (
        <DataTable<PayslipRow>
          columns={psColumns}
          data={records}
          total={records.length}
          page={0}
          pageSize={records.length || 1}
          onPageChange={() => {}}
          loading={false}
          emptyMessage="No payslips in this batch"
          onRowClick={(row) => navigate(`/admin/hr/payslips/${row.id}`)}
        />
      ),
    },
  ]

  return (
    <RecordForm
      editing={editing}
      onEdit={() => setEditing(true)}
      onSave={() => saveMut.mutate()}
      onDiscard={() => {
        if (isNew) navigate(-1)
        else { setForm({ ...record }); setEditing(false); setErrors({}) }
      }}
      backTo="/admin/hr/payslip-batches"
      statusBar={!isNew ? <StatusBar steps={STATUS_STEPS} current={state} /> : undefined}
      headerActions={stateActions}
      topContent={
        <div className="mb-4">
          {editing ? (
            <Input value={asStr(form.name)} onChange={(e) => {
              setField('name', e.target.value)
              setErrors((er) => { const n = { ...er }; delete n.name; return n })
            }} placeholder="Batch Name"
              className={`text-xl font-bold border-0 border-b rounded-none px-0 h-auto py-1 focus-visible:ring-0 ${
                errors.name ? 'border-red-500' : 'border-border/40 focus-visible:border-primary'
              }`} />
          ) : (
            <h2 className="text-2xl font-bold tracking-tight">{asStr(form.name) || 'New Batch'}</h2>
          )}
          {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
        </div>
      }
      leftFields={
        <>
          <TF field="date_start" label="Date From" type="date" />
        </>
      }
      rightFields={
        <>
          <TF field="date_end" label="Date To" type="date" />
        </>
      }
      tabs={tabs}
    />
  )
}
