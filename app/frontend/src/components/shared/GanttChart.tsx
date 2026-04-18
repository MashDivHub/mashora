import { useMemo } from 'react'
import { cn } from '@mashora/design-system'

export interface GanttItem {
  id: number
  title: string
  start: Date
  end: Date
  progress?: number     // 0-100
  color?: string
  group?: string        // for grouping rows
  onClick?: () => void
}

interface GanttChartProps {
  items: GanttItem[]
  startDate?: Date      // defaults to min item start
  endDate?: Date        // defaults to max item end
  rowHeight?: number    // default 36
  dayWidth?: number     // default 40
  groupBy?: 'group'     // group by item.group
}

export default function GanttChart({ items, startDate, endDate, rowHeight = 36, dayWidth = 40, groupBy }: GanttChartProps) {
  const [start, end] = useMemo(() => {
    if (items.length === 0) {
      const now = new Date()
      return [now, new Date(now.getTime() + 14 * 86400_000)]
    }
    const s = startDate || new Date(Math.min(...items.map(i => i.start.getTime())))
    const e = endDate || new Date(Math.max(...items.map(i => i.end.getTime())))
    return [s, e]
  }, [items, startDate, endDate])

  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400_000))
  const totalWidth = days * dayWidth

  const dayCols = useMemo(() => {
    const arr: { date: Date; isWeekend: boolean; isMonthStart: boolean }[] = []
    for (let i = 0; i <= days; i++) {
      const d = new Date(start.getTime() + i * 86400_000)
      arr.push({ date: d, isWeekend: d.getDay() === 0 || d.getDay() === 6, isMonthStart: d.getDate() === 1 })
    }
    return arr
  }, [start, days])

  // Group rows
  const rows = useMemo(() => {
    if (!groupBy) return [{ key: '', items }]
    const map: Record<string, GanttItem[]> = {}
    items.forEach(it => {
      const k = it.group || 'Other'
      if (!map[k]) map[k] = []
      map[k].push(it)
    })
    return Object.entries(map).map(([key, items]) => ({ key, items }))
  }, [items, groupBy])

  function itemX(d: Date) {
    return Math.max(0, (d.getTime() - start.getTime()) / 86400_000) * dayWidth
  }
  function itemW(s: Date, e: Date) {
    return Math.max(dayWidth, ((e.getTime() - s.getTime()) / 86400_000) * dayWidth)
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card p-12 text-center text-sm text-muted-foreground">
        No items to display in Gantt view.
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
      <div className="flex">
        {/* Labels column */}
        <div className="shrink-0 w-48 border-r border-border/40">
          <div className="h-10 border-b border-border/40 bg-muted/30 px-3 flex items-center text-xs font-semibold uppercase tracking-wider">
            Item
          </div>
          {rows.map(row => (
            <div key={row.key}>
              {row.key && (
                <div className="h-7 px-3 flex items-center text-[11px] font-semibold uppercase tracking-wider bg-muted/20 border-b border-border/30">
                  {row.key}
                </div>
              )}
              {row.items.map(it => (
                <div key={it.id} style={{ height: rowHeight }} className="px-3 flex items-center text-sm border-b border-border/20 truncate">
                  {it.title}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="overflow-x-auto flex-1">
          <div style={{ width: totalWidth }}>
            {/* Header — day grid */}
            <div className="h-10 border-b border-border/40 bg-muted/30 flex sticky top-0 z-10">
              {dayCols.map((c, i) => (
                <div key={i} style={{ width: dayWidth }} className={cn('flex flex-col items-center justify-center border-r border-border/30 text-[10px]', c.isWeekend && 'bg-muted/40')}>
                  <span className="text-muted-foreground">{c.date.toLocaleString('en', { weekday: 'short' })[0]}</span>
                  <span className={cn('font-mono', c.isMonthStart && 'font-bold text-primary')}>{c.date.getDate()}</span>
                </div>
              ))}
            </div>

            {/* Bars */}
            {rows.map(row => (
              <div key={row.key}>
                {row.key && <div style={{ height: 28 }} className="bg-muted/10 border-b border-border/30" />}
                {row.items.map(it => {
                  const x = itemX(it.start)
                  const w = itemW(it.start, it.end)
                  const progress = it.progress || 0
                  return (
                    <div key={it.id} style={{ height: rowHeight }} className="relative border-b border-border/20 hover:bg-muted/20">
                      {/* Day grid lines */}
                      <div className="absolute inset-0 flex">
                        {dayCols.slice(0, -1).map((c, i) => (
                          <div key={i} style={{ width: dayWidth }} className={cn('border-r border-border/15', c.isWeekend && 'bg-muted/30')} />
                        ))}
                      </div>
                      {/* Bar */}
                      <button
                        onClick={it.onClick}
                        className="absolute top-1.5 rounded-md cursor-pointer hover:opacity-90 transition-opacity overflow-hidden"
                        style={{ left: x, width: w, height: rowHeight - 12, backgroundColor: it.color || 'hsl(220, 70%, 55%)' }}
                        title={`${it.title} | ${it.start.toLocaleDateString()} -> ${it.end.toLocaleDateString()}`}
                      >
                        {progress > 0 && (
                          <div className="absolute inset-y-0 left-0 bg-black/20" style={{ width: `${progress}%` }} />
                        )}
                        <span className="relative z-10 px-2 text-[11px] text-white font-medium leading-none whitespace-nowrap truncate block leading-[1.5rem]">
                          {it.title}
                        </span>
                      </button>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
