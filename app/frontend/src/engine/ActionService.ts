import { erpClient } from '@/lib/erp-api'
import { getCached, setCache } from './utils/cache'

export interface ActionDefinition {
  id: number
  name: string
  res_model: string
  view_mode: string
  view_mode_list: string[]
  domain: any[] | false
  context: string | false
  target: string
  limit: number | false
  search_view_id: [number, string] | false
  help: string | false
  type: string
  action_type: string
  views: Array<{ view_id: [number, string] | false; view_mode: string; sequence: number }>
  // Client action fields
  tag?: string
  params?: Record<string, any>
  // URL action fields
  url?: string
}

export interface ActionResult {
  type: string
  [key: string]: any
}

export async function fetchAction(actionId: number | string, actionModel?: string): Promise<ActionDefinition> {
  const cacheKey = `action_${actionModel || ''}${actionId}`
  const cached = getCached<ActionDefinition>(cacheKey)
  if (cached) return cached

  // Support both numeric IDs and XML IDs (e.g. "sale.action_report_saleorder")
  const isXmlId = typeof actionId === 'string' && isNaN(Number(actionId))
  let url = isXmlId ? `/actions/ref/${actionId}` : `/actions/${actionId}`
  if (actionModel && !isXmlId) url += `?action_model=${actionModel}`
  const { data } = await erpClient.raw.get(url)
  setCache(cacheKey, data)
  return data
}

export async function fetchActionForModel(model: string): Promise<ActionDefinition | null> {
  try {
    const { data } = await erpClient.raw.get(`/actions/for-model/${model}`)
    return data
  } catch {
    return null
  }
}

export async function fetchMenuTree(): Promise<any[]> {
  const cacheKey = 'menu_tree'
  const cached = getCached<any[]>(cacheKey)
  if (cached) return cached

  const { data } = await erpClient.raw.get('/menus')
  setCache(cacheKey, data)
  return data
}

export async function fetchViewDefinition(model: string, viewType: string): Promise<any> {
  const cacheKey = `view_${model}_${viewType}`
  const cached = getCached<any>(cacheKey)
  if (cached) return cached

  const { data } = await erpClient.raw.get(`/views/${model}/${viewType}`)
  setCache(cacheKey, data)
  return data
}

export async function fetchDefaults(model: string, fields?: string[]): Promise<Record<string, any>> {
  const { data } = await erpClient.raw.post(`/model/${model}/defaults`, { fields })
  return data
}

export async function callOnchange(model: string, recordId: number | null, fieldName: string, fieldValue: any, currentValues: Record<string, any>): Promise<any> {
  const { data } = await erpClient.raw.post(`/model/${model}/onchange`, {
    record_id: recordId,
    field_name: fieldName,
    field_value: fieldValue,
    current_values: currentValues,
  })
  return data
}

export async function callMethod(model: string, recordIds: number[], method: string, args?: any[], kwargs?: Record<string, any>): Promise<ActionResult | any> {
  const { data } = await erpClient.raw.post(`/model/${model}/call`, {
    record_ids: recordIds,
    method,
    args: args || [],
    kwargs: kwargs || {},
  })
  return data.result
}

export function isWizardAction(result: any): boolean {
  return result && typeof result === 'object' && result.type === 'ir.actions.act_window' && result.target === 'new'
}

export function isNavigationAction(result: any): boolean {
  return result && typeof result === 'object' && result.type === 'ir.actions.act_window' && result.target !== 'new'
}

export function isUrlAction(result: any): boolean {
  return result && typeof result === 'object' && result.type === 'ir.actions.act_url'
}

export function isReportAction(result: any): boolean {
  return result && typeof result === 'object' && result.type === 'ir.actions.report'
}
