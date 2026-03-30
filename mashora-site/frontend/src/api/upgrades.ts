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

export async function checkAvailableUpgrade(tenantId: string): Promise<AvailableUpgradeResponse> {
  const response = await client.get<AvailableUpgradeResponse>(`/upgrades/check/${tenantId}`)
  return response.data
}

export async function startUpgrade(tenantId: string, toVersion: string): Promise<UpgradeResponse> {
  const response = await client.post<UpgradeResponse>('/upgrades', { tenant_id: tenantId, to_version: toVersion })
  return response.data
}

export async function getUpgradeStatus(upgradeId: string): Promise<UpgradeResponse> {
  const response = await client.get<UpgradeResponse>(`/upgrades/${upgradeId}`)
  return response.data
}

export async function listUpgrades(tenantId: string): Promise<UpgradeResponse[]> {
  const response = await client.get<UpgradeResponse[]>(`/upgrades?tenant_id=${tenantId}`)
  return response.data
}
