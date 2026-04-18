export function formatDate(value: string | null): string {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value))
  } catch { return value }
}

export function formatDateTime(value: string | null): string {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
  } catch { return value }
}

export function formatFloat(value: number | null | false, precision: number = 2): string {
  if (value === null || value === false || value === undefined) return ''
  return Number(value).toFixed(precision)
}

export function formatInteger(value: number | null | false): string {
  if (value === null || value === false || value === undefined) return ''
  return new Intl.NumberFormat().format(Math.round(Number(value)))
}

export function formatMonetary(value: number | null | false, currencySymbol: string = '$', precision: number = 2): string {
  if (value === null || value === false || value === undefined) return ''
  return `${currencySymbol}\u00a0${Number(value).toFixed(precision)}`
}

export function formatMany2one(value: unknown): { id: number; name: string } | null {
  if (!value) return null
  if (Array.isArray(value)) return { id: Number(value[0]), name: String(value[1] ?? '') }
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const r = value as { id: number; display_name?: string; name?: string }
    return { id: r.id, name: r.display_name || r.name || '' }
  }
  return null
}

export function formatSelection(value: string | false, options: [string, string][]): string {
  if (!value) return ''
  const found = options.find(([k]) => k === value)
  return found ? found[1] : String(value)
}

export function formatBoolean(value: unknown): boolean {
  return Boolean(value)
}
