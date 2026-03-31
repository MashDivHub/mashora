import client from './client'

export interface UpgradeResponse {
  id: string
  tenant_id: string
  from_version: string
  to_version: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  started_at: string | null
  completed_at: string | null
  log: string | null
  created_at: string
}

export interface AvailableUpgradeResponse {
  current_version: string
  latest_version: string
  available: boolean
}

function normalizeUpgrade(data: any): UpgradeResponse {
  return {
    id: String(data.id),
    tenant_id: String(data.tenant_id),
    from_version: data.from_version ?? '',
    to_version: data.to_version ?? '',
    status: data.status ?? 'pending',
    started_at: data.started_at ?? null,
    completed_at: data.completed_at ?? null,
    log: data.log ?? null,
    created_at: data.created_at ?? new Date().toISOString(),
  }
}

export async function checkAvailableUpgrade(tenantId: string): Promise<AvailableUpgradeResponse> {
  const response = await client.get<AvailableUpgradeResponse>('/upgrades/available', {
    params: { tenant_id: tenantId },
  })
  return response.data
}

export async function startUpgrade(tenantId: string, toVersion: string): Promise<UpgradeResponse> {
  const response = await client.post<UpgradeResponse>('/upgrades', { tenant_id: tenantId, to_version: toVersion })
  return normalizeUpgrade(response.data)
}

export async function getUpgradeStatus(upgradeId: string): Promise<UpgradeResponse> {
  const response = await client.get<UpgradeResponse>(`/upgrades/${upgradeId}/status`)
  return normalizeUpgrade(response.data)
}

export async function listUpgrades(tenantId: string): Promise<UpgradeResponse[]> {
  const response = await client.get<UpgradeResponse[]>('/upgrades', {
    params: { tenant_id: tenantId },
  })
  return response.data.map(normalizeUpgrade)
}
