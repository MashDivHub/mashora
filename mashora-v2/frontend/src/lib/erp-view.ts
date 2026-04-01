import { formatFieldLabel } from '@/lib/format'
import type { ErpFieldDefinition } from '@/services/erp/views'

export type SupportedViewMode = 'list' | 'kanban' | 'form'

export interface ParsedViewField {
  name: string
  label: string
  type?: string
  widget?: string
  readonly?: boolean
}

export interface ParsedListView {
  columns: ParsedViewField[]
}

export interface ParsedKanbanView {
  fields: ParsedViewField[]
  mediaField?: string
  titleField?: string
  subtitleField?: string
  badgeField?: string
}

export interface ParsedFormSection {
  title: string
  fields: ParsedViewField[]
}

export interface ParsedFormView {
  sections: ParsedFormSection[]
}

function isRenderableField(field?: ErpFieldDefinition) {
  if (!field) {
    return false
  }
  return !['binary', 'html', 'one2many', 'many2many'].includes(field.type)
}

function uniqueFields(fields: ParsedViewField[]) {
  const seen = new Set<string>()
  return fields.filter((field) => {
    if (!field.name || seen.has(field.name)) {
      return false
    }
    seen.add(field.name)
    return true
  })
}

function fallbackFields(fieldDefinitions: Record<string, ErpFieldDefinition>, limit = 8) {
  const priorities = [
    'display_name',
    'name',
    'state',
    'stage_id',
    'partner_id',
    'user_id',
    'date',
    'create_date',
    'write_date',
    'amount_total',
    'email',
    'phone',
  ]

  const picked: ParsedViewField[] = []
  for (const name of priorities) {
    const field = fieldDefinitions[name]
    if (isRenderableField(field)) {
      picked.push({
        name,
        label: formatFieldLabel(name, field),
        type: field.type,
      })
    }
  }

  for (const [name, field] of Object.entries(fieldDefinitions)) {
    if (picked.length >= limit) {
      break
    }
    if (!isRenderableField(field)) {
      continue
    }
    picked.push({
      name,
      label: formatFieldLabel(name, field),
      type: field.type,
    })
  }

  return uniqueFields(picked).slice(0, limit)
}

function parseDocument(arch: string) {
  return new DOMParser().parseFromString(arch, 'text/xml')
}

function isMediaField(field: ParsedViewField) {
  return (
    field.widget?.includes('image') ||
    /(?:^|_)(icon|image|avatar|logo)(?:_|$)/.test(field.name)
  )
}

function findFirstMatchingField(fields: ParsedViewField[], priorities: string[]) {
  return fields.find((field) => priorities.includes(field.name))?.name
}

export function parseListView(arch: string, fieldDefinitions: Record<string, ErpFieldDefinition>): ParsedListView {
  const document = parseDocument(arch)
  const columns = Array.from(document.querySelectorAll('tree > field, list > field'))
    .map((node) => {
      const name = node.getAttribute('name') || ''
      const field = fieldDefinitions[name]
      if (!name || !isRenderableField(field)) {
        return null
      }
      return {
        name,
        label: node.getAttribute('string') || formatFieldLabel(name, field),
        type: field.type,
        widget: node.getAttribute('widget') || undefined,
      } as ParsedViewField
    })
    .filter((field): field is ParsedViewField => field !== null)

  return {
    columns: uniqueFields(columns).length ? uniqueFields(columns) : fallbackFields(fieldDefinitions, 8),
  }
}

export function parseKanbanView(
  arch: string,
  fieldDefinitions: Record<string, ErpFieldDefinition>
): ParsedKanbanView {
  const document = parseDocument(arch)
  const fields = Array.from(document.querySelectorAll('kanban field'))
    .map((node) => {
      const name = node.getAttribute('name') || ''
      const field = fieldDefinitions[name]
      if (!name || !isRenderableField(field)) {
        return null
      }
      return {
        name,
        label: node.getAttribute('string') || formatFieldLabel(name, field),
        type: field.type,
        widget: node.getAttribute('widget') || undefined,
      } as ParsedViewField
    })
    .filter((field): field is ParsedViewField => field !== null)

  const uniqueResolvedFields = uniqueFields(fields)
  const mediaField = uniqueResolvedFields.find((field) => isMediaField(field))?.name
  const textFields = uniqueResolvedFields.filter((field) => field.name !== mediaField && !isMediaField(field))
  const fallbackTextFields = fallbackFields(fieldDefinitions, 6).filter((field) => !isMediaField(field))
  const resolvedFields = textFields.length ? textFields : fallbackTextFields

  return {
    fields: resolvedFields,
    mediaField,
    titleField:
      findFirstMatchingField(resolvedFields, ['display_name', 'shortdesc', 'name', 'title', 'subject']) ||
      resolvedFields[0]?.name,
    subtitleField:
      findFirstMatchingField(resolvedFields, [
        'summary',
        'state',
        'stage_id',
        'partner_id',
        'user_id',
        'date',
        'create_date',
      ]) ||
      resolvedFields[1]?.name,
    badgeField: findFirstMatchingField(resolvedFields, ['state', 'priority', 'activity_state']),
  }
}

export function parseFormView(arch: string, fieldDefinitions: Record<string, ErpFieldDefinition>): ParsedFormView {
  const document = parseDocument(arch)
  const sections = new Map<string, ParsedViewField[]>()

  Array.from(document.querySelectorAll('form field')).forEach((node) => {
    const name = node.getAttribute('name') || ''
    const field = fieldDefinitions[name]
    if (!name || !isRenderableField(field)) {
      return
    }

    const pageTitle = node.closest('page')?.getAttribute('string')
    const groupTitle = node.closest('group')?.getAttribute('string')
    const sectionTitle = pageTitle || groupTitle || 'Details'

    if (!sections.has(sectionTitle)) {
      sections.set(sectionTitle, [])
    }

    sections.get(sectionTitle)!.push({
      name,
      label: node.getAttribute('string') || formatFieldLabel(name, field),
      type: field.type,
      widget: node.getAttribute('widget') || undefined,
      readonly: node.getAttribute('readonly') === '1' || field.readonly,
    })
  })

  const mappedSections = Array.from(sections.entries()).map(([title, fields]) => ({
    title,
    fields: uniqueFields(fields),
  }))

  if (!mappedSections.length) {
    return {
      sections: [
        {
          title: 'Details',
          fields: fallbackFields(fieldDefinitions, 12),
        },
      ],
    }
  }

  return { sections: mappedSections }
}

export function collectFieldNamesFromParsedViews(...views: Array<ParsedListView | ParsedKanbanView | ParsedFormView | null>) {
  const names = new Set<string>(['display_name'])

  for (const view of views) {
    if (!view) {
      continue
    }
    if ('columns' in view) {
      view.columns.forEach((field) => names.add(field.name))
    }
    if ('fields' in view) {
      view.fields.forEach((field) => names.add(field.name))
    }
    if ('mediaField' in view && view.mediaField) {
      names.add(view.mediaField)
    }
    if ('sections' in view) {
      view.sections.forEach((section) => {
        section.fields.forEach((field) => names.add(field.name))
      })
    }
  }

  return Array.from(names)
}
