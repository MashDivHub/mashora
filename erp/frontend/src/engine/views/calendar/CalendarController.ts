import { erpClient } from '@/lib/erp-api'

export interface CalendarEvent {
  id: number
  title: string
  start: string
  end?: string
  allDay?: boolean
  record: Record<string, any>
}

export function extractCalendarConfig(arch: any): {
  dateStartField: string
  dateStopField: string | null
  allDayField: string | null
  colorField: string | null
  displayFields: string[]
} {
  const dateStartField = arch?.date_start || 'date_start'
  const dateStopField = arch?.date_stop || arch?.date_end || null
  const allDayField = arch?.all_day || null
  const colorField = arch?.color || null

  const displayFields: string[] = [dateStartField]
  if (dateStopField) displayFields.push(dateStopField)
  if (allDayField) displayFields.push(allDayField)
  if (colorField) displayFields.push(colorField)

  // Collect field names from arch children
  if (arch?.children) {
    for (const child of arch.children) {
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
  domain: any[] = [],
): Promise<CalendarEvent[]> {
  const dateDomain: any[] = [
    [dateStartField, '>=', rangeStart],
    [dateStartField, '<=', rangeEnd],
  ]

  const { data } = await erpClient.raw.post(`/model/${model}`, {
    domain: [...domain, ...dateDomain],
    fields,
    limit: 500,
    order: `${dateStartField} asc`,
  })

  return (data.records || []).map((rec: any) => ({
    id: rec.id,
    title: rec.display_name || rec.name || `#${rec.id}`,
    start: rec[dateStartField],
    end: dateStopField ? rec[dateStopField] : undefined,
    allDay: !rec[dateStartField]?.includes(' '),
    record: rec,
  }))
}

export async function rescheduleEvent(
  model: string,
  recordId: number,
  dateStartField: string,
  newStart: string,
  dateStopField?: string | null,
  newEnd?: string,
): Promise<void> {
  const vals: Record<string, any> = { [dateStartField]: newStart }
  if (dateStopField && newEnd) vals[dateStopField] = newEnd
  await erpClient.raw.put(`/model/${model}/${recordId}`, { vals })
}
