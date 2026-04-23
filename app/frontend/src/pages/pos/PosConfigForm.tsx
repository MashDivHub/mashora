import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Button, Input, Label, Skeleton, Switch } from '@mashora/design-system'
import {
  ArrowLeft, Save, Trash2, Monitor, Settings, CreditCard, Sliders,
  ChevronRight,
} from 'lucide-react'
import { M2OInput, toast, ConfirmDialog } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

type M2OValue = [number, string] | false | null | undefined

interface PosConfigFormState {
  name: string
  active: boolean
  warehouse_id: M2OValue
  journal_id: M2OValue
  pricelist_id: M2OValue
  currency_id: M2OValue
  payment_method_ids: number[]
  module_pos_restaurant: boolean
  iface_tax_included: string
  iface_tipproduct: boolean
  iface_print_auto: boolean
  iface_cashdrawer: boolean
  cash_rounding: boolean
  limit_categories: boolean
}

interface PaymentMethod {
  id: number
  name: string
  active?: boolean
  is_cash_count?: boolean
  use_payment_terminal?: boolean
}

const EMPTY_FORM: PosConfigFormState = {
  name: '',
  active: true,
  warehouse_id: false,
  journal_id: false,
  pricelist_id: false,
  currency_id: false,
  payment_method_ids: [],
  module_pos_restaurant: false,
  iface_tax_included: 'subtotal',
  iface_tipproduct: false,
  iface_print_auto: false,
  iface_cashdrawer: false,
  cash_rounding: false,
  limit_categories: false,
}

function m2oFromId(v: unknown): M2OValue {
  if (Array.isArray(v)) return v as [number, string]
  if (typeof v === 'number') return [v, ''] as [number, string]
  return false
}

function m2oId(v: M2OValue): number | null {
  return Array.isArray(v) ? Number(v[0]) : null
}

