import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@mashora/design-system'
import { ChevronRight, ChevronDown } from 'lucide-react'
import type { PivotConfig, PivotRow } from './PivotController'

interface PivotRendererProps {
  rows: PivotRow[]
  config: PivotConfig
  onExpand: (row: PivotRow) => void
  onCollapse: (row: PivotRow) => void
  canExpand: (row: PivotRow) => boolean
}

function formatValue(value: number, type: string): string {
  if (type === 'integer') return new Intl.NumberFormat().format(Math.round(value))
  if (type === 'monetary' || type === 'float') return value.toFixed(2)
  return String(value)
}

export default function PivotRenderer({ rows, config, onExpand, onCollapse, canExpand }: PivotRendererProps) {
  // Calculate totals
  const totals: Record<string, number> = {}
  for (const m of config.measures) {
    totals[m.field] = rows.reduce((sum, r) => sum + (r.values[m.field] || 0), 0)
  }

  function renderRow(row: PivotRow, index: number): React.ReactNode[] {
    const nodes: React.ReactNode[] = []
    const expandable = canExpand(row)

    nodes.push(
      <TableRow key={`${row.label}-${index}-${row.depth}`} className="hover:bg-muted/50">
        <TableCell className="font-medium">
          <div className="flex items-center gap-1" style={{ paddingLeft: `${row.depth * 20}px` }}>
            {expandable ? (
              <button
                onClick={() => row.isExpanded ? onCollapse(row) : onExpand(row)}
                className="rounded p-0.5 hover:bg-accent transition-colors"
              >
                {row.isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <span className="w-5" />
            )}
            <span className="text-sm">{row.label}</span>
          </div>
        </TableCell>
        {config.measures.map(m => (
          <TableCell key={m.field} className="text-right font-mono text-sm tabular-nums">
            {formatValue(row.values[m.field] || 0, m.type)}
          </TableCell>
        ))}
      </TableRow>
    )

    if (row.isExpanded && row.children) {
      for (let i = 0; i < row.children.length; i++) {
        nodes.push(...renderRow(row.children[i], i))
      }
    }

    return nodes
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs font-semibold uppercase tracking-[0.15em]">
              {config.rowFields[0]?.label || 'Group'}
            </TableHead>
            {config.measures.map(m => (
              <TableHead key={m.field} className="text-right text-xs font-semibold uppercase tracking-[0.15em]">
                {m.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => renderRow(row, i))}

          {/* Totals row */}
          <TableRow className="bg-muted/30 font-semibold hover:bg-muted/40">
            <TableCell className="text-sm">Total</TableCell>
            {config.measures.map(m => (
              <TableCell key={m.field} className="text-right font-mono text-sm tabular-nums">
                {formatValue(totals[m.field] || 0, m.type)}
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
