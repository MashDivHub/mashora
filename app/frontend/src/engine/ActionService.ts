import { erpClient } from '@/lib/erp-api'
import { getCached, setCache } from './utils/cache'

export type DomainLeaf = [string, string, unknown] | string
export type Domain = DomainLeaf[]

export interface ActionDefinition {
  id: number
  name: string
  res_model: string
  view_mode: string
  view_mode_list: string[]
  domain: Domain | false
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
  params?: Record<string, unknown>
  // URL action fields
  url?: string
  // Report action fields
  report_name?: string
  [key: string]: unknown
}

export interface ActionResult {
  type: string
  [key: string]: unknown
}

export interface MenuNode {
  id: number
  name: string
  parent_id?: [number, string] | false
  action?: string | false
  children?: MenuNode[]
  [key: string]: unknown
}

export interface ViewDefinition {
  arch: string
  fields: Record<string, Record<string, unknown>>
  [key: string]: unknown
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

export async function fetchMenuTree(): Promise<MenuNode[]> {
  const cacheKey = 'menu_tree'
  const cached = getCached<MenuNode[]>(cacheKey)
  if (cached) return cached

  const { data } = await erpClient.raw.get('/menus')
  setCache(cacheKey, data)
  return data
}

export async function fetchViewDefinition(model: string, viewType: string): Promise<ViewDefinition> {
  const cacheKey = `view_${model}_${viewType}`
  const cached = getCached<ViewDefinition>(cacheKey)
  if (cached) return cached

  const { data } = await erpClient.raw.get(`/views/${model}/${viewType}`)
  setCache(cacheKey, data)
  return data
}

export async function fetchDefaults(model: string, fields?: string[]): Promise<Record<string, unknown>> {
  const { data } = await erpClient.raw.post(`/model/${model}/defaults`, { fields })
  return data
}

export async function callOnchange(model: string, recordId: number | null, fieldName: string, fieldValue: unknown, currentValues: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data } = await erpClient.raw.post(`/model/${model}/onchange`, {
    record_id: recordId,
    field_name: fieldName,
    field_value: fieldValue,
    current_values: currentValues,
  })
  return data
}

export async function callMethod(model: string, recordIds: number[], method: string, args?: unknown[], kwargs?: Record<string, unknown>): Promise<ActionResult | unknown> {
  const { data } = await erpClient.raw.post(`/model/${model}/call`, {
    record_ids: recordIds,
    method,
    args: args || [],
    kwargs: kwargs || {},
  })
  return data.result
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object'
}

export function isWizardAction(result: unknown): boolean {
  return isObject(result) && result.type === 'ir.actions.act_window' && result.target === 'new'
}

export function isNavigationAction(result: unknown): boolean {
  return isObject(result) && result.type === 'ir.actions.act_window' && result.target !== 'new'
}

export function isUrlAction(result: unknown): boolean {
  return isObject(result) && result.type === 'ir.actions.act_url'
}

export function isReportAction(result: unknown): boolean {
  return isObject(result) && result.type === 'ir.actions.report'
}
