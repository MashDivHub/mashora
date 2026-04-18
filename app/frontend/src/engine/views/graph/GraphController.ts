import { erpClient } from '@/lib/erp-api'

export interface GraphConfig {
  type: 'bar' | 'line' | 'pie'
  measures: { field: string; label: string; type: string }[]
  dimensions: { field: string; label: string }[]
  stacked: boolean
}

interface FieldMeta { type?: string; string?: string; [k: string]: unknown }

interface GraphArchChild {
  tag?: string
  name?: string
  type?: string
  string?: string
  children?: GraphArchChild[]
}
interface GraphArchNode {
  type?: string
  stacked?: string
  children?: GraphArchChild[]
}

export function extractGraphConfig(arch: GraphArchNode | string | null | undefined, fields: Record<string, FieldMeta>): GraphConfig {
  const archNode = typeof arch === 'object' && arch !== null ? arch : null
  const rawType = archNode?.type
  const type: 'bar' | 'line' | 'pie' =
    rawType === 'bar' || rawType === 'line' || rawType === 'pie' ? rawType : 'bar'
  const stacked = archNode?.stacked === 'True' || archNode?.stacked === '1'
  const measures: GraphConfig['measures'] = []
  const dimensions: GraphConfig['dimensions'] = []

  if (archNode?.children) {
    for (const child of archNode.children) {
      if (child.tag === 'field' && child.name) {
        const meta = fields[child.name]
        if (child.type === 'measure' || meta?.type === 'integer' || meta?.type === 'float' || meta?.type === 'monetary') {
          measures.push({ field: child.name, label: meta?.string || child.name, type: meta?.type || 'float' })
        } else {
          dimensions.push({ field: child.name, label: meta?.string || child.name })
        }
      }
    }
  }

  // Default measure if none found
  if (measures.length === 0) measures.push({ field: '__count', label: 'Count', type: 'integer' })
  // Default dimension if none found
  if (dimensions.length === 0 && Object.keys(fields).length > 0) {
    const firstSelection = Object.entries(fields).find(([, m]) => m.type === 'selection')
    if (firstSelection) dimensions.push({ field: firstSelection[0], label: firstSelection[1].string || firstSelection[0] })
  }

  return { type, measures, dimensions, stacked }
}

export type DomainTerm = string | [string, string, unknown]
export type GraphRow = Record<string, string | number>

export async function loadGraphData(
  model: string,
  config: GraphConfig,
  domain: DomainTerm[] = [],
): Promise<GraphRow[]> {
  const groupby = config.dimensions.map(d => d.field)
  const measureFields = config.measures.map(m => m.field).filter(f => f !== '__count')

  const { data } = await erpClient.raw.post(`/model/${model}/read_group`, {
    domain: domain.length ? domain : undefined,
    fields: measureFields,
    groupby,
  })

  return ((data.groups || []) as Array<Record<string, unknown>>).map((g) => {
    const result: GraphRow = {}
    // Dimension values
    for (const dim of config.dimensions) {
      const val = g[dim.field]
      result[dim.field] = Array.isArray(val) ? String(val[1] ?? '') : String(val ?? 'N/A')
    }
    // Measure values
    for (const m of config.measures) {
      const raw = m.field === '__count' ? g[`${groupby[0]}_count`] : g[m.field]
      result[m.field] = typeof raw === 'number' ? raw : Number(raw) || 0
    }
    return result
  })
}
