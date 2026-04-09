import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Input, Badge,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Skeleton,
} from '@mashora/design-system'
import { PageHeader } from '@/components/shared'
import { Search, Wrench } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

interface MaintenanceRequest {
  id: number
  name: string
  request_date: string | false
  close_date: string | false
  stage_id: [number, string] | false
  user_id: [number, string] | false
  equipment_id: [number, string] | false
  maintenance_type: string
  priority: string
  kanban_state: string
  duration: number | false
}

const FIELDS = [
  'id', 'name', 'request_date', 'close_date', 'stage_id', 'user_id',
  'equipment_id', 'maintenance_type', 'priority', 'kanban_state', 'duration',
]

const typeLabels: Record<string, string> = {
  corrective: 'Corrective',
  preventive: 'Preventive',
}

const kanbanColors: Record<string, 'secondary' | 'success' | 'warning' | 'destructive'> = {
  normal: 'secondary',
  done: 'success',
  blocked: 'destructive',
}

const kanbanLabels: Record<string, string> = {
  normal: 'In Progress',
  done: 'Ready',
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

export default function MaintenanceRequests() {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['maintenance-requests', search],
    queryFn: () =>
      erpClient.raw
        .post('/model/maintenance.request', {
          fields: FIELDS,
          domain: search
            ? [['name', 'ilike', search]]
            : [],
          limit: 80,
          order: 'request_date desc',
        })
        .then(r => r.data),
  })

  const records: MaintenanceRequest[] = data?.records ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance Requests"
        subtitle={`${data?.total ?? '—'} requests`}
      />

      <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search requests..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rounded-2xl pl-9 border-border/60 bg-muted/30 focus:bg-background"
          />
        </div>
      </div>

      <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/70 bg-muted/20 hover:bg-muted/20">
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Request</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Equipment</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Type</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Priority</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Assigned To</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Stage</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton cols={7} />
            ) : records.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
                      <Wrench className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">No maintenance requests found.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              records.map(row => (
                <TableRow key={row.id} className="border-border/40 hover:bg-muted/50 transition-colors">
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{row.name}</p>
                      {row.request_date && (
                        <p className="text-xs text-muted-foreground">{row.request_date}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.equipment_id ? row.equipment_id[1] : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {typeLabels[row.maintenance_type] ?? row.maintenance_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.priority === '1' || row.priority === '2' || row.priority === '3'
                      ? <Badge variant="warning">Urgent</Badge>
                      : <span className="text-xs text-muted-foreground">Normal</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.user_id ? row.user_id[1] : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.stage_id ? row.stage_id[1] : '—'}
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
