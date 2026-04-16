import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import { CreditCard, Info, ShoppingCart, Monitor } from 'lucide-react'
import { PageHeader, FormSection, ReadonlyField } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

function maskSecret(val: string | null | undefined): string {
  if (!val) return 'Not configured'
  return val.slice(0, 4) + '••••••••'
}

type StripeState = 'enabled' | 'disabled' | 'test'

export default function StripeConfig() {
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'stripe'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.post('/model/payment.provider', {
          domain: [['code', '=', 'stripe']],
          fields: ['id', 'name', 'state', 'company_id'],
          limit: 1,
        })
        return (data?.data?.[0] ?? data?.[0]) || null
      } catch {
        return null
      }
    },
  })

  const state: StripeState | undefined = data?.state
  const isActive = state === 'enabled'
  const isTest = state === 'test'

  const statusLabel = isActive ? 'Active' : isTest ? 'Test Mode' : 'Inactive'
  const statusClass = isActive
    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
    : isTest
    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
    : 'bg-muted text-muted-foreground border border-border/30'

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-52 w-full rounded-2xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Stripe Payment"
        subtitle="Payment gateway configuration"
        backTo="/admin/settings"
      />

      {/* Status card */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
        <FormSection title="Integration Status">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1.5">
                {data?.name ?? 'Stripe'} payment gateway
              </p>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass}`}>
                {statusLabel}
              </span>
            </div>
          </div>
        </FormSection>
      </div>

      {/* Configuration card */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
        <FormSection title="API Keys">
          <div className="space-y-3 divide-y divide-border/20">
            <ReadonlyField label="Publishable Key" value={maskSecret(undefined)} />
            <div className="pt-3">
              <ReadonlyField label="Secret Key" value={maskSecret(undefined)} />
            </div>
            <div className="pt-3">
              <ReadonlyField label="Webhook Secret" value={maskSecret(undefined)} />
            </div>
            <div className="pt-3">
              <ReadonlyField
                label="Test Mode"
                value={
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      isTest
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-muted text-muted-foreground border border-border/30'
                    }`}
                  >
                    {isTest ? 'Yes' : 'No'}
                  </span>
                }
              />
            </div>
          </div>
        </FormSection>
      </div>

      {/* Capabilities card */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
        <FormSection title="Capabilities">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 py-1.5">
              <ShoppingCart className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm">Online Payments</span>
              <span className="ml-auto text-xs text-muted-foreground font-mono">website_sale</span>
            </div>
            <div className="flex items-center gap-2.5 py-1.5 border-t border-border/20">
              <Monitor className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm">POS Terminal Payments</span>
              <span className="ml-auto text-xs text-muted-foreground font-mono">pos_stripe</span>
            </div>
          </div>
        </FormSection>
      </div>

      {/* Note card */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
        <div className="flex items-start gap-3">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            Manage Stripe credentials in{' '}
            <span className="text-foreground font-medium">
              Settings → Payment Providers
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
