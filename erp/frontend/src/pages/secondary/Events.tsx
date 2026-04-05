import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  PageHeader, Input, Badge,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Skeleton,
} from '@mashora/design-system'
import { Search, CalendarDays } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

interface Event {
  id: number
  name: string
  event_type_id: [number, string] | false
  date_begin: string
  date_end: string
  address_id: [number, string] | false
  seats_max: number
  seats_available: number
  kanban_state: string
}

const kanbanColors: Record<string, 'secondary' | 'success' | 'destructive' | 'warning'> = {
  normal: 'secondary',
  done: 'success',
  blocked: 'destructive',
}

const kanbanLabels: Record<string, string> = {
  normal: 'In Progress',
  done: 'Done',
  blocked: 'Blocked',
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i} className="hover:bg-transparent">
          {Array.from({ length: cols }).map((__, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full max-w-[140px]" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

export default function Events() {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['events', search],
    queryFn: () => erpClient.raw.post('/events/list', { search: search || undefined, limit: 50 }).then(r => r.data),
  })

  const records: Event[] = data?.records ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="Events" description={`${data?.total ?? '—'} events`} />

      {/* Filter bar */}
      <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search events..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rounded-2xl pl-9 border-border/60 bg-muted/30 focus:bg-background"
          />
        </div>
      </div>

      {/* Table card */}
      <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/70 bg-muted/20 hover:bg-muted/20">
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Event</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Type</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Start</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">End</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Seats</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton cols={6} />
            ) : records.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
                      <CalendarDays className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">No events found.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              records.map(row => (
                <TableRow key={row.id} className="border-border/40 hover:bg-muted/50 transition-colors">
                  <TableCell>
                    <span className="font-medium text-sm">{row.name}</span>
                  </TableCell>
                  <TableCell>
                    {row.event_type_id
                      ? <Badge variant="outline">{row.event_type_id[1]}</Badge>
                      : '—'}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.date_begin.split(' ')[0]}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.date_end.split(' ')[0]}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.seats_max > 0
                      ? <span className="font-mono text-xs">{row.seats_available} / {row.seats_max}</span>
                      : <span className="text-xs text-muted-foreground">Unlimited</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={kanbanColors[row.kanban_state] ?? 'secondary'}>
                      {kanbanLabels[row.kanban_state] ?? row.kanban_state}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
