import { getFieldComponent } from '../../fields/FieldRegistry'
import { cn } from '@mashora/design-system'

interface KanbanCardProps {
  record: Record<string, any>
  fields: Record<string, any>
  cardFields: string[]
  onClick: () => void
}

export default function KanbanCard({ record, fields, cardFields, onClick }: KanbanCardProps) {
  // Find the "title" field (first char/text field or name)
  const titleField = cardFields.find(f => f === 'name' || f === 'display_name') || cardFields[0]
  const otherFields = cardFields.filter(f => f !== titleField && f !== 'id' && fields[f])

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      className={cn(
        'w-full rounded-2xl border border-border/70 bg-card/90 p-4 text-left transition-all cursor-pointer',
        'hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring',
      )}
    >
      {/* Title */}
      <p className="text-sm font-semibold truncate mb-2">
        {record[titleField]
          ? Array.isArray(record[titleField])
            ? record[titleField][1]
            : String(record[titleField])
          : `#${record.id}`}
      </p>

      {/* Other fields */}
      <div className="space-y-1.5">
        {otherFields.slice(0, 4).map(fieldName => {
          const meta = fields[fieldName]
          if (!meta) return null
          const FieldComp = getFieldComponent(meta.type)
          return (
            <div key={fieldName} className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground truncate">{meta.string || fieldName}</span>
              <span className="text-xs shrink-0">
                <FieldComp
                  name={fieldName}
                  value={record[fieldName]}
                  fieldMeta={meta}
                  record={record}
                  readonly
                />
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
