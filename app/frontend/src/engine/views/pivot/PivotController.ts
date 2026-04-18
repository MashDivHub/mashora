import { erpClient } from '@/lib/erp-api'

export type DomainTerm = [string, string, unknown] | string
export type Domain = DomainTerm[]

interface ArchNode {
  tag?: string
  name?: string
  type?: string
  children?: ArchNode[]
  [key: string]: unknown
}

interface FieldMeta {
  string?: string
  type?: string
  [key: string]: unknown
}

interface ReadGroupRow {
  __domain?: Domain
  [key: string]: unknown
}

export interface PivotConfig {
  rowFields: { field: string; label: string }[]
  colFields: { field: string; label: string }[]
  measures: { field: string; label: string; type: string }[]
}

export interface PivotRow {
  label: string
  values: Record<string, number>
  children?: PivotRow[]
  isExpanded?: boolean
  depth: number
  domain: Domain
}

export function extractPivotConfig(arch: ArchNode | string | null | undefined, fields: Record<string, FieldMeta>): PivotConfig {
  const rowFields: PivotConfig['rowFields'] = []
  const colFields: PivotConfig['colFields'] = []
  const measures: PivotConfig['measures'] = []

  const archNode: ArchNode | null = typeof arch === 'string' || !arch ? null : arch

  if (archNode?.children) {
    for (const child of archNode.children) {
      if (child.tag === 'field' && child.name) {
        const meta = fields[child.name]
        const label = meta?.string || child.name

        if (child.type === 'measure') {
          measures.push({ field: child.name, label, type: meta?.type || 'float' })
        } else if (child.type === 'col') {
          colFields.push({ field: child.name, label })
        } else {
          rowFields.push({ field: child.name, label })
        }
      }
    }
  }

  if (measures.length === 0) measures.push({ field: '__count', label: 'Count', type: 'integer' })

  return { rowFields, colFields, measures }
}

export async function loadPivotData(
  model: string,
  config: PivotConfig,
  domain: Domain = [],
): Promise<PivotRow[]> {
  if (config.rowFields.length === 0) return []

  const groupby = config.rowFields.map(r => r.field)
  const measureFields = config.measures.map(m => m.field).filter(f => f !== '__count')

  const { data } = await erpClient.raw.post(`/model/${model}/read_group`, {
    domain: domain.length ? domain : undefined,
    fields: measureFields,
    groupby: [groupby[0]], // First level only
  })

  return ((data.groups || []) as ReadGroupRow[]).map((g) => {
    const val = g[groupby[0]]
    const label = Array.isArray(val) ? String(val[1]) : String(val ?? 'N/A')

    const values: Record<string, number> = {}
    for (const m of config.measures) {
      if (m.field === '__count') {
        values[m.field] = Number(g[`${groupby[0]}_count`]) || 0
      } else {
        values[m.field] = Number(g[m.field]) || 0
      }
    }

    return {
      label,
      values,
      depth: 0,
      domain: g.__domain || [...domain, [groupby[0], '=', Array.isArray(val) ? val[0] : val]] as Domain,
    }
  })
}

export async function expandPivotRow(
  model: string,
  config: PivotConfig,
  parentRow: PivotRow,
  nextGroupField: string,
): Promise<PivotRow[]> {
  const measureFields = config.measures.map(m => m.field).filter(f => f !== '__count')

  const { data } = await erpClient.raw.post(`/model/${model}/read_group`, {
    domain: parentRow.domain,
    fields: measureFields,
    groupby: [nextGroupField],
  })

  return ((data.groups || []) as ReadGroupRow[]).map((g) => {
    const val = g[nextGroupField]
    const label = Array.isArray(val) ? String(val[1]) : String(val ?? 'N/A')

    const values: Record<string, number> = {}
    for (const m of config.measures) {
      if (m.field === '__count') {
        values[m.field] = Number(g[`${nextGroupField}_count`]) || 0
      } else {
        values[m.field] = Number(g[m.field]) || 0
      }
    }

    return {
      label,
      values,
      depth: parentRow.depth + 1,
      domain: g.__domain || [...parentRow.domain, [nextGroupField, '=', Array.isArray(val) ? val[0] : val]] as Domain,
    }
  })
}
