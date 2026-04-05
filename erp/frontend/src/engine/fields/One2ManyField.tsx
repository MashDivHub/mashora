import type { FieldProps } from './FieldRegistry'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Button, cn } from '@mashora/design-system'
import { Plus, List } from 'lucide-react'

export default function One2ManyField({ name, value, fieldMeta, readonly, className }: FieldProps) {
  const records = Array.isArray(value) ? value : []

  if (records.length === 0) {
    return (
      <div className={cn('rounded-xl border border-dashed border-border/50 bg-muted/10', className)}>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <List className="h-8 w-8 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground/60">No records</p>
          {!readonly && (
            <Button variant="ghost" size="sm" className="mt-2 text-xs gap-1.5 text-primary">
              <Plus className="h-3.5 w-3.5" /> Add a line
            </Button>
          )}
        </div>
      </div>
    )
  }

  // If value is array of IDs (not loaded), show count
  if (typeof records[0] === 'number') {
    return (
      <div className="flex items-center gap-2 py-2">
        <span className="text-sm text-muted-foreground">{records.length} record(s)</span>
      </div>
    )
  }

  // If value is array of objects (loaded inline), show table
  const keys = Object.keys(records[0]).filter((k: string) => k !== 'id' && !k.startsWith('_'))

  return (
    <div className={cn('overflow-x-auto rounded-xl border border-border/50', className)}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border/40">
            {keys.slice(0, 6).map((k: string) => (
              <TableHead key={k} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 h-9">
                {k.replace(/_/g, ' ')}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((rec: any, i: number) => (
            <TableRow key={rec.id || i} className="border-border/30 hover:bg-muted/20">
              {keys.slice(0, 6).map((k: string) => (
                <TableCell key={k} className="text-sm py-2.5">
                  {Array.isArray(rec[k]) ? rec[k][1] || rec[k][0] : String(rec[k] ?? '')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
