import { rpc } from '@/services/erp/client'

export interface ErpFieldDefinition {
  string?: string
  type: string
  readonly?: boolean
  required?: boolean
  relation?: string
  selection?: Array<[string, string]>
}

export interface ViewDescription {
  arch: string
  id: number | false
  custom_view_id?: number | null
}

export interface LoadViewsResult {
  fields: Record<string, ErpFieldDefinition>
  relatedModels: Record<string, { fields: Record<string, ErpFieldDefinition> }>
  views: Record<string, ViewDescription>
}

export type ErpRecord = Record<string, unknown> & { id: number }

function normalizeContext(context?: Record<string, unknown> | string | null) {
  if (!context || typeof context === 'string' || Array.isArray(context)) {
    return {}
  }
  return context
}

export function normalizeDomain(domain?: unknown[] | string | null) {
  return Array.isArray(domain) ? domain : []
}

export async function callKw<T>(
  model: string,
  method: string,
  args: unknown[] = [],
  kwargs: Record<string, unknown> = {}
) {
  return rpc<T>(`/web/dataset/call_kw/${model}/${method}`, {
    model,
    method,
    args,
    kwargs,
  })
}

export async function loadViews(params: {
  resModel: string
  views: Array<[number | false, string]>
  context?: Record<string, unknown> | string
  actionId?: number | false
}) {
  const context = normalizeContext(params.context)
  return callKw<LoadViewsResult>(params.resModel, 'get_views', [], {
    context,
    views: params.views,
    options: {
      action_id: params.actionId || false,
      load_filters: true,
      toolbar: true,
    },
  })
}

export async function searchRead(params: {
  model: string
  domain?: unknown[] | string
  fields: string[]
  context?: Record<string, unknown> | string
  limit?: number
  offset?: number
  order?: string
}) {
  return callKw<ErpRecord[]>(params.model, 'search_read', [], {
    domain: normalizeDomain(params.domain),
    fields: params.fields,
    context: normalizeContext(params.context),
    limit: params.limit ?? 24,
    offset: params.offset ?? 0,
    order: params.order,
  })
}

export async function searchCount(params: {
  model: string
  domain?: unknown[] | string
  context?: Record<string, unknown> | string
}) {
  return callKw<number>(params.model, 'search_count', [normalizeDomain(params.domain)], {
    context: normalizeContext(params.context),
  })
}

export async function readRecords(params: {
  model: string
  ids: number[]
  fields: string[]
  context?: Record<string, unknown> | string
}) {
  if (!params.ids.length) {
    return []
  }
  return callKw<ErpRecord[]>(params.model, 'read', [params.ids, params.fields], {
    context: normalizeContext(params.context),
  })
}

export async function writeRecord(params: {
  model: string
  ids: number[]
  values: Record<string, unknown>
  context?: Record<string, unknown> | string
}) {
  return callKw<boolean>(params.model, 'write', [params.ids, params.values], {
    context: normalizeContext(params.context),
  })
}
