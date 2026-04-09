import { Button, Badge, cn } from '@mashora/design-system'
import { Plus } from 'lucide-react'
import KanbanCard from './KanbanCard'
import type { KanbanColumn as KanbanColumnType } from './KanbanController'

interface KanbanColumnProps {
  column: KanbanColumnType
  fields: Record<string, any>
  cardFields: string[]
  onCardClick: (recordId: number) => void
  onQuickCreate?: (groupValue: any) => void
  isOver?: boolean
}

export default function KanbanColumn({
  column,
  fields,
  cardFields,
  onCardClick,
  onQuickCreate,
  isOver,
}: KanbanColumnProps) {
  return (
    <div
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-3xl border border-border/60 bg-muted/20 transition-colors',
        isOver && 'border-primary/50 bg-primary/5',
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-semibold truncate">{column.groupLabel}</h3>
          <Badge variant="secondary" className="rounded-full text-xs shrink-0">
            {column.count}
          </Badge>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 space-y-2 overflow-y-auto p-3" style={{ maxHeight: '70vh' }}>
        {column.records.map(record => (
          <KanbanCard
            key={record.id}
            record={record}
            fields={fields}
            cardFields={cardFields}
            onClick={() => onCardClick(record.id)}
          />
        ))}

        {column.records.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
            No records
          </div>
        )}
      </div>

      {/* Quick create button */}
      {onQuickCreate && (
        <div className="border-t border-border/60 p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full rounded-xl gap-1.5 text-xs text-muted-foreground"
            onClick={() => onQuickCreate(column.groupValue)}
          >
            <Plus className="h-3 w-3" /> Add
          </Button>
        </div>
      )}
    </div>
  )
}
