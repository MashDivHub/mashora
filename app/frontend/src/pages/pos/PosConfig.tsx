import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared'
import { Badge, Skeleton } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { Monitor, CreditCard, Warehouse, Settings, Check, X } from 'lucide-react'

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
  open_session: number
}

interface PosConfigsResponse {
  records: PosConfigRecord[]
  total: number
}

interface FeatureToggle {
  label: string
  enabled: boolean
}

function FeatureChip({ label, enabled }: FeatureToggle) {
  return (
    <div className="flex items-center gap-1.5">
      {enabled ? (
        <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
      ) : (
        <X className="h-3.5 w-3.5 text-rose-500/70 shrink-0" />
      )}
      <span className={`text-xs ${enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
        {label}
      </span>
    </div>
  )
}

function ConfigCard({ config }: { config: PosConfigRecord }) {
  const isActive = config.open_session > 0
  const companyName = Array.isArray(config.company_id) ? config.company_id[1] : ''
  const warehouseName = Array.isArray(config.warehouse_id) ? config.warehouse_id[1] : ''
  const journalName = Array.isArray(config.journal_id) ? config.journal_id[1] : ''
  const pricelistName = Array.isArray(config.pricelist_id) ? config.pricelist_id[1] : ''

  const features: FeatureToggle[] = [
    { label: 'Restaurant Mode', enabled: config.module_pos_restaurant },
    { label: 'Tax Included', enabled: config.iface_tax_included === 'total' },
    { label: 'Tips', enabled: config.iface_tipproduct },
    { label: 'Auto Print', enabled: config.iface_print_auto },
    { label: 'Cash Drawer', enabled: config.iface_cashdrawer },
    { label: 'Cash Rounding', enabled: config.cash_rounding },
  ]

  return (
    <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary shrink-0">
            <Monitor className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-base font-bold truncate">{config.name}</p>
              {isActive && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{companyName}</p>
          </div>
        </div>
        <Badge variant={isActive ? 'default' : 'secondary'} className="shrink-0 text-xs">
          {isActive ? 'Open' : 'Closed'}
        </Badge>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Warehouse className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Warehouse</p>
            <p className="text-xs font-medium truncate">{warehouseName || '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <CreditCard className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Journal</p>
            <p className="text-xs font-medium truncate">{journalName || '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <Settings className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pricelist</p>
            <p className="text-xs font-medium truncate">{pricelistName || '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <Monitor className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sessions</p>
            <p className="text-xs font-medium">{config.session_count}</p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border/20" />

      {/* Feature toggles */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
          Features
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {features.map(f => (
            <FeatureChip key={f.label} label={f.label} enabled={f.enabled} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function PosConfig() {
  const { data, isLoading } = useQuery<PosConfigsResponse>({
    queryKey: ['pos-configs'],
    queryFn: () => erpClient.raw.get('/pos/configs').then(r => r.data),
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    )
  }

  const records = data?.records ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="POS Configuration" subtitle="Manage terminals" />

      {records.length === 0 ? (
        <div className="rounded-2xl border border-border/30 bg-card/50 p-12 text-center">
          <Monitor className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No POS configurations found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {records.map(config => (
            <ConfigCard key={config.id} config={config} />
          ))}
        </div>
      )}
    </div>
  )
}
