import { cn } from '@mashora/design-system'
import { List, LayoutGrid, Calendar as CalendarIcon, BarChart3 } from 'lucide-react'

export type ViewMode = 'list' | 'kanban' | 'calendar' | 'gantt'

const VIEW_ICONS: Record<ViewMode, any> = { list: List, kanban: LayoutGrid, calendar: CalendarIcon, gantt: BarChart3 }
const VIEW_LABELS: Record<ViewMode, string> = { list: 'List', kanban: 'Kanban', calendar: 'Calendar', gantt: 'Gantt' }

interface ViewToggleProps {
  value: ViewMode
  onChange: (v: ViewMode) => void
  available?: ViewMode[]
}

export default function ViewToggle({ value, onChange, available = ['list', 'kanban'] }: ViewToggleProps) {
  return (
    <div className="inline-flex rounded-xl border border-border/40 bg-muted/30 p-0.5">
      {available.map(mode => {
        const Icon = VIEW_ICONS[mode]
        return (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-colors',
              value === mode ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {VIEW_LABELS[mode]}
          </button>
        )
      })}
    </div>
  )
}
