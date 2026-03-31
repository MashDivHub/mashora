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

function normalizeAddon(data: any): AddonResponse {
  return {
    id: String(data.id),
    technical_name: data.technical_name ?? '',
    display_name: data.display_name ?? '',
    summary: data.summary ?? '',
    author_name: data.author_name ?? null,
    category: data.category ?? 'Other',
    version: data.version ?? '',
    price_cents: Number(data.price_cents ?? 0),
    currency: data.currency ?? 'USD',
    icon_url: data.icon_url ?? null,
    download_count: Number(data.download_count ?? 0),
    rating_avg: Number(data.rating_avg ?? 0),
    rating_count: Number(data.rating_count ?? 0),
    status: data.status ?? 'pending',
    created_at: data.created_at ?? new Date().toISOString(),
  }
}

function normalizeAddonVersion(data: any): AddonVersionResponse {
  return {
    id: String(data.id),
    version: data.version ?? '',
    changelog: data.changelog ?? '',
    file_size: Number(data.file_size ?? 0),
    mashora_version_compat: data.mashora_version_compat ?? '',
    published_at: data.published_at ?? new Date().toISOString(),
  }
}

function normalizeAddonReview(data: any): AddonReviewResponse {
  return {
    id: String(data.id),
    user_id: String(data.user_id),
    user_email: data.user_email ?? null,
    rating: Number(data.rating ?? 0),
    comment: data.comment ?? '',
    created_at: data.created_at ?? new Date().toISOString(),
  }
}

export async function browseAddons(params: {
  q?: string
  category?: string
  page?: number
  per_page?: number
  sort_by?: string
}): Promise<AddonList> {
  const res = await client.get('/addons', { params })
  return {
    addons: (res.data.addons ?? []).map(normalizeAddon),
    total: Number(res.data.total ?? 0),
    page: Number(res.data.page ?? 1),
    per_page: Number(res.data.per_page ?? params.per_page ?? 20),
  }
}

export async function getAddon(technicalName: string): Promise<AddonDetail> {
  const res = await client.get(`/addons/${technicalName}`)
  return {
    ...normalizeAddon(res.data),
    description: res.data.description ?? '',
    mashora_version_min: res.data.mashora_version_min ?? '19.0',
    versions: (res.data.versions ?? []).map(normalizeAddonVersion),
  }
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
  const res = await client.post(`/addons/${technicalName}/review`, { rating, comment })
  return normalizeAddonReview(res.data)
}

export async function getAddonReviews(technicalName: string): Promise<AddonReviewResponse[]> {
  const res = await client.get(`/addons/${technicalName}/reviews`)
  return (res.data ?? []).map(normalizeAddonReview)
}

export async function submitAddon(data: {
  technical_name: string
  display_name: string
  summary: string
  description: string
  category: string
  price_cents?: number
}): Promise<AddonResponse> {
  const res = await client.post('/publisher/addons', data)
  return normalizeAddon(res.data)
}

export async function getPublisherAddons(): Promise<AddonResponse[]> {
  const res = await client.get('/publisher/addons')
  return (res.data ?? []).map(normalizeAddon)
}

export async function uploadVersion(
  technicalName: string,
  formData: FormData
): Promise<AddonVersionResponse> {
  const res = await client.post(`/publisher/addons/${technicalName}/versions`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return normalizeAddonVersion(res.data)
}
