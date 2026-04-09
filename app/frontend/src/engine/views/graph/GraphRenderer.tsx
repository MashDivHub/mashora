import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { GraphConfig } from './GraphController'

const CHART_COLORS = [
  'hsl(220, 70%, 55%)',  // blue
  'hsl(160, 60%, 50%)',  // teal
  'hsl(30, 80%, 55%)',   // amber
  'hsl(280, 65%, 60%)',  // purple
  'hsl(340, 75%, 55%)',  // rose
  'hsl(190, 70%, 50%)',  // cyan
  'hsl(100, 50%, 50%)',  // green
  'hsl(0, 70%, 55%)',    // red
]

interface GraphRendererProps {
  data: any[]
  config: GraphConfig
  height?: number
}

export default function GraphRenderer({ data, config, height = 400 }: GraphRendererProps) {
  const dimensionField = config.dimensions[0]?.field || 'name'

  if (config.type === 'pie') {
    const measureField = config.measures[0]?.field || '__count'
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey={measureField}
            nameKey={dimensionField}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={140}
            paddingAngle={2}
            label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} (${((percent ?? 0) * 100).toFixed(0)}%)`}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '12px',
              fontSize: '12px',
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  const ChartComponent = config.type === 'line' ? LineChart : BarChart

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ChartComponent data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
        <XAxis
          dataKey={dimensionField}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={{ stroke: 'hsl(var(--border))' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={{ stroke: 'hsl(var(--border))' }}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '12px',
            fontSize: '12px',
            color: 'hsl(var(--popover-foreground))',
          }}
        />
        <Legend />
        {config.measures.map((m, i) => (
          config.type === 'line' ? (
            <Line
              key={m.field}
              type="monotone"
              dataKey={m.field}
              name={m.label}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          ) : (
            <Bar
              key={m.field}
              dataKey={m.field}
              name={m.label}
              fill={CHART_COLORS[i % CHART_COLORS.length]}
              radius={[4, 4, 0, 0]}
              stackId={config.stacked ? 'stack' : undefined}
            />
          )
        ))}
      </ChartComponent>
    </ResponsiveContainer>
  )
}
