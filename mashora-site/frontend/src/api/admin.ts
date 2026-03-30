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
  return response.data
}

export async function listAllTenants(): Promise<any[]> {
  const response = await client.get<any[]>('/admin/tenants')
  return response.data
}

export async function listAllTickets(): Promise<any[]> {
  const response = await client.get<any[]>('/admin/tickets')
  return response.data
}

export async function updateAddonStatus(addonId: string, status: string): Promise<void> {
  await client.patch(`/admin/addons/${addonId}`, { status })
}

export async function listPendingAddons(): Promise<any[]> {
  const response = await client.get<any[]>('/admin/addons/pending')
  return response.data
}
