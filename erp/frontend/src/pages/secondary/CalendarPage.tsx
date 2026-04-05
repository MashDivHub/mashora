import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  PageHeader, Input, Badge,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Skeleton,
} from '@mashora/design-system'
import { Search, Calendar } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

interface CalEvent {
  id: number
  name: string
  start: string
  stop: string
  location: string | false
  user_id: [number, string] | false
  allday: boolean
  partner_ids: any[]
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

export default function CalendarPage() {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['calendar', search],
    queryFn: () => erpClient.raw.post('/calendar/events', { search: search || undefined, limit: 50 }).then(r => r.data),
  })

  const records: CalEvent[] = data?.records ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="Calendar" description={`${data?.total ?? '—'} events`} />

      {/* Filter bar */}
      <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search calendar events..."
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
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Subject</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Start</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">End</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Location</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Organizer</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Attendees</TableHead>
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
                      <Calendar className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">No calendar events found.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              records.map(row => (
                <TableRow key={row.id} className="border-border/40 hover:bg-muted/50 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{row.name}</span>
                      {row.allday && (
                        <Badge variant="outline" className="text-[10px]">All Day</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.allday ? row.start.split(' ')[0] : row.start}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.allday ? row.stop.split(' ')[0] : row.stop}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.location || '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.user_id ? row.user_id[1] : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {row.partner_ids?.length ?? 0}
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
