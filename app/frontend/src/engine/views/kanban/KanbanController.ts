import { erpClient } from '@/lib/erp-api'

/** Kanban group "value": a many2one tuple `[id, name]`, a selection string, a number, false, or null. */
export type KanbanGroupValue = [number, string] | string | number | boolean | null

/** Domain term: either a leaf `[field, op, value]` or a boolean operator `'&' | '|' | '!'`. */
export type DomainTerm = [string, string, unknown] | string

interface ReadGroupRow {
  [key: string]: unknown
  __domain?: DomainTerm[]
}

export interface KanbanColumn {
  groupValue: KanbanGroupValue
  groupLabel: string
  count: number
  records: Record<string, unknown>[]
  aggregates: Record<string, number>
}

export async function loadKanbanData(
  model: string,
  groupByField: string,
  domain: DomainTerm[] = [],
  fields: string[] = [],
): Promise<KanbanColumn[]> {
  // Use read_group to get column structure
  const { data: groupData } = await erpClient.raw.post(`/model/${model}/read_group`, {
    domain: domain.length ? domain : undefined,
    fields: [...fields, groupByField],
    groupby: [groupByField],
  })

  const columns: KanbanColumn[] = await Promise.all(((groupData.groups || []) as ReadGroupRow[]).map(async (group) => {
    const groupValue = group[groupByField] as KanbanGroupValue
    const groupLabel = Array.isArray(groupValue) ? groupValue[1] : String(groupValue || 'Undefined')
    const groupDomain: DomainTerm[] = group.__domain || [...domain, [groupByField, '=', Array.isArray(groupValue) ? groupValue[0] : groupValue]]

    // Fetch actual records for this group
    const { data: recordData } = await erpClient.raw.post(`/model/${model}`, {
      domain: groupDomain,
      fields: fields.length ? fields : null,
      limit: 40,
      order: 'sequence asc, id desc',
    })

    return {
      groupValue,
      groupLabel,
      count: Number(group[`${groupByField}_count`] ?? recordData.total ?? 0),
      records: recordData.records || [],
      aggregates: {},
    }
  }))

  return columns
}

export async function moveRecord(
  model: string,
  recordId: number,
  groupByField: string,
  newGroupValue: KanbanGroupValue,
): Promise<void> {
  await erpClient.raw.put(`/model/${model}/${recordId}`, {
    vals: { [groupByField]: Array.isArray(newGroupValue) ? newGroupValue[0] : newGroupValue },
  })
}

/** Parsed arch node shape used by `extractKanbanFields` (minimal — only fields we touch). */
interface ArchNode {
  tag?: string
  name?: string
  attrs?: { default_group_by?: string }
  default_group_by?: string
  children?: ArchNode[]
}

export function extractKanbanFields(arch: ArchNode | string | null | undefined): { groupByField: string | null; cardFields: string[] } {
  // If arch is a raw XML string, we cannot walk it here — return minimal defaults.
  if (typeof arch === 'string') {
    return { groupByField: null, cardFields: ['id', 'name'] }
  }
  const groupByField = arch?.default_group_by || arch?.attrs?.default_group_by || null
  const cardFields: string[] = []

  function walk(node: ArchNode | null | undefined) {
    if (!node) return
    if (node.tag === 'field' && node.name) {
      if (!cardFields.includes(node.name)) cardFields.push(node.name)
    }
    if (node.children) node.children.forEach(walk)
  }
  walk(arch)

  if (groupByField && !cardFields.includes(groupByField)) cardFields.push(groupByField)
  if (!cardFields.includes('id')) cardFields.unshift('id')
  if (!cardFields.includes('name') && cardFields.length < 3) cardFields.push('name')

  return { groupByField, cardFields }
}
