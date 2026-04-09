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

export function formatMany2one(value: any): { id: number; name: string } | null {
  if (!value) return null
  if (Array.isArray(value)) return { id: value[0], name: value[1] || '' }
  if (typeof value === 'object' && value.id) return { id: value.id, name: value.display_name || value.name || '' }
  return null
}

export function formatSelection(value: string | false, options: [string, string][]): string {
  if (!value) return ''
  const found = options.find(([k]) => k === value)
  return found ? found[1] : String(value)
}

export function formatBoolean(value: any): boolean {
  return Boolean(value)
}