function SectionCard({
  title, description, icon, children,
}: {
  title: string
  description?: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card p-6 space-y-5 transition-all duration-200 hover:shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2 text-primary shrink-0">{icon}</div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold tracking-tight">{title}</h3>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function FeatureToggle({
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

export default function PosConfigForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'
  const recordId = isNew ? null : parseInt(id || '0')

  const [form, setForm] = useState<PosConfigFormState>(EMPTY_FORM)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const setField = <K extends keyof PosConfigFormState>(k: K, v: PosConfigFormState[K]) =>
    setForm(p => ({ ...p, [k]: v }))

  const { data: record, isLoading } = useQuery({
    queryKey: ['pos-config-detail', recordId],
    queryFn: async () => {
      if (isNew) return null
      const { data } = await erpClient.raw.get(`/pos/configs/${recordId}`)
      return data
    },
    enabled: !isNew,
  })

  const { data: pmData } = useQuery<{ records: PaymentMethod[] }>({
    queryKey: ['pos-payment-methods', 'all'],
    queryFn: async () => {
      const { data } = await erpClient.raw.get('/pos/payment-methods?active_only=true')
      return data
    },
    staleTime: 60_000,
  })
  const allPaymentMethods = pmData?.records ?? []

  useEffect(() => {
    if (record) {
      setForm({
        name: record.name ?? '',
        active: record.active ?? true,
        warehouse_id: m2oFromId(record.warehouse_id),
        journal_id: m2oFromId(record.journal_id),
        pricelist_id: m2oFromId(record.pricelist_id),
        currency_id: m2oFromId(record.currency_id),
        payment_method_ids: record.payment_method_ids ?? [],
        module_pos_restaurant: !!record.module_pos_restaurant,
        iface_tax_included: record.iface_tax_included ?? 'subtotal',
        iface_tipproduct: !!record.iface_tipproduct,
        iface_print_auto: !!record.iface_print_auto,
        iface_cashdrawer: !!record.iface_cashdrawer,
        cash_rounding: !!record.cash_rounding,
        limit_categories: !!record.limit_categories,
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
        warehouse_id: m2oId(form.warehouse_id),
        journal_id: m2oId(form.journal_id),
        pricelist_id: m2oId(form.pricelist_id),
        currency_id: m2oId(form.currency_id),
        payment_method_ids: form.payment_method_ids,
        module_pos_restaurant: form.module_pos_restaurant,
        iface_tax_included: form.iface_tax_included,
        iface_tipproduct: form.iface_tipproduct,
        iface_print_auto: form.iface_print_auto,
        iface_cashdrawer: form.iface_cashdrawer,
        cash_rounding: form.cash_rounding,
        limit_categories: form.limit_categories,
      }
      for (const k of Object.keys(payload)) {
        if (payload[k] === null) delete payload[k]
      }
      if (isNew) {
        const { data } = await erpClient.raw.post('/pos/configs', payload)
        return data
      }
      const { data } = await erpClient.raw.put(`/pos/configs/${recordId}`, payload)
      return data
    },
    onSuccess: () => {
      toast.success(isNew ? 'Register created' : 'Register updated')
      navigate('/admin/pos/config')
    },
    onError: (e: unknown) => {
      if (e instanceof Error && e.message === 'Validation failed') return
      toast.error('Save failed', extractErrorMessage(e))
    },
  })

  const deleteMut = useMutation({
    mutationFn: async () => {
      if (!recordId) return
      await erpClient.raw.delete(`/pos/configs/${recordId}`)
    },
    onSuccess: () => {
      toast.success('Register archived')
      navigate('/admin/pos/config')
    },
    onError: (e: unknown) => toast.error('Delete failed', extractErrorMessage(e)),
  })

  function togglePaymentMethod(pmId: number, checked: boolean) {
    setForm(p => ({
      ...p,
      payment_method_ids: checked
        ? Array.from(new Set([...p.payment_method_ids, pmId]))
        : p.payment_method_ids.filter(x => x !== pmId),
    }))
  }

  if (isLoading && !isNew) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }

  const nameMissing = !form.name.trim()

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      {/* Breadcrumb + header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <button onClick={() => navigate('/admin/pos')} className="hover:text-foreground transition-colors">POS</button>
            <ChevronRight className="h-3 w-3" />
            <button onClick={() => navigate('/admin/pos/config')} className="hover:text-foreground transition-colors">Registers</button>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">{isNew ? 'New' : 'Edit'}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isNew ? 'New Register' : form.name || 'Edit Register'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure hardware, accounting and customer-facing features for this register.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/admin/pos/config')} className="gap-2 rounded-xl">
            <ArrowLeft className="h-4 w-4" /> Cancel
          </Button>
          {!isNew && (
            <Button variant="outline" onClick={() => setDeleteOpen(true)} className="gap-2 rounded-xl text-rose-500 hover:text-rose-600 hover:border-rose-500/40">
              <Trash2 className="h-4 w-4" /> Archive
            </Button>
          )}
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="gap-2 rounded-xl">
            <Save className="h-4 w-4" />
            {saveMut.isPending ? 'Saving…' : isNew ? 'Create' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Basic */}
      <SectionCard
        title="Basic"
        description="Identity & availability"
        icon={<Monitor className="h-4 w-4" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={e => setField('name', e.target.value)}
              placeholder="Main Register"
              className={`rounded-xl h-9 ${nameMissing ? 'border-rose-500/60 focus-visible:ring-rose-500/30' : ''}`}
            />
            {nameMissing && (
              <p className="text-[11px] text-rose-500">Required</p>
            )}
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/20 px-4 py-3 md:self-end">
            <Switch
              id="active"
              checked={form.active}
              onCheckedChange={v => setField('active', v)}
            />
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">Shown in POS UI</p>
            </div>
          </label>
        </div>
      </SectionCard>

      {/* Operation */}
      <SectionCard
        title="Operation"
        description="Warehouse, journal, pricelist and currency"
        icon={<Settings className="h-4 w-4" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Warehouse</Label>
            <M2OInput
              value={form.warehouse_id}
              model="stock.warehouse"
              onChange={v => setField('warehouse_id', v)}
              placeholder="Select warehouse..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Sales Journal</Label>
            <M2OInput
              value={form.journal_id}
              model="account.journal"
              onChange={v => setField('journal_id', v)}
              placeholder="Cash or bank journal..."
              domain={[['type', 'in', ['cash', 'bank']]]}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Pricelist</Label>
            <M2OInput
              value={form.pricelist_id}
              model="product.pricelist"
              onChange={v => setField('pricelist_id', v)}
              placeholder="Select pricelist..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <M2OInput
              value={form.currency_id}
              model="res.currency"
              onChange={v => setField('currency_id', v)}
              placeholder="Select currency..."
            />
          </div>
        </div>
      </SectionCard>

      {/* Payment methods */}
      <SectionCard
        title="Payment Methods"
        description="Select which payment methods are available on this register"
        icon={<CreditCard className="h-4 w-4" />}
      >
        {allPaymentMethods.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/40 bg-muted/20 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No payment methods configured yet.
            </p>
            <button
              type="button"
              onClick={() => navigate('/admin/pos/payment-methods/new')}
              className="mt-2 text-xs font-semibold text-primary hover:underline"
            >
              Create one
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {allPaymentMethods.map(pm => {
              const checked = form.payment_method_ids.includes(pm.id)
              const badge = pm.is_cash_count ? 'cash' : pm.use_payment_terminal ? 'terminal' : 'account'
              const badgeClass = pm.is_cash_count
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : pm.use_payment_terminal
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  : 'bg-muted/60 text-muted-foreground'
              return (
                <label
                  key={pm.id}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-all duration-200 ${checked ? 'border-primary/60 bg-primary/5' : 'border-border/40 bg-muted/20 hover:bg-muted/30'}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={e => togglePaymentMethod(pm.id, e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm font-medium flex-1 truncate">{pm.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${badgeClass}`}>
                    {badge}
                  </span>
                </label>
              )
            })}
          </div>
        )}
      </SectionCard>

      {/* Features */}
      <SectionCard
        title="Features"
        description="Toggle optional behaviour for this register"
        icon={<Sliders className="h-4 w-4" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FeatureToggle
            label="Restaurant mode"
            description="Table management & kitchen printers"
            checked={form.module_pos_restaurant}
            onChange={v => setField('module_pos_restaurant', v)}
          />
          <FeatureToggle
            label="Tax inclusive pricing"
            description="Display prices with tax included"
            checked={form.iface_tax_included === 'total'}
            onChange={v => setField('iface_tax_included', v ? 'total' : 'subtotal')}
          />
          <FeatureToggle
            label="Tips allowed"
            description="Prompt for a tip at checkout"
            checked={form.iface_tipproduct}
            onChange={v => setField('iface_tipproduct', v)}
          />
          <FeatureToggle
            label="Auto-print receipt"
            description="Print automatically after payment"
            checked={form.iface_print_auto}
            onChange={v => setField('iface_print_auto', v)}
          />
          <FeatureToggle
            label="Cash drawer"
            description="Pop drawer on cash payments"
            checked={form.iface_cashdrawer}
            onChange={v => setField('iface_cashdrawer', v)}
          />
          <FeatureToggle
            label="Cash rounding"
            description="Round cash totals"
            checked={form.cash_rounding}
            onChange={v => setField('cash_rounding', v)}
          />
          <FeatureToggle
            label="Limit categories"
            description="Only show specific categories"
            checked={form.limit_categories}
            onChange={v => setField('limit_categories', v)}
          />
        </div>
      </SectionCard>

      {/* Sticky bottom bar (mobile) */}
      <div className="sticky bottom-4 z-10 flex items-center justify-end gap-2 rounded-2xl border border-border/40 bg-card/95 p-3 backdrop-blur md:hidden">
        <Button variant="outline" onClick={() => navigate('/admin/pos/config')} className="rounded-xl flex-1">
          Cancel
        </Button>
        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="rounded-xl flex-1 gap-2">
          <Save className="h-4 w-4" />
          {saveMut.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => { setDeleteOpen(false); deleteMut.mutate() }}
        title="Archive this register?"
        message="The register will be marked inactive. You cannot archive a register that has sessions — delete the sessions first if you need to fully remove it."
        variant="danger"
        confirmLabel="Archive"
        loading={deleteMut.isPending}
      />
    </div>
  )
}
