export const fmtMoney = (n: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)

export const fmtRelativeTime = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return date.toLocaleDateString()
}

export const CATEGORY_COLORS = [
  'bg-slate-500', 'bg-red-500', 'bg-amber-500', 'bg-emerald-500',
  'bg-cyan-500', 'bg-blue-500', 'bg-violet-500', 'bg-pink-500',
  'bg-fuchsia-500',
]

export const categoryColorClass = (idx: number): string =>
  CATEGORY_COLORS[idx % CATEGORY_COLORS.length] ?? CATEGORY_COLORS[0]
