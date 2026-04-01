import { useEffect, useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { createCheckout, getPlans, type PlanInfo } from '../api/subscriptions'
import { useAuthStore } from '../store/authStore'
import { Notice } from '@/components/app/notice'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Plan {
  name: string
  slug: string
  priceCents: number
  interval: string
  description: string
  features: string[]
  maxUsers: number
  maxApps: number
  highlight?: boolean
}

const fallbackPlans: Plan[] = [
  {
    name: 'Free',
    slug: 'free',
    priceCents: 0,
    interval: 'mo',
    description: 'Perfect for small teams validating their first operational workspace.',
    features: ['5 users', '1 app', 'Community support', 'Basic analytics'],
    maxUsers: 5,
    maxApps: 1,
  },
  {
    name: 'Starter',
    slug: 'starter',
    priceCents: 2900,
    interval: 'mo',
    description: 'A strong base for companies moving off fragmented admin tools.',
    features: ['15 users', '5 apps', 'Email support', 'Custom subdomain'],
    maxUsers: 15,
    maxApps: 5,
  },
  {
    name: 'Professional',
    slug: 'professional',
    priceCents: 7900,
    interval: 'mo',
    description: 'For teams that want serious tenant operations and better control surfaces.',
    features: ['50 users', '20 apps', 'Priority support', 'API access'],
    maxUsers: 50,
    maxApps: 20,
    highlight: true,
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    priceCents: 19900,
    interval: 'mo',
    description: 'For larger organizations running complex platform and customer workflows.',
    features: ['Unlimited users', 'Unlimited apps', 'Dedicated support', 'SLA'],
    maxUsers: 999,
    maxApps: 999,
  },
]

const planContent: Partial<Record<string, Pick<Plan, 'description' | 'features' | 'highlight'>>> = {
  free: {
    description: 'Perfect for small teams validating their first operational workspace.',
    features: ['Community support', 'Basic analytics'],
  },
  starter: {
    description: 'A strong base for companies moving off fragmented admin tools.',
    features: ['Email support', 'Custom subdomain'],
  },
  professional: {
    description: 'For teams that want serious tenant operations and better control surfaces.',
    features: ['Priority support', 'API access'],
    highlight: true,
  },
  enterprise: {
    description: 'For larger organizations running complex platform and customer workflows.',
    features: ['Dedicated support', 'SLA'],
  },
}

function formatPrice(cents: number) {
  if (cents === 0) return 'Free'
  return `$${(cents / 100).toFixed(0)}`
}

function toDisplayPlan(plan: PlanInfo): Plan {
  return {
    name: plan.name,
    slug: plan.slug,
    priceCents: plan.price_cents,
    interval: 'mo',
    description: planContent[plan.slug]?.description ?? 'Flexible plan for business operations teams.',
    features: [
      `${plan.max_users < 0 ? 'Unlimited' : plan.max_users} users`,
      `${plan.max_apps < 0 ? 'Unlimited' : plan.max_apps} apps`,
      ...(planContent[plan.slug]?.features ?? []),
    ],
    maxUsers: plan.max_users < 0 ? 999 : plan.max_users,
    maxApps: plan.max_apps < 0 ? 999 : plan.max_apps,
    highlight: planContent[plan.slug]?.highlight,
  }
}

export default function Pricing() {
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const [plans, setPlans] = useState<Plan[]>(fallbackPlans)
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getPlans()
      .then((apiPlans) => {
        if (apiPlans.length) {
          setPlans(apiPlans.map(toDisplayPlan))
        }
      })
      .catch(() => {
        // Keep the local fallback cards so the page still renders cleanly.
      })
  }, [])

  async function handleSubscribe(slug: string) {
    if (!isAuthenticated) {
      navigate('/login?next=/pricing')
      return
    }
    setLoadingSlug(slug)
    setError('')
    try {
      const { checkout_url: checkoutUrl } = await createCheckout(slug)
      window.location.href = checkoutUrl
    } catch {
      setError('Failed to start checkout. Please try again.')
      setLoadingSlug(null)
    }
  }

  return (
    <div className="space-y-8">
      <div className="mx-auto max-w-3xl space-y-4 text-center">
        <Badge variant="outline" className="rounded-full px-4 py-1 text-[11px] uppercase tracking-[0.28em]">
          Pricing
        </Badge>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Simple plans for a sharper business platform.</h1>
        <p className="text-base text-muted-foreground">
          Choose the right control surface for your team, then upgrade as your tenant and addon operations grow.
        </p>
      </div>

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <div className="grid gap-6 xl:grid-cols-4">
        {plans.map((plan) => (
          <Card
            key={plan.slug}
            className={`relative overflow-hidden ${plan.highlight ? 'border-zinc-900 dark:border-zinc-100' : 'border-border/70'} bg-card/90`}
          >
            <CardHeader className="space-y-4">
              {plan.highlight ? (
                <Badge className="w-fit rounded-full bg-zinc-900 text-white dark:border dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50">
                  <Sparkles className="mr-1 size-3" />
                  Most popular
                </Badge>
              ) : null}
              <div className="space-y-2">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-semibold tracking-tight">{formatPrice(plan.priceCents)}</span>
                {plan.priceCents > 0 ? <span className="pb-1 text-sm text-muted-foreground">/{plan.interval}</span> : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Users</div>
                  <div className="mt-1 font-semibold">{plan.maxUsers === 999 ? 'Unlimited' : plan.maxUsers}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Apps</div>
                  <div className="mt-1 font-semibold">{plan.maxApps === 999 ? 'Unlimited' : plan.maxApps}</div>
                </div>
              </div>

              <div className="space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <div className="mt-0.5 rounded-full bg-zinc-900 p-1 text-white dark:border dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50">
                      <Check className="size-3" />
                    </div>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              {plan.slug === 'free' ? (
                <Button asChild variant="outline" className="w-full rounded-2xl">
                  <Link to="/register">Start free</Link>
                </Button>
              ) : (
                <Button
                  className="w-full rounded-2xl"
                  variant={plan.highlight ? 'subtle' : 'default'}
                  onClick={() => handleSubscribe(plan.slug)}
                  disabled={loadingSlug === plan.slug}
                >
                  {loadingSlug === plan.slug ? 'Redirecting...' : 'Subscribe'}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        All paid plans include a 14-day free trial.
        {!isAuthenticated ? (
          <>
            {' '}Already have an account?{' '}
            <Link to="/login" className="font-semibold text-foreground underline-offset-4 hover:underline">
              Log in
            </Link>
          </>
        ) : null}
      </p>
    </div>
  )
}
