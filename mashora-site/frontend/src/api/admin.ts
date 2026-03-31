import client from './client'

export interface PlatformStats {
  total_orgs: number
  total_users: number
  total_tenants: number
  active_subscriptions: number
  monthly_revenue_cents: number
}

export async function getStats(): Promise<PlatformStats> {
  const response = await client.get<PlatformStats>('/admin/stats')
  const data = response.data as any
  return {
    total_orgs: Number(data.total_orgs ?? data.total_organizations ?? 0),
    total_users: Number(data.total_users ?? 0),
    total_tenants: Number(data.total_tenants ?? 0),
    active_subscriptions: Number(data.active_subscriptions ?? 0),
    monthly_revenue_cents: Number(data.monthly_revenue_cents ?? 0),
  }
}

export async function listAllTenants(): Promise<any[]> {
  const response = await client.get<any[] | { tenants: any[] }>('/admin/tenants')
  return Array.isArray(response.data) ? response.data : response.data.tenants ?? []
}

export async function listAllTickets(): Promise<any[]> {
  const response = await client.get<any[]>('/admin/tickets')
  return response.data
}

export async function updateAddonStatus(addonId: string, status: string): Promise<void> {
  await client.patch(`/admin/addons/${addonId}/status`, null, {
    params: { status },
  })
}

export async function listPendingAddons(): Promise<any[]> {
  const response = await client.get<any[]>('/admin/addons/pending')
  return Array.isArray(response.data) ? response.data : []
}
