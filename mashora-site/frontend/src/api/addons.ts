import client from './client'

export interface AddonResponse {
  id: string
  technical_name: string
  display_name: string
  summary: string
  author_name: string | null
  category: string
  version: string
  price_cents: number
  currency: string
  icon_url: string | null
  download_count: number
  rating_avg: number
  rating_count: number
  status: string
  created_at: string
}

export interface AddonVersionResponse {
  id: string
  version: string
  changelog: string
  file_size: number
  mashora_version_compat: string
  published_at: string
}

export interface AddonDetail extends AddonResponse {
  description: string
  mashora_version_min: string
  versions: AddonVersionResponse[]
}

export interface AddonReviewResponse {
  id: string
  user_id: string
  user_email: string | null
  rating: number
  comment: string
  created_at: string
}

export interface AddonList {
  addons: AddonResponse[]
  total: number
  page: number
  per_page: number
}

export async function browseAddons(params: {
  q?: string
  category?: string
  page?: number
  per_page?: number
  sort_by?: string
}): Promise<AddonList> {
  const res = await client.get('/addons', { params })
  return res.data
}

export async function getAddon(technicalName: string): Promise<AddonDetail> {
  const res = await client.get(`/addons/${technicalName}`)
  return res.data
}

export async function installAddon(
  technicalName: string,
  tenantId: string,
  versionId?: string
): Promise<void> {
  await client.post(`/addons/${technicalName}/install`, { tenant_id: tenantId, version_id: versionId })
}

export async function reviewAddon(
  technicalName: string,
  rating: number,
  comment?: string
): Promise<AddonReviewResponse> {
  const res = await client.post(`/addons/${technicalName}/reviews`, { rating, comment })
  return res.data
}

export async function getAddonReviews(technicalName: string): Promise<AddonReviewResponse[]> {
  const res = await client.get(`/addons/${technicalName}/reviews`)
  return res.data
}

export async function submitAddon(data: {
  technical_name: string
  display_name: string
  summary: string
  description: string
  category: string
  price_cents?: number
}): Promise<AddonResponse> {
  const res = await client.post('/addons', data)
  return res.data
}

export async function getPublisherAddons(): Promise<AddonResponse[]> {
  const res = await client.get('/addons/mine')
  return res.data
}

export async function uploadVersion(
  technicalName: string,
  formData: FormData
): Promise<AddonVersionResponse> {
  const res = await client.post(`/addons/${technicalName}/versions`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}
