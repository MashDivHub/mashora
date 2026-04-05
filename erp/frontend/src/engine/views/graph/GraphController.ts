import { erpClient } from '@/lib/erp-api'

export interface GraphConfig {
  type: 'bar' | 'line' | 'pie'
  measures: { field: string; label: string; type: string }[]
  dimensions: { field: string; label: string }[]
  stacked: boolean
}

export function extractGraphConfig(arch: any, fields: Record<string, any>): GraphConfig {
  let type: 'bar' | 'line' | 'pie' = (arch?.type as any) || 'bar'
  const stacked = arch?.stacked === 'True' || arch?.stacked === '1'
  const measures: GraphConfig['measures'] = []
  const dimensions: GraphConfig['dimensions'] = []

  if (arch?.children) {
    for (const child of arch.children) {
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
    const firstSelection = Object.entries(fields).find(([, m]) => (m as any).type === 'selection')
    if (firstSelection) dimensions.push({ field: firstSelection[0], label: (firstSelection[1] as any).string })
  }

  return { type, measures, dimensions, stacked }
}

export async function loadGraphData(
  model: string,
  config: GraphConfig,
  domain: any[] = [],
): Promise<any[]> {
  const groupby = config.dimensions.map(d => d.field)
  const measureFields = config.measures.map(m => m.field).filter(f => f !== '__count')

  const { data } = await erpClient.raw.post(`/model/${model}/read_group`, {
    domain: domain.length ? domain : undefined,
    fields: measureFields,
    groupby,
  })

  return (data.groups || []).map((g: any) => {
    const result: Record<string, any> = {}
    // Dimension values
    for (const dim of config.dimensions) {
      const val = g[dim.field]
      result[dim.field] = Array.isArray(val) ? val[1] : String(val ?? 'N/A')
    }
    // Measure values
    for (const m of config.measures) {
      if (m.field === '__count') {
        result[m.field] = g[`${groupby[0]}_count`] || 0
      } else {
        result[m.field] = g[m.field] || 0
      }
    }
    return result
  })
}
