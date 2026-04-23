import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Button, Input, Label, Skeleton, Switch } from '@mashora/design-system'
import { ArrowLeft, Save, Trash2, CreditCard, ChevronRight } from 'lucide-react'
import { M2OInput, toast, ConfirmDialog } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

type M2OValue = [number, string] | false | null | undefined

interface PaymentMethodFormState {
  name: string
  active: boolean
  is_cash_count: boolean
  journal_id: M2OValue
  use_payment_terminal: boolean
  split_transactions: boolean
  sequence: number
}

const EMPTY: PaymentMethodFormState = {
  name: '',
  active: true,
  is_cash_count: false,
  journal_id: false,
  use_payment_terminal: false,
  split_transactions: false,
  sequence: 10,
}

function m2oFromId(v: unknown): M2OValue {
  if (Array.isArray(v)) return v as [number, string]
  if (typeof v === 'number') return [v, ''] as [number, string]
  return false
}

function m2oId(v: M2OValue): number | null {
  return Array.isArray(v) ? Number(v[0]) : null
}

function Toggle({
  label, description, checked, onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/20 px-4 py-3 transition-all duration-200 hover:bg-muted/30 cursor-pointer">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  )
}

export default function PaymentMethodForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'
  const recordId = isNew ? null : parseInt(id || '0')
  const [form, setForm] = useState<PaymentMethodFormState>(EMPTY)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const setField = <K extends keyof PaymentMethodFormState>(k: K, v: PaymentMethodFormState[K]) =>
    setForm(p => ({ ...p, [k]: v }))

  const { data: record, isLoading } = useQuery({
    queryKey: ['pos-payment-method', recordId],
    queryFn: async () => {
      if (isNew) return null
      const { data } = await erpClient.raw.get(`/pos/payment-methods/${recordId}`)
      return data
    },
    enabled: !isNew,
  })

  useEffect(() => {
    if (record) {
      setForm({
        name: record.name ?? '',
        active: record.active ?? true,
        is_cash_count: !!record.is_cash_count,
        journal_id: m2oFromId(record.journal_id),
        use_payment_terminal: !!record.use_payment_terminal,
        split_transactions: !!record.split_transactions,
        sequence: typeof record.sequence === 'number' ? record.sequence : 10,
      })
    }
  }, [record])

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) {
        toast.error('Validation Error', 'Name is required')
        throw new Error('Validation failed')
      }
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        active: form.active,
        is_cash_count: form.is_cash_count,
        journal_id: m2oId(form.journal_id),
        use_payment_terminal: form.use_payment_terminal,
        split_transactions: form.split_transactions,
        sequence: form.sequence,
      }
      for (const k of Object.keys(payload)) if (payload[k] === null) delete payload[k]
      if (isNew) {
        const { data } = await erpClient.raw.post('/pos/payment-methods', payload)
        return data
      }
      const { data } = await erpClient.raw.put(`/pos/payment-methods/${recordId}`, payload)
      return data
    },
    onSuccess: () => {
      toast.success(isNew ? 'Payment method created' : 'Payment method updated')
      navigate('/admin/pos/payment-methods')
    },
    onError: (e: unknown) => {
      if (e instanceof Error && e.message === 'Validation failed') return
      toast.error('Save failed', extractErrorMessage(e))
    },
  })

  const deleteMut = useMutation({
    mutationFn: async () => {
      if (!recordId) return
      await erpClient.raw.delete(`/pos/payment-methods/${recordId}`)
    },
    onSuccess: () => {
      toast.success('Payment method removed')
      navigate('/admin/pos/payment-methods')
    },
    onError: (e: unknown) => toast.error('Delete failed', extractErrorMessage(e)),
  })

  if (isLoading && !isNew) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    )
  }

  const nameMissing = !form.name.trim()

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
      {/* Breadcrumb + header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <button onClick={() => navigate('/admin/pos')} className="hover:text-foreground transition-colors">POS</button>
            <ChevronRight className="h-3 w-3" />
            <button onClick={() => navigate('/admin/pos/payment-methods')} className="hover:text-foreground transition-colors">Payment Methods</button>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">{isNew ? 'New' : 'Edit'}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isNew ? 'New Payment Method' : form.name || 'Edit Payment Method'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure how customers pay at this register.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/admin/pos/payment-methods')} className="gap-2 rounded-xl">
            <ArrowLeft className="h-4 w-4" /> Cancel
          </Button>
          {!isNew && (
            <Button variant="outline" onClick={() => setDeleteOpen(true)} className="gap-2 rounded-xl text-rose-500 hover:text-rose-600 hover:border-rose-500/40">
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          )}
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="gap-2 rounded-xl">
            <Save className="h-4 w-4" />
            {saveMut.isPending ? 'Saving…' : isNew ? 'Create' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Main card */}
      <div className="rounded-2xl border border-border/40 bg-card p-6 space-y-5 transition-all duration-200 hover:shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2 text-primary shrink-0">
            <CreditCard className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight">Method details</h3>
            <p className="text-xs text-muted-foreground">Name, accounting journal, and behaviour flags.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={e => setField('name', e.target.value)}
              placeholder="Cash, Visa, etc."
              className={`rounded-xl h-9 ${nameMissing ? 'border-rose-500/60 focus-visible:ring-rose-500/30' : ''}`}
            />
            {nameMissing && <p className="text-[11px] text-rose-500">Required</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Journal</Label>
            <M2OInput
              value={form.journal_id}
              model="account.journal"
              onChange={v => setField('journal_id', v)}
              placeholder="Select journal..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sequence">Sequence</Label>
            <Input
              id="sequence"
              type="number"
              value={form.sequence}
              onChange={e => setField('sequence', parseInt(e.target.value || '0', 10))}
              className="rounded-xl h-9 tabular-nums"
            />
          </div>
        </div>

        <div className="border-t border-border/40 pt-5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Behaviour</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Toggle
              label="Cash payment"
              description="Counted at session open/close"
              checked={form.is_cash_count}
              onChange={v => setField('is_cash_count', v)}
            />
            <Toggle
              label="Use payment terminal"
              description="Integrate with an external terminal"
              checked={form.use_payment_terminal}
              onChange={v => setField('use_payment_terminal', v)}
            />
            <Toggle
              label="Split transactions"
              description="One journal entry per payment"
              checked={form.split_transactions}
              onChange={v => setField('split_transactions', v)}
            />
            <Toggle
              label="Active"
              description="Inactive methods are hidden"
              checked={form.active}
              onChange={v => setField('active', v)}
            />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => { setDeleteOpen(false); deleteMut.mutate() }}
        title="Delete this payment method?"
        message="If this method has been used in past orders it will be archived instead of permanently deleted."
        variant="danger"
        confirmLabel="Delete"
        loading={deleteMut.isPending}
      />
    </div>
  )
}
