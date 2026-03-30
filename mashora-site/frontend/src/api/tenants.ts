import client from './client'

export interface Tenant {
  id: number
  db_name: string
  subdomain: string
  status: string
  created_at: string
}

export interface CreateTenantPayload {
  db_name: string
  subdomain: string
}

export async function listTenants(): Promise<Tenant[]> {
  const response = await client.get<Tenant[]>('/tenants')
  return response.data
}

export async function createTenant(db_name: string, subdomain: string): Promise<Tenant> {
  const response = await client.post<Tenant>('/tenants', { db_name, subdomain })
  return response.data
}

export async function getTenant(id: number): Promise<Tenant> {
  const response = await client.get<Tenant>(`/tenants/${id}`)
  return response.data
}

export async function suspendTenant(id: number): Promise<Tenant> {
  const response = await client.post<Tenant>(`/tenants/${id}/suspend`)
  return response.data
}
