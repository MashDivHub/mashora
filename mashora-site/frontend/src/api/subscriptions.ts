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

export async function getPlans(): Promise<PlanInfo[]> {
  const res = await client.get<PlanInfo[]>('/billing/plans')
  return res.data
}

export async function getSubscriptions(): Promise<SubscriptionResponse[]> {
  const res = await client.get<SubscriptionResponse[]>('/billing/subscriptions')
  return res.data
}

export async function createCheckout(plan: string): Promise<{ checkout_url: string }> {
  const res = await client.post<{ checkout_url: string }>('/billing/checkout', { plan })
  return res.data
}

export async function getPortalUrl(): Promise<{ portal_url: string }> {
  const res = await client.post<{ portal_url: string }>('/billing/portal')
  return res.data
}

export async function cancelSubscription(id: string): Promise<void> {
  await client.delete(`/billing/subscriptions/${id}`)
}
