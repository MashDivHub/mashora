import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input, Textarea, Button, Skeleton } from '@mashora/design-system'
import { Play, Pause, XCircle, Lock, RotateCcw } from 'lucide-react'
import {
  RecordForm, FormField, ReadonlyField, StatusBar, M2OInput, OrderLinesEditor,
  toast, type FormTab, type StatusStep,
} from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'
import type { ServerLine } from '@/components/shared/OrderLinesEditor'

const STATES: StatusStep[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'in_progress', label: 'In Progress', color: 'success' },
  { key: 'paused', label: 'Paused', color: 'warning' },
  { key: 'closed', label: 'Closed' },
  { key: 'cancel', label: 'Cancelled', color: 'danger' },
]

const RULE_TYPES = [
  { value: 'day', label: 'Day(s)' },
  { value: 'week', label: 'Week(s)' },
  { value: 'month', label: 'Month(s)' },
  { value: 'year', label: 'Year(s)' },
]

export default function SubscriptionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id || id === 'new'
  const recordId = isNew ? null : parseInt(id || '0')
  const [editing, setEditing] = useState(isNew)
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [lines, setLines] = useState<ServerLine[]>([])

  const { data: record, isLoading } = useQuery({
    queryKey: ['subscription', recordId],
    queryFn: async () => {
      if (isNew) {
        return {
          id: null,
          state: 'draft',
          name: 'New Subscription',
          recurring_rule_type: 'month',
          recurring_interval: 1,
          date_start: new Date().toISOString().slice(0, 10),
          lines: [],
        }
      }
      const { data } = await erpClient.raw.get(`/model/sale.subscription/${recordId}`)
      // Fetch lines
      try {
        const { data: linesData } = await erpClient.raw.post('/model/sale.subscription.line', {
          domain: [['subscription_id', '=', recordId]],
          fields: ['id', 'product_id', 'name', 'quantity', 'price_unit', 'discount', 'price_subtotal'],
          limit: 200,
        })
        return { ...data, lines: linesData?.records || [] }
      } catch {
        return { ...data, lines: [] }
      }
    },
  })

  useEffect(() => {
    if (record) {
      setForm({ ...record })
      setLines(record.lines || [])
    }
  }, [record])

  const setField = useCallback((n: string, v: unknown) => { setForm(p => ({ ...p, [n]: v })) }, [])
  const m2oId = (v: unknown): number | null => Array.isArray(v) ? (v[0] as number) ?? null : (typeof v === 'number' ? v : null)
  const m2oVal = (v: unknown): string => (Array.isArray(v) ? String(v[1] ?? '') : '')
  const asStr = (v: unknown): string => (v == null || v === false ? '' : String(v))

  const saveMut = useMutation({
    mutationFn: async () => {
      const partnerId = m2oId(form.partner_id)
      if (!partnerId) {
        toast.error('Validation Error', 'Customer is required')
        throw new Error('Validation failed')
      }
      if (typeof form.name !== 'string' || !form.name.trim()) {
        toast.error('Validation Error', 'Name is required')
        throw new Error('Validation failed')
      }
      const vals: Record<string, unknown> = {
        name: form.name,
        code: form.code || undefined,
        partner_id: partnerId,
        template_id: m2oId(form.template_id) || undefined,
        user_id: m2oId(form.user_id) || undefined,
        date_start: form.date_start || undefined,
        date_end: form.date_end || undefined,
        next_invoice_date: form.next_invoice_date || undefined,
        recurring_rule_type: form.recurring_rule_type || undefined,
        recurring_interval: form.recurring_interval != null ? Number(form.recurring_interval) : undefined,
        recurring_total: form.recurring_total != null ? Number(form.recurring_total) : undefined,
        description: form.description || undefined,
      }
      for (const k of Object.keys(vals)) if (vals[k] === undefined) delete vals[k]
      if (isNew) {
        const { data } = await erpClient.raw.post('/model/sale.subscription/create', { vals })
        return data
      }
      const { data } = await erpClient.raw.put(`/model/sale.subscription/${recordId}`, { vals })
      return data
    },
    onSuccess: (data) => {
      setEditing(false)
      toast.success('Saved', 'Subscription saved')
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      if (isNew && data?.id) navigate(`/admin/sales/subscriptions/${data.id}`, { replace: true })
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
      const { data } = await erpClient.raw.put(`/model/sale.subscription/${recordId}`, {
        vals: { state: newState },
      })
      return data
    },
    onSuccess: (_d, newState) => {
      toast.success('Updated', `Subscription set to ${newState}`)
      queryClient.invalidateQueries({ queryKey: ['subscription', recordId] })
    },
    onError: (e: unknown) => toast.error('Action Failed', extractErrorMessage(e)),
  })

  if (isLoading || !record) {
    return <div className="space-y-4"><Skeleton className="h-10 w-full rounded-xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>
  }

  const state = form.state || 'draft'
  const isDraft = state === 'draft'
  const isProgress = state === 'in_progress'
  const isPaused = state === 'paused'
  const isClosed = state === 'closed' || state === 'cancel'

  const tabs: FormTab[] = [
    {
      key: 'lines', label: 'Lines',
      content: (
        <OrderLinesEditor
          lines={lines}
          parentId={recordId}
          parentField="subscription_id"
          lineModel="sale.subscription.line"
          qtyField="quantity"
          showDiscount
          readonly={isClosed}
          onChanged={() => {
            queryClient.invalidateQueries({ queryKey: ['subscription', recordId] })
          }}
        />
      ),
    },
    {
      key: 'description', label: 'Description',
      content: editing
        ? <FormField label="Description"><Textarea value={asStr(form.description)} onChange={e => setField('description', e.target.value)} rows={6} className="rounded-xl" /></FormField>
        : <ReadonlyField label="Description" value={asStr(form.description)} />,
    },
  ]

  return (
    <RecordForm
      editing={editing}
      onEdit={() => setEditing(true)}
      onSave={() => saveMut.mutate()}
      onDiscard={() => { if (isNew) navigate(-1); else { setForm({ ...record }); setLines((record.lines as ServerLine[]) || []); setEditing(false) } }}
      backTo="/admin/sales/subscriptions"
      statusBar={<StatusBar steps={STATES} current={String(state)} />}
      headerActions={
        <>
          {isDraft && recordId && (
            <Button variant="default" size="sm" className="rounded-xl gap-1.5" onClick={() => setStateMut.mutate('in_progress')} disabled={setStateMut.isPending}>
              <Play className="h-3.5 w-3.5" /> Start
            </Button>
          )}
          {isProgress && recordId && (
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => setStateMut.mutate('paused')} disabled={setStateMut.isPending}>
              <Pause className="h-3.5 w-3.5" /> Pause
            </Button>
          )}
          {isPaused && recordId && (
            <Button variant="default" size="sm" className="rounded-xl gap-1.5" onClick={() => setStateMut.mutate('in_progress')} disabled={setStateMut.isPending}>
              <Play className="h-3.5 w-3.5" /> Resume
            </Button>
          )}
          {(isProgress || isPaused) && recordId && (
            <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-muted-foreground" onClick={() => setStateMut.mutate('closed')} disabled={setStateMut.isPending}>
              <Lock className="h-3.5 w-3.5" /> Close
            </Button>
          )}
          {!isClosed && recordId && (
            <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-destructive" onClick={() => {
              if (!confirm('Cancel this subscription?')) return
              setStateMut.mutate('cancel')
            }} disabled={setStateMut.isPending}>
              <XCircle className="h-3.5 w-3.5" /> Cancel
            </Button>
          )}
          {isClosed && recordId && (
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => setStateMut.mutate('draft')} disabled={setStateMut.isPending}>
              <RotateCcw className="h-3.5 w-3.5" /> Set to Draft
            </Button>
          )}
        </>
      }
      topContent={
        <div className="mb-2">
          <ReadonlyField
            label="Subscription"
            value={<span className="text-lg font-bold">{asStr(form.name) || 'New'}{form.code ? ` (${asStr(form.code)})` : ''}</span>}
          />
        </div>
      }
      leftFields={
        <>
          <FormField label="Name" required>
            {editing
              ? <Input value={asStr(form.name)} onChange={e => setField('name', e.target.value)} className="rounded-xl h-9" />
              : <ReadonlyField label="" value={asStr(form.name)} />}
          </FormField>
          <FormField label="Code">
            {editing
              ? <Input value={asStr(form.code)} onChange={e => setField('code', e.target.value)} className="rounded-xl h-9" />
              : <ReadonlyField label="" value={asStr(form.code)} />}
          </FormField>
          <FormField label="Customer" required>
            {editing
              ? <M2OInput value={form.partner_id as [number, string] | false | null} model="res.partner" onChange={v => setField('partner_id', v)} />
              : <ReadonlyField label="" value={m2oVal(form.partner_id)} />}
          </FormField>
          <FormField label="Template">
            {editing
              ? <M2OInput value={form.template_id as [number, string] | false | null} model="sale.subscription.template" onChange={v => setField('template_id', v)} />
              : <ReadonlyField label="" value={m2oVal(form.template_id)} />}
          </FormField>
          <FormField label="Salesperson">
            {editing
              ? <M2OInput value={form.user_id as [number, string] | false | null} model="res.users" onChange={v => setField('user_id', v)} />
              : <ReadonlyField label="" value={m2oVal(form.user_id)} />}
          </FormField>
        </>
      }
      rightFields={
        <>
          <FormField label="Start Date">
            {editing
              ? <Input type="date" value={asStr(form.date_start)} onChange={e => setField('date_start', e.target.value)} className="rounded-xl h-9" />
              : <ReadonlyField label="" value={asStr(form.date_start)} />}
          </FormField>
          <FormField label="End Date">
            {editing
              ? <Input type="date" value={asStr(form.date_end)} onChange={e => setField('date_end', e.target.value || false)} className="rounded-xl h-9" />
              : <ReadonlyField label="" value={asStr(form.date_end)} />}
          </FormField>
          <FormField label="Next Invoice">
            {editing
              ? <Input type="date" value={asStr(form.next_invoice_date)} onChange={e => setField('next_invoice_date', e.target.value || false)} className="rounded-xl h-9" />
              : <ReadonlyField label="" value={asStr(form.next_invoice_date)} />}
          </FormField>
          <FormField label="Recurrence">
            {editing ? (
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="1"
                  value={Number(form.recurring_interval ?? 1)}
                  onChange={e => setField('recurring_interval', parseInt(e.target.value) || 1)}
                  className="rounded-xl h-9 w-20"
                />
                <select
                  value={asStr(form.recurring_rule_type) || 'month'}
                  onChange={e => setField('recurring_rule_type', e.target.value)}
                  className="flex-1 rounded-xl h-9 border border-input bg-background px-3 text-sm"
                >
                  {RULE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            ) : (
              <ReadonlyField label="" value={`Every ${Number(form.recurring_interval ?? 1)} ${RULE_TYPES.find(t => t.value === form.recurring_rule_type)?.label || asStr(form.recurring_rule_type)}`} />
            )}
          </FormField>
          <FormField label="Recurring Total">
            {editing
              ? <Input type="number" step="0.01" value={form.recurring_total == null ? '' : Number(form.recurring_total)} onChange={e => setField('recurring_total', parseFloat(e.target.value) || 0)} className="rounded-xl h-9" />
              : <ReadonlyField label="" value={form.recurring_total != null ? `$${Number(form.recurring_total).toFixed(2)}` : ''} />}
          </FormField>
        </>
      }
      tabs={tabs}
    />
  )
}
