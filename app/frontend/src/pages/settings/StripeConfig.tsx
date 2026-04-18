import { useQuery } from '@tanstack/react-query'
import { Badge, Card, CardContent, Skeleton } from '@mashora/design-system'
import { CreditCard, Info, ShoppingCart, Monitor } from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface PaymentProvider {
  id: number
  code: string
  name: string | Record<string, string>
  state: 'enabled' | 'test' | 'disabled'
  is_published: boolean
  allow_tokenization: boolean
  capture_manually: boolean
  allow_express_checkout: boolean
  maximum_amount: number | null
}

const STATE_LABELS: Record<string, { label: string; color: string }> = {
  enabled: { label: 'Active', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  test: { label: 'Test Mode', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  disabled: { label: 'Inactive', color: 'bg-muted text-muted-foreground border-border/30' },
}

export default function StripeConfig() {
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'stripe-provider'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/payment.provider', {
        domain: [['code', '=', 'stripe']],
        fields: ['id', 'code', 'name', 'state', 'is_published', 'allow_tokenization', 'capture_manually', 'allow_express_checkout', 'maximum_amount'],
        limit: 1,
      })
      return (data?.records?.[0] || null) as PaymentProvider | null
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  }

  const stateInfo = data?.state ? STATE_LABELS[data.state] : { label: 'Not Installed', color: 'bg-muted text-muted-foreground border-border/30' }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Stripe Payment" subtitle="Payment gateway" backTo="/admin/settings" />

      <Card className="rounded-2xl">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-primary/10 p-3 shrink-0">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold mb-1">{typeof data?.name === 'object' ? data?.name?.en_US : data?.name || 'Stripe'}</h3>
              <p className="text-sm text-muted-foreground mb-3">Accept online payments via Stripe (cards, Apple Pay, Google Pay, etc.).</p>
              <Badge className={`text-xs ${stateInfo.color}`}>{stateInfo.label}</Badge>
            </div>
          </div>

          {data && (
            <div className="grid gap-3 sm:grid-cols-2 mt-5 pt-5 border-t border-border/40">
              <FeatureFlag label="Published" enabled={data.is_published} />
              <FeatureFlag label="Tokenization" enabled={data.allow_tokenization} />
              <FeatureFlag label="Manual Capture" enabled={data.capture_manually} />
              <FeatureFlag label="Express Checkout" enabled={data.allow_express_checkout} />
              {data.maximum_amount != null && data.maximum_amount > 0 && (
                <div className="text-xs col-span-2">
                  <span className="text-muted-foreground">Maximum amount: </span>
                  <span className="font-mono">${data.maximum_amount.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {!data && (
            <div className="mt-5 pt-5 border-t border-border/40">
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-600 dark:text-amber-400">
                Stripe payment provider not installed. Install the <code className="font-mono">payment_stripe</code> module to enable.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-4 sm:p-6">
          <h4 className="text-sm font-semibold mb-3">Capabilities</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 py-1.5">
              <ShoppingCart className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm">eCommerce checkout</span>
              <code className="ml-auto text-xs text-muted-foreground font-mono">website_sale</code>
            </div>
            <div className="flex items-center gap-2.5 py-1.5 border-t border-border/20">
              <Monitor className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm">POS terminal payments</span>
              <code className="ml-auto text-xs text-muted-foreground font-mono">pos_stripe</code>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Stripe API keys (publishable, secret, webhook) are stored in <code className="font-mono">payment.provider</code> credentials and the dedicated <code className="font-mono">payment_stripe</code> module. Manage them via Settings → Payment Providers (coming soon) or directly in the database for now.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function FeatureFlag({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm rounded-lg border border-border/40 px-3 py-2">
      <span>{label}</span>
      <Badge variant={enabled ? 'success' : 'secondary'} className="text-xs">{enabled ? 'On' : 'Off'}</Badge>
    </div>
  )
}
