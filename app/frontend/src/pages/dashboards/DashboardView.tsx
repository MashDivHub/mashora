import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button, Card, CardContent, Skeleton } from '@mashora/design-system'
import { LayoutDashboard, Code2, Eye, Download } from 'lucide-react'
import { PageHeader, toast } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

function fmt(dateStr: string | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

interface Sheet {
  id: string
  name: string
  cells?: Record<string, unknown>
  cols?: unknown[]
  rows?: unknown[]
  colNumber?: number
  rowNumber?: number
}

function tryParseSpreadsheet(raw: string | null | undefined): { sheets: Sheet[]; revision_id?: string } | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return parsed
  } catch { return null }
}

export default function DashboardView() {
  const { id } = useParams<{ id: string }>()
  const [view, setView] = useState<'preview' | 'raw'>('preview')

  const { data, isLoading } = useQuery({
    queryKey: ['spreadsheet.dashboard', id],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/spreadsheet.dashboard', {
        domain: [['id', '=', Number(id)]],
        fields: ['id', 'name', 'spreadsheet_data', 'create_date', 'write_date'],
        limit: 1,
      })
      return data?.records?.[0] ?? null
    },
    enabled: !!id && !isNaN(Number(id)),
  })

  const name = isLoading ? '' : (data?.name ?? 'Dashboard')
  const spreadsheet = tryParseSpreadsheet(data?.spreadsheet_data)
  const sheets = spreadsheet?.sheets || []

  function handleExport() {
    if (!data?.spreadsheet_data) { toast.error('No data to export'); return }
    try {
      const blob = new Blob([data.spreadsheet_data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(data.name || 'dashboard').replace(/[^a-z0-9]/gi, '_')}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Export failed') }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Loading dashboard..." backTo="/admin/dashboards" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Not Found" backTo="/admin/dashboards" />
        <Card className="rounded-2xl">
          <CardContent className="p-10 text-center">
            <LayoutDashboard className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium">Dashboard not found</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader title={name} subtitle="dashboards" backTo="/admin/dashboards" />

      {/* Info bar */}
      <Card className="rounded-2xl">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Created:</span>
                <span>{fmt(data.create_date)}</span>
              </div>
              <span className="text-muted-foreground">·</span>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Modified:</span>
                <span>{fmt(data.write_date)}</span>
              </div>
              <span className="text-muted-foreground">·</span>
              <Badge variant="secondary" className="text-xs">{sheets.length} sheet{sheets.length !== 1 ? 's' : ''}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant={view === 'preview' ? 'default' : 'outline'} size="sm" className="rounded-lg" onClick={() => setView('preview')}>
                <Eye className="h-3.5 w-3.5 mr-1" /> Preview
              </Button>
              <Button variant={view === 'raw' ? 'default' : 'outline'} size="sm" className="rounded-lg" onClick={() => setView('raw')}>
                <Code2 className="h-3.5 w-3.5 mr-1" /> Raw JSON
              </Button>
              <Button variant="outline" size="sm" className="rounded-lg" onClick={handleExport}>
                <Download className="h-3.5 w-3.5 mr-1" /> Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {view === 'preview' ? (
        sheets.length === 0 ? (
          <Card className="rounded-2xl">
            <CardContent className="p-10 text-center">
              <LayoutDashboard className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium mb-1">Empty dashboard</p>
              <p className="text-xs text-muted-foreground">No sheets found in spreadsheet data</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sheets.map((sheet, idx) => (
              <Card key={sheet.id || idx} className="rounded-2xl overflow-hidden">
                <div className="px-4 sm:px-5 py-3 border-b border-border/40 bg-muted/20 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{sheet.name || `Sheet ${idx + 1}`}</h3>
                  <span className="text-xs text-muted-foreground">{sheet.rowNumber || 0} × {sheet.colNumber || 0}</span>
                </div>
                <CardContent className="p-4 sm:p-5">
                  <SheetPreview sheet={sheet} />
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : (
        <Card className="rounded-2xl">
          <CardContent className="p-0">
            <pre className="text-xs font-mono p-4 overflow-x-auto whitespace-pre-wrap break-all max-h-[600px]">
              {JSON.stringify(spreadsheet, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function colLabel(idx: number): string {
  let s = ''
  let n = idx
  do {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return s
}

function parseCellRef(ref: string): { col: number; row: number } | null {
  const m = ref.match(/^([A-Z]+)(\d+)$/)
  if (!m) return null
  let col = 0
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64)
  return { col: col - 1, row: parseInt(m[2], 10) - 1 }
}

function cellDisplay(cell: unknown): string {
  if (cell == null) return ''
  if (typeof cell === 'string' || typeof cell === 'number') return String(cell)
  if (cell && typeof cell === 'object') {
    const c = cell as { content?: unknown; value?: unknown; formula?: unknown }
    const v = c.content ?? c.value ?? c.formula
    if (typeof v === 'string' || typeof v === 'number') return String(v)
  }
  return ''
}

function SheetPreview({ sheet }: { sheet: Sheet }) {
  const cells = sheet.cells || {}
  const cellEntries = Object.entries(cells)

  if (cellEntries.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">No cells defined</p>
  }

  // Build a 2D grid from cell refs (A1, B2, etc.)
  let maxCol = 0
  let maxRow = 0
  const grid: Record<string, string> = {}
  for (const [ref, cell] of cellEntries) {
    const pos = parseCellRef(ref)
    if (!pos) continue
    grid[`${pos.col},${pos.row}`] = cellDisplay(cell)
    if (pos.col > maxCol) maxCol = pos.col
    if (pos.row > maxRow) maxRow = pos.row
  }
  // Cap to avoid huge tables
  const cols = Math.min(maxCol + 1, sheet.colNumber || maxCol + 1, 26)
  const rows = Math.min(maxRow + 1, sheet.rowNumber || maxRow + 1, 100)

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="border-collapse text-xs font-mono">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-10 h-7 bg-muted/40 border border-border/40"></th>
            {Array.from({ length: cols }).map((_, c) => (
              <th key={c} className="min-w-[100px] h-7 px-2 bg-muted/40 border border-border/40 text-center font-semibold text-muted-foreground">
                {colLabel(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              <th className="sticky left-0 z-10 w-10 h-7 bg-muted/30 border border-border/40 text-center font-semibold text-muted-foreground">
                {r + 1}
              </th>
              {Array.from({ length: cols }).map((_, c) => {
                const v = grid[`${c},${r}`] || ''
                const isNumeric = v && !isNaN(Number(v))
                return (
                  <td key={c} className={`px-2 h-7 border border-border/30 ${isNumeric ? 'text-right tabular-nums' : ''}`}>
                    {v}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {(maxRow + 1 > rows || maxCol + 1 > cols) && (
        <p className="text-xs text-muted-foreground mt-2">
          Showing {rows} × {cols} of {(sheet.rowNumber || maxRow + 1)} × {(sheet.colNumber || maxCol + 1)}
        </p>
      )}
    </div>
  )
}
