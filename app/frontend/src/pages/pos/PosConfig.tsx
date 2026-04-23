import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared'
import { Button, Skeleton } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import {
  Monitor, CreditCard, Warehouse, Settings, Check, Plus, Pencil, Tags,
  Banknote, Receipt, PlayCircle, Utensils, Printer, Package, DollarSign,
} from 'lucide-react'

interface PosConfigRecord {
  id: number
  name: string
  company_id: [number, string]
  payment_method_ids: number[]
  pricelist_id: [number, string]
  journal_id: [number, string]
  warehouse_id: [number, string]
  module_pos_restaurant: boolean
  iface_tax_included: string
  iface_tipproduct: boolean
  iface_print_auto: boolean
  iface_cashdrawer: boolean
  cash_rounding: boolean
  limit_categories: boolean
  session_count: number
  open_session: number | null
}

interface PosConfigsResponse {
  records: PosConfigRecord[]
  total: number
}

interface FeatureChipData {
  label: string
  icon: React.ReactNode
  enabled: boolean
}

function FeatureChip({ data }: { data: FeatureChipData }) {
  if (!data.enabled) return null
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/30 px-2.5 py-1 text-[11px] font-medium text-foreground">
      <span className="text-emerald-500">{data.icon}</span>
      {data.label}
    </span>
  )
}

function InfoCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <div className="mt-0.5 text-muted-foreground shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-xs font-medium text-foreground truncate">{value || '—'}</p>
      </div>
    </div>
  )
}

function ConfigCard({ config, onEdit, onLaunch }: {
  config: PosConfigRecord
  onEdit: (id: number) => void
  onLaunch: (id: number) => void
}) {
  const isActive = !!config.open_session
  const companyName = Array.isArray(config.company_id) ? config.company_id[1] : ''
  const warehouseName = Array.isArray(config.warehouse_id) ? config.warehouse_id[1] : ''
  const journalName = Array.isArray(config.journal_id) ? config.journal_id[1] : ''
  const pricelistName = Array.isArray(config.pricelist_id) ? config.pricelist_id[1] : ''

  const features: FeatureChipData[] = [
    { label: 'Restaurant', icon: <Utensils className="h-3 w-3" />, enabled: config.module_pos_restaurant },
    { label: 'Tips', icon: <DollarSign className="h-3 w-3" />, enabled: config.iface_tipproduct },
    { label: 'Auto-print', icon: <Printer className="h-3 w-3" />, enabled: config.iface_print_auto },
    { label: 'Cash drawer', icon: <Banknote className="h-3 w-3" />, enabled: config.iface_cashdrawer },
    { label: 'Cash rounding', icon: <Check className="h-3 w-3" />, enabled: config.cash_rounding },
    { label: 'Tax incl.', icon: <Check className="h-3 w-3" />, enabled: config.iface_tax_included === 'total' },
  ]
  const hasAnyFeature = features.some(f => f.enabled)

  return (
    <div className="rounded-2xl border border-border/40 bg-card p-6 space-y-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`rounded-xl p-2.5 shrink-0 ring-1 ${isActive ? 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/20' : 'bg-primary/10 text-primary ring-primary/20'}`}>
            <Monitor className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold tracking-tight truncate">{config.name}</p>
            <p className="text-xs text-muted-foreground truncate">{companyName || '—'}</p>
          </div>
        </div>
        <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider shrink-0 ${isActive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted/60 text-muted-foreground'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-muted-foreground/50'}`} />
          {isActive ? 'Open' : 'Closed'}
        </div>
      </div>

      {/* Features */}
      {hasAnyFeature ? (
        <div className="flex flex-wrap gap-1.5">
          {features.map(f => <FeatureChip key={f.label} data={f} />)}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">No optional features enabled</p>
      )}

      {/* Divider */}
      <div className="border-t border-border/40" />

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-4">
        <InfoCell icon={<Warehouse className="h-3.5 w-3.5" />} label="Warehouse" value={warehouseName} />
        <InfoCell icon={<CreditCard className="h-3.5 w-3.5" />} label="Journal" value={journalName} />
        <InfoCell icon={<Package className="h-3.5 w-3.5" />} label="Pricelist" value={pricelistName} />
        <InfoCell icon={<Receipt className="h-3.5 w-3.5" />} label="Sessions" value={String(config.session_count)} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={() => onLaunch(config.id)}
          className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${isActive ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
        >
          <PlayCircle className="h-3.5 w-3.5" />
          Launch
        </button>
        <button
          onClick={() => onEdit(config.id)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border/40 bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground transition-all duration-200 hover:bg-muted/60 hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
      </div>
    </div>
  )
}

export default function PosConfig() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery<PosConfigsResponse>({
    queryKey: ['pos-configs'],
    queryFn: () => erpClient.raw.get('/pos/configs').then(r => r.data),
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    )
  }

  const records = data?.records ?? []

  const handleCreate = () => navigate('/admin/pos/config/new')
  const handleEdit = (id: number) => navigate(`/admin/pos/config/${id}`)
  const handleLaunch = (id: number) => navigate(`/admin/pos/terminal/${id}`)

  return (
    <div className="space-y-6">
      <PageHeader
        title="POS Configuration"
        subtitle={`${records.length} register${records.length !== 1 ? 's' : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/admin/pos/payment-methods')} className="gap-2 rounded-xl">
              <CreditCard className="h-4 w-4" />
              Payment methods
            </Button>
            <Button variant="outline" onClick={() => navigate('/admin/pos/categories')} className="gap-2 rounded-xl">
              <Tags className="h-4 w-4" />
              Categories
            </Button>
            <Button onClick={handleCreate} className="gap-2 rounded-xl">
              <Plus className="h-4 w-4" />
              New Register
            </Button>
          </div>
        }
      />

      {records.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/40 bg-gradient-to-br from-primary/5 via-background to-emerald-500/5 p-12 text-center space-y-5">
          <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-primary">
            <Monitor className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-bold tracking-tight">No POS registers configured yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first register to start selling at the counter.
            </p>
          </div>
          <Button onClick={handleCreate} className="gap-2 rounded-xl">
            <Plus className="h-4 w-4" />
            Create First Register
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {records.map(config => (
            <ConfigCard key={config.id} config={config} onEdit={handleEdit} onLaunch={handleLaunch} />
          ))}
        </div>
      )}
    </div>
  )
}
