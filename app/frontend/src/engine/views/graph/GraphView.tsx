import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Skeleton } from '@mashora/design-system'
import { BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon } from 'lucide-react'
import type { ViewProps } from '../../ViewRegistry'
import { fetchViewDefinition } from '../../ActionService'
import { extractGraphConfig, loadGraphData, type GraphConfig } from './GraphController'
import GraphRenderer from './GraphRenderer'

export default function GraphView({ model, action, domain: actionDomain }: ViewProps) {
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | null>(null)

  const { data: viewDef } = useQuery({
    queryKey: ['viewDef', model, 'graph'],
    queryFn: () => fetchViewDefinition(model, 'graph'),
    staleTime: 5 * 60 * 1000,
  })

  const baseConfig = viewDef ? extractGraphConfig(viewDef.arch, viewDef.fields) : null
  const config: GraphConfig | null = baseConfig ? { ...baseConfig, type: chartType || baseConfig.type } : null

  const { data: graphData, isLoading } = useQuery({
    queryKey: ['graph', model, config?.dimensions, config?.measures, actionDomain],
    queryFn: () => config ? loadGraphData(model, config, actionDomain || []) : Promise.resolve([]),
    enabled: !!config,
  })

  const modelLabel = model.split('.').pop()?.replace(/_/g, ' ') || model

  if (!viewDef || isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 rounded-2xl" />
        <Skeleton className="h-[400px] w-full rounded-3xl" />
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

        {/* Chart type switcher */}
        <div className="flex items-center gap-1 rounded-xl border border-border/70 p-1">
          <Button
            variant={(!chartType && baseConfig?.type === 'bar') || chartType === 'bar' ? 'default' : 'ghost'}
            size="icon-sm"
            onClick={() => setChartType('bar')}
            className="rounded-lg"
          >
            <BarChart3 className="h-4 w-4" />
          </Button>
          <Button
            variant={chartType === 'line' ? 'default' : 'ghost'}
            size="icon-sm"
            onClick={() => setChartType('line')}
            className="rounded-lg"
          >
            <LineChartIcon className="h-4 w-4" />
          </Button>
          <Button
            variant={chartType === 'pie' ? 'default' : 'ghost'}
            size="icon-sm"
            onClick={() => setChartType('pie')}
            className="rounded-lg"
          >
            <PieChartIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-panel">
        {graphData && graphData.length > 0 ? (
          <GraphRenderer data={graphData} config={config!} />
        ) : (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            <p>No data available for this chart</p>
          </div>
        )}
      </div>
    </div>
  )
}
