import client from './client'

export interface PlanInfo {
  name: string
  slug: string
  price_cents: number
  max_users: number
  max_apps: number
  features: Record<string, any>
}

export interface SubscriptionResponse {
  id: string
  plan: string
  amount_cents: number
  currency: string
  interval: string
  status: string
  current_period_start: string | null
  current_period_end: string | null
}

function normalizePlan(plan: any): PlanInfo {
  return {
    name: plan.name ?? '',
    slug: plan.slug ?? '',
    price_cents: Number(plan.price_cents ?? 0),
    max_users: Number(plan.max_users ?? 0),
    max_apps: Number(plan.max_apps ?? 0),
    features: plan.features ?? {},
  }
}

function normalizeSubscription(subscription: any): SubscriptionResponse {
  return {
    id: String(subscription.id),
    plan: subscription.plan ?? 'free',
    amount_cents: Number(subscription.amount_cents ?? 0),
    currency: subscription.currency ?? 'usd',
    interval: subscription.interval ?? 'month',
    status: subscription.status ?? 'inactive',
    current_period_start: subscription.current_period_start ?? null,
    current_period_end: subscription.current_period_end ?? null,
  }
}

export async function getPlans(): Promise<PlanInfo[]> {
  const res = await client.get<PlanInfo[]>('/subscriptions/plans')
  return res.data.map(normalizePlan)
}

export async function getSubscriptions(): Promise<SubscriptionResponse[]> {
  const res = await client.get<SubscriptionResponse[]>('/subscriptions')
  return res.data.map(normalizeSubscription)
}

export async function createCheckout(plan: string): Promise<{ checkout_url: string }> {
  const res = await client.post<{ checkout_url: string }>('/subscriptions/checkout', { plan })
  return res.data
}

export async function getPortalUrl(): Promise<{ portal_url: string }> {
  const res = await client.post<{ portal_url: string }>('/subscriptions/portal')
  return res.data
}

export async function cancelSubscription(id: string): Promise<void> {
  await client.delete(`/subscriptions/${id}`)
}
