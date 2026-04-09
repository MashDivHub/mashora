import { erpClient } from '@/lib/erp-api'

export interface KanbanColumn {
  groupValue: any           // e.g., [1, "New"] for many2one
  groupLabel: string        // display name
  count: number
  records: Record<string, any>[]
  aggregates: Record<string, number>
}

export async function loadKanbanData(
  model: string,
  groupByField: string,
  domain: any[] = [],
  fields: string[] = [],
): Promise<KanbanColumn[]> {
  // Use read_group to get column structure
  const { data: groupData } = await erpClient.raw.post(`/model/${model}/read_group`, {
    domain: domain.length ? domain : undefined,
    fields: [...fields, groupByField],
    groupby: [groupByField],
  })

  const columns: KanbanColumn[] = []
  for (const group of groupData.groups || []) {
    const groupValue = group[groupByField]
    const groupLabel = Array.isArray(groupValue) ? groupValue[1] : String(groupValue || 'Undefined')
    const groupDomain = group.__domain || [...domain, [groupByField, '=', Array.isArray(groupValue) ? groupValue[0] : groupValue]]

    // Fetch actual records for this group
    const { data: recordData } = await erpClient.raw.post(`/model/${model}`, {
      domain: groupDomain,
      fields: fields.length ? fields : null,
      limit: 40,
      order: 'sequence asc, id desc',
    })

    columns.push({
      groupValue,
      groupLabel,
      count: group[`${groupByField}_count`] || recordData.total || 0,
      records: recordData.records || [],
      aggregates: {},
    })
  }

  return columns
}

export async function moveRecord(
  model: string,
  recordId: number,
  groupByField: string,
  newGroupValue: any,
): Promise<void> {
  await erpClient.raw.put(`/model/${model}/${recordId}`, {
    vals: { [groupByField]: Array.isArray(newGroupValue) ? newGroupValue[0] : newGroupValue },
  })
}

export function extractKanbanFields(arch: any): { groupByField: string | null; cardFields: string[] } {
  const groupByField = arch?.default_group_by || arch?.attrs?.default_group_by || null
  const cardFields: string[] = []

  function walk(node: any) {
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
