import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatFieldValue, recordTitle } from '@/lib/format'
import type { ParsedKanbanView } from '@/lib/erp-view'
import { resolveErpAssetUrl } from '@/services/erp/client'
import type { ErpFieldDefinition, ErpRecord } from '@/services/erp/views'
import { cn } from '@/lib/utils'

interface ErpKanbanViewProps {
  parsedView: ParsedKanbanView
  records: ErpRecord[]
  fields: Record<string, ErpFieldDefinition>
  selectedRecordId?: number
  onSelectRecord: (recordId: number) => void
}

function resolveCardMedia(record: ErpRecord, parsedView: ParsedKanbanView) {
  if (!parsedView.mediaField) {
    return null
  }

  const value = record[parsedView.mediaField]
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  return resolveErpAssetUrl(value)
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
      {records.map((record) => {
        const mediaSrc = resolveCardMedia(record, parsedView)
        const details = parsedView.fields.filter(
          (field) =>
            ![
              parsedView.mediaField,
              parsedView.titleField,
              parsedView.subtitleField,
              parsedView.badgeField,
            ].includes(field.name)
        )

        return (
          <Card
            key={record.id}
            className={cn(
              'cursor-pointer transition hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_28px_80px_-40px_rgba(14,165,233,0.45)]',
              selectedRecordId === record.id ? 'border-primary/30 bg-primary/10' : ''
            )}
            onClick={() => onSelectRecord(record.id)}
          >
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                {mediaSrc ? (
                  <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-[20px] border border-border/60 bg-card/80 p-2 shadow-sm">
                    <img
                      src={mediaSrc}
                      alt={recordTitle(record)}
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  </div>
                ) : null}

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold">
                        {parsedView.titleField
                          ? formatFieldValue(record[parsedView.titleField], fields[parsedView.titleField])
                          : recordTitle(record)}
                      </div>
                      {parsedView.subtitleField ? (
                        <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
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
                    {details.slice(0, 4).map((field) => (
                      <div key={field.name} className="flex items-start justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">{field.label}</span>
                        <span className="max-w-[60%] text-right">
                          {formatFieldValue(record[field.name], fields[field.name])}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
