import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatFieldValue, recordTitle } from '@/lib/format'
import type { ParsedViewField } from '@/lib/erp-view'
import type { ErpFieldDefinition, ErpRecord } from '@/services/erp/views'

interface ErpListViewProps {
  columns: ParsedViewField[]
  records: ErpRecord[]
  fields: Record<string, ErpFieldDefinition>
  selectedRecordId?: number
  onSelectRecord: (recordId: number) => void
}

export function ErpListView({
  columns,
  records,
  fields,
  selectedRecordId,
  onSelectRecord,
}: ErpListViewProps) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-border/60">
      <Table>
        <TableHeader className="bg-card/70">
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.name}>{column.label}</TableHead>
            ))}
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow
              key={record.id}
              data-state={selectedRecordId === record.id ? 'selected' : undefined}
              onClick={() => onSelectRecord(record.id)}
              className="cursor-pointer"
            >
              {columns.map((column) => (
                <TableCell key={column.name}>
                  <div className="max-w-[240px] truncate">
                    {column.name === 'display_name' || column.name === 'name'
                      ? recordTitle(record)
                      : formatFieldValue(record[column.name], fields[column.name])}
                  </div>
                </TableCell>
              ))}
              <TableCell>
                <Badge variant={selectedRecordId === record.id ? 'default' : 'outline'}>
                  {selectedRecordId === record.id ? 'Focused' : 'Ready'}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
