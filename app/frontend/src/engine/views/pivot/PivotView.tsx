import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Skeleton } from '@mashora/design-system'
import { ArrowLeftRight, Download } from 'lucide-react'
import type { ViewProps } from '../../ViewRegistry'
import { fetchViewDefinition } from '../../ActionService'
import { extractPivotConfig, loadPivotData, expandPivotRow, type PivotConfig, type PivotRow } from './PivotController'
import PivotRenderer from './PivotRenderer'

export default function PivotView({ model, action, domain: actionDomain }: ViewProps) {
  const [rows, setRows] = useState<PivotRow[]>([])
  const [config, setConfig] = useState<PivotConfig | null>(null)
  const [swapped, setSwapped] = useState(false)

  const { data: viewDef } = useQuery({
    queryKey: ['viewDef', model, 'pivot'],
    queryFn: () => fetchViewDefinition(model, 'pivot'),
    staleTime: 5 * 60 * 1000,
  })

  const { isLoading } = useQuery({
    queryKey: ['pivot', model, viewDef, actionDomain, swapped],
    queryFn: async () => {
      if (!viewDef) return []
      let cfg = extractPivotConfig(viewDef.arch, viewDef.fields)
      if (swapped) {
        cfg = { ...cfg, rowFields: cfg.colFields.length ? cfg.colFields : cfg.rowFields, colFields: cfg.rowFields }
      }
      setConfig(cfg)
      const data = await loadPivotData(model, cfg, actionDomain || [])
      setRows(data)
      return data
    },
    enabled: !!viewDef,
  })

  const handleExpand = useCallback(async (row: PivotRow) => {
    if (!config || config.rowFields.length <= row.depth + 1) return
    const nextField = config.rowFields[row.depth + 1]?.field
    if (!nextField) return

    const children = await expandPivotRow(model, config, row, nextField)

    setRows(prev => {
      const update = (rows: PivotRow[]): PivotRow[] =>
        rows.map(r => {
          if (r === row) return { ...r, isExpanded: true, children }
          if (r.children) return { ...r, children: update(r.children) }
          return r
        })
      return update(prev)
    })
  }, [model, config])

  const handleCollapse = useCallback((row: PivotRow) => {
    setRows(prev => {
      const update = (rows: PivotRow[]): PivotRow[] =>
        rows.map(r => {
          if (r === row) return { ...r, isExpanded: false, children: undefined }
          if (r.children) return { ...r, children: update(r.children) }
          return r
        })
      return update(prev)
    })
  }, [])

  const canExpand = useCallback((row: PivotRow): boolean => {
    return !!config && config.rowFields.length > row.depth + 1
  }, [config])

  const modelLabel = model.split('.').pop()?.replace(/_/g, ' ') || model

  if (!viewDef || isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 rounded-2xl" />
        <Skeleton className="h-[300px] w-full rounded-3xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">{model.replace(/\./g, ' ')}</p>
          <h1 className="text-xl font-semibold tracking-tight capitalize">{(typeof action?.name === 'string' ? action.name : '') || modelLabel}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => setSwapped(s => !s)}>
            <ArrowLeftRight className="h-3.5 w-3.5" /> Flip
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </div>
      </div>

      <div className="rounded-3xl border border-border/60 bg-card shadow-panel overflow-hidden">
        {rows.length > 0 ? (
          <PivotRenderer
            rows={rows}
            config={config!}
            onExpand={handleExpand}
            onCollapse={handleCollapse}
            canExpand={canExpand}
          />
        ) : (
          <div className="flex h-48 items-center justify-center text-muted-foreground">
            <p>No data available for pivot analysis</p>
          </div>
        )}
      </div>
    </div>
  )
}
