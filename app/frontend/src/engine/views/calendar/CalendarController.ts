import { erpClient } from '@/lib/erp-api'

export type DomainTerm = [string, string, unknown] | string
export type Domain = DomainTerm[]

interface ArchNode {
  tag?: string
  name?: string
  date_start?: string
  date_stop?: string
  date_end?: string
  all_day?: string
  color?: string
  children?: ArchNode[]
  [key: string]: unknown
}

interface CalendarRecord {
  id: number
  display_name?: string
  name?: string
  [key: string]: unknown
}

export interface CalendarEvent {
  id: number
  title: string
  start: string
  end?: string
  allDay?: boolean
  record: Record<string, unknown>
}

export function extractCalendarConfig(arch: ArchNode | string | null | undefined): {
  dateStartField: string
  dateStopField: string | null
  allDayField: string | null
  colorField: string | null
  displayFields: string[]
} {
  const archNode: ArchNode | null = typeof arch === 'string' || !arch ? null : arch
  const dateStartField = archNode?.date_start || 'date_start'
  const dateStopField = archNode?.date_stop || archNode?.date_end || null
  const allDayField = archNode?.all_day || null
  const colorField = archNode?.color || null

  const displayFields: string[] = [dateStartField]
  if (dateStopField) displayFields.push(dateStopField)
  if (allDayField) displayFields.push(allDayField)
  if (colorField) displayFields.push(colorField)

  // Collect field names from arch children
  if (archNode?.children) {
    for (const child of archNode.children) {
      if (child.tag === 'field' && child.name && !displayFields.includes(child.name)) {
        displayFields.push(child.name)
      }
    }
  }

  if (!displayFields.includes('name')) displayFields.push('name')
  if (!displayFields.includes('id')) displayFields.unshift('id')

  return { dateStartField, dateStopField, allDayField, colorField, displayFields }
}

export async function loadCalendarEvents(
  model: string,
  dateStartField: string,
  dateStopField: string | null,
  fields: string[],
  rangeStart: string,
  rangeEnd: string,
  domain: Domain = [],
): Promise<CalendarEvent[]> {
  const dateDomain: Domain = [
    [dateStartField, '>=', rangeStart],
    [dateStartField, '<=', rangeEnd],
  ]

  const { data } = await erpClient.raw.post(`/model/${model}`, {
    domain: [...domain, ...dateDomain],
    fields,
    limit: 500,
    order: `${dateStartField} asc`,
  })

  return ((data.records || []) as CalendarRecord[]).map((rec) => {
    const start = String(rec[dateStartField] ?? '')
    return {
      id: rec.id,
      title: rec.display_name || rec.name || `#${rec.id}`,
      start,
      end: dateStopField ? String(rec[dateStopField] ?? '') || undefined : undefined,
      allDay: !start.includes(' '),
      record: rec,
    }
  })
}

export async function rescheduleEvent(
  model: string,
  recordId: number,
  dateStartField: string,
  newStart: string,
  dateStopField?: string | null,
  newEnd?: string,
): Promise<void> {
  const vals: Record<string, unknown> = { [dateStartField]: newStart }
  if (dateStopField && newEnd) vals[dateStopField] = newEnd
  await erpClient.raw.put(`/model/${model}/${recordId}`, { vals })
}
