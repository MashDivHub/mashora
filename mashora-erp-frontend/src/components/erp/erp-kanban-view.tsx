import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatFieldValue, recordTitle } from '@/lib/format'
import type { ParsedKanbanView } from '@/lib/erp-view'
import type { ErpFieldDefinition, ErpRecord } from '@/services/erp/views'
import { cn } from '@/lib/utils'

interface ErpKanbanViewProps {
  parsedView: ParsedKanbanView
  records: ErpRecord[]
  fields: Record<string, ErpFieldDefinition>
  selectedRecordId?: number
  onSelectRecord: (recordId: number) => void
}

export function ErpKanbanView({
  parsedView,
  records,
  fields,
  selectedRecordId,
  onSelectRecord,
}: ErpKanbanViewProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {records.map((record) => (
        <Card
          key={record.id}
          className={cn(
            'cursor-pointer transition hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_28px_80px_-40px_rgba(14,165,233,0.45)]',
            selectedRecordId === record.id ? 'border-primary/30 bg-primary/10' : ''
          )}
          onClick={() => onSelectRecord(record.id)}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold">
                  {parsedView.titleField ? formatFieldValue(record[parsedView.titleField], fields[parsedView.titleField]) : recordTitle(record)}
                </div>
                {parsedView.subtitleField ? (
                  <div className="mt-1 text-sm text-muted-foreground">
                    {formatFieldValue(record[parsedView.subtitleField], fields[parsedView.subtitleField])}
                  </div>
                ) : null}
              </div>
              {parsedView.badgeField ? (
                <Badge variant="outline">
                  {formatFieldValue(record[parsedView.badgeField], fields[parsedView.badgeField])}
                </Badge>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              {parsedView.fields.slice(0, 4).map((field) => (
                <div key={field.name} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{field.label}</span>
                  <span className="max-w-[60%] text-right">
                    {formatFieldValue(record[field.name], fields[field.name])}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
