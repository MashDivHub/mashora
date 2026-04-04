import client from './client'

export interface Tenant {
  id: string
  org_id?: string
  db_name: string
  subdomain: string
  status: string
  mashora_version?: string | null
  created_at: string
  last_accessed_at?: string | null
}

export interface CreateTenantPayload {
  db_name: string
  subdomain: string
}

interface TenantListResponse {
  tenants: Tenant[]
  total: number
}

function normalizeTenant(data: any): Tenant {
  return {
    id: String(data.id),
    org_id: data.org_id ? String(data.org_id) : undefined,
    db_name: data.db_name ?? '',
    subdomain: data.subdomain ?? '',
    status: data.status ?? 'pending',
    mashora_version: data.mashora_version ?? null,
    created_at: data.created_at ?? new Date().toISOString(),
    last_accessed_at: data.last_accessed_at ?? null,
  }
}

export async function listTenants(): Promise<Tenant[]> {
  const response = await client.get<Tenant[] | TenantListResponse>('/tenants')
  const payload = response.data
  const tenants = Array.isArray(payload) ? payload : payload.tenants
  return tenants.map(normalizeTenant)
}

export async function createTenant(db_name: string, subdomain: string): Promise<Tenant> {
  const response = await client.post<Tenant>('/tenants', { db_name, subdomain })
  return normalizeTenant(response.data)
}

export async function getTenant(id: string): Promise<Tenant> {
  const response = await client.get<Tenant>(`/tenants/${id}`)
  return normalizeTenant(response.data)
}

export async function suspendTenant(id: string): Promise<Tenant> {
  const response = await client.post<Tenant>(`/tenants/${id}/suspend`)
  return normalizeTenant(response.data)
}
