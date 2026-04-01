import type { ErpFieldDefinition } from '@/services/erp/views'

const numberFormatter = new Intl.NumberFormat()
const shortNumberFormatter = new Intl.NumberFormat(undefined, { notation: 'compact' })
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export function toInitials(value?: string | null) {
  if (!value) {
    return 'MS'
  }
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'MS'
}

export function titleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function formatFieldLabel(name: string, field?: ErpFieldDefinition) {
  return field?.string || titleCase(name)
}

export function recordTitle(record: Record<string, unknown>) {
  const displayName = record.display_name ?? record.name
  if (typeof displayName === 'string' && displayName.trim()) {
    return displayName
  }
  return `Record #${record.id ?? 'New'}`
}

export function formatShortNumber(value: number) {
  return shortNumberFormatter.format(value)
}

export function formatFieldValue(value: unknown, field?: ErpFieldDefinition) {
  if (value === null || value === undefined || value === false) {
    return '—'
  }

  if (Array.isArray(value)) {
    if (typeof value[1] === 'string') {
      return value[1]
    }
    return value
      .map((entry) => (typeof entry === 'string' || typeof entry === 'number' ? String(entry) : ''))
      .filter(Boolean)
      .join(', ') || '—'
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  if (typeof value === 'number') {
    if (field?.type === 'float' || field?.type === 'monetary') {
      return value.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })
    }
    return numberFormatter.format(value)
  }

  if (typeof value === 'string') {
    if (field?.selection?.length) {
      const label = field.selection.find(([selectionValue]) => selectionValue === value)?.[1]
      if (label) {
        return label
      }
    }
    if (field?.type === 'date') {
      const date = new Date(value)
      if (!Number.isNaN(date.getTime())) {
        return dateFormatter.format(date)
      }
    }
    if (field?.type === 'datetime') {
      const date = new Date(value)
      if (!Number.isNaN(date.getTime())) {
        return dateTimeFormatter.format(date)
      }
    }
    return value
  }

  return String(value)
}
