import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  cancelSubscription,
  createCheckout,
  getPlans,
  getPortalUrl,
  getSubscriptions,
  type PlanInfo,
  type SubscriptionResponse,
} from '../api/subscriptions'
import { Notice } from '@/components/app/notice'
import { PageHeader } from '@/components/app/page-header'
import { StatusBadge } from '@/components/app/status-badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'

const planLabels: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
}

const fallbackPlanOptions = [
  { slug: 'starter', label: 'Starter', price: '$29/mo' },
  { slug: 'professional', label: 'Professional', price: '$79/mo' },
  { slug: 'enterprise', label: 'Enterprise', price: '$199/mo' },
]

function formatDate(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatAmount(cents: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
  }).format(cents / 100)
}

export default function Billing() {
  const [searchParams] = useSearchParams()
  const [subscriptions, setSubscriptions] = useState<SubscriptionResponse[]>([])
  const [plans, setPlans] = useState<PlanInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [portalLoading, setPortalLoading] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [showPlanChange, setShowPlanChange] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

  const successParam = searchParams.get('success')
  const cancelledParam = searchParams.get('cancelled')

  useEffect(() => {
    Promise.allSettled([getSubscriptions(), getPlans()])
      .then(([subscriptionsResult, plansResult]) => {
        if (subscriptionsResult.status === 'fulfilled') {
          setSubscriptions(subscriptionsResult.value)
        } else {
          setError('Failed to load subscription info.')
        }

        if (plansResult.status === 'fulfilled') {
          setPlans(plansResult.value)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  async function handlePortal() {
    setPortalLoading(true)
    try {
      const { portal_url: portalUrl } = await getPortalUrl()
      window.location.href = portalUrl
    } catch {
      setError('Failed to open billing portal. Please try again.')
    } finally {
      setPortalLoading(false)
    }
  }

  async function handleCancel() {
    if (!cancelTarget) return
    setCancelling(true)
    try {
      await cancelSubscription(cancelTarget)
      setSubscriptions((prev) =>
        prev.map((sub) => (sub.id === cancelTarget ? { ...sub, status: 'cancelled' } : sub))
      )
      setCancelTarget(null)
    } catch {
      setError('Failed to cancel subscription. Please try again.')
    } finally {
      setCancelling(false)
    }
  }

  async function handleChangePlan(slug: string) {
    setCheckoutLoading(slug)
    try {
      const { checkout_url: checkoutUrl } = await createCheckout(slug)
      window.location.href = checkoutUrl
    } catch {
      setError('Failed to start checkout. Please try again.')
      setCheckoutLoading(null)
    }
  }

  const activeSub = subscriptions.find((sub) => sub.status === 'active' || sub.status === 'trialing')
  const planLookup = Object.fromEntries(plans.map((plan) => [plan.slug, plan]))
  const availablePlanOptions = plans.length
    ? plans
        .filter((plan) => plan.slug !== 'free')
        .map((plan) => ({
          slug: plan.slug,
          label: plan.name,
          price: `${formatAmount(plan.price_cents, 'USD')}/mo`,
        }))
    : fallbackPlanOptions
  const currentPlanLimits = activeSub ? planLookup[activeSub.plan] : undefined
  const usersLimit = currentPlanLimits ? (currentPlanLimits.max_users < 0 ? 999 : currentPlanLimits.max_users) : 5
  const appsLimit = currentPlanLimits ? (currentPlanLimits.max_apps < 0 ? 999 : currentPlanLimits.max_apps) : 1

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Billing"
        title="Plan, payments, and usage"
        description="Manage subscription state, jump into the billing portal, and prepare upgrades without leaving the workspace."
        actions={
          <Button variant="outline" asChild>
            <Link to="/pricing">View pricing</Link>
          </Button>
        }
      />

      {successParam === 'true' ? <Notice tone="success">Your subscription was activated successfully.</Notice> : null}
      {cancelledParam === 'true' ? <Notice tone="warning">Checkout was cancelled. No changes were made.</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <div className="rounded-3xl border border-border/70 bg-card/90 p-6">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading subscription...</div>
        ) : activeSub ? (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold">{planLabels[activeSub.plan] ?? activeSub.plan}</h2>
                  <StatusBadge value={activeSub.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatAmount(activeSub.amount_cents, activeSub.currency)}/{activeSub.interval} • next billing{' '}
                  {formatDate(activeSub.current_period_end)}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => setShowPlanChange((prev) => !prev)}>
                  Change plan
                </Button>
                <Button onClick={handlePortal} disabled={portalLoading}>
                  {portalLoading ? 'Opening...' : 'Manage billing'}
                </Button>
                {activeSub.status !== 'cancelled' ? (
                  <Button variant="destructive" onClick={() => setCancelTarget(activeSub.id)}>
                    Cancel subscription
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="Status" value={<StatusBadge value={activeSub.status} />} />
              <SummaryCard
                label="Amount"
                value={<span className="text-lg font-semibold">{formatAmount(activeSub.amount_cents, activeSub.currency)}</span>}
              />
              <SummaryCard
                label="Period start"
                value={<span className="text-lg font-semibold">{formatDate(activeSub.current_period_start)}</span>}
              />
              <SummaryCard
                label="Period end"
                value={<span className="text-lg font-semibold">{formatDate(activeSub.current_period_end)}</span>}
              />
            </div>

            {showPlanChange ? (
              <div className="rounded-3xl border border-border/70 bg-background/60 p-5">
                <div className="mb-4 text-sm font-medium">Select a new plan</div>
                <div className="flex flex-wrap gap-3">
                  {availablePlanOptions.map((plan) => (
                    <Button
                      key={plan.slug}
                      variant={activeSub.plan === plan.slug ? 'subtle' : 'outline'}
                      disabled={checkoutLoading === plan.slug || activeSub.plan === plan.slug}
                      onClick={() => handleChangePlan(plan.slug)}
                    >
                      {checkoutLoading === plan.slug ? 'Redirecting...' : `${plan.label} - ${plan.price}`}
                      {activeSub.plan === plan.slug ? ' (current)' : ''}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <div className="text-sm text-muted-foreground">You are currently on the Free plan.</div>
            <Button asChild className="rounded-2xl">
              <Link to="/pricing">Upgrade plan</Link>
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-border/70 bg-card/90 p-6">
          <div className="mb-5 space-y-1">
            <h2 className="text-lg font-semibold">Usage overview</h2>
            <p className="text-sm text-muted-foreground">Current allowance across users and installed apps.</p>
          </div>
          <div className="space-y-5">
            <UsageBar label="Users" current={1} max={usersLimit} />
            <UsageBar label="Apps" current={0} max={appsLimit} />
          </div>
        </div>

        <div className="rounded-3xl border border-border/70 bg-card/90 p-6">
          <div className="mb-5 space-y-1">
            <h2 className="text-lg font-semibold">Invoice history</h2>
            <p className="text-sm text-muted-foreground">We will surface invoices and payment events here soon.</p>
          </div>
          <Separator className="mb-5" />
          <div className="text-sm text-muted-foreground">Coming soon.</div>
        </div>
      </div>

      <Dialog open={Boolean(cancelTarget)} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel subscription?</DialogTitle>
            <DialogDescription>
              You will retain access until the end of the current billing period, then the workspace will move back to the free tier.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>Keep subscription</Button>
            <Button variant="destructive" disabled={cancelling} onClick={handleCancel}>
              {cancelling ? 'Cancelling...' : 'Yes, cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
      <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className="mt-2">{value}</div>
    </div>
  )
}

function UsageBar({ label, current, max }: { label: string; current: number; max: number }) {
  const isUnlimited = max >= 999
  const percent = isUnlimited ? 100 : Math.min((current / max) * 100, 100)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {current} / {isUnlimited ? 'Unlimited' : max}
        </span>
      </div>
      <Progress value={percent} />
    </div>
  )
}
