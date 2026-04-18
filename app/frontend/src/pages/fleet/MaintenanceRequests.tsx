import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Input, Badge,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Skeleton,
} from '@mashora/design-system'
import {
  PageHeader, KanbanBoard, ViewToggle, toast,
  type ViewMode, type KanbanColumn, type KanbanCardData,
} from '@/components/shared'
import { Search, Wrench } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'
import type { BadgeVariant } from '@mashora/design-system'

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
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  const isKanban = viewMode === 'kanban'

  const { data, isLoading } = useQuery({
    queryKey: ['maintenance-requests', search, isKanban],
    queryFn: () =>
      erpClient.raw
        .post('/model/maintenance.request', {
          fields: FIELDS,
          domain: search
            ? [['name', 'ilike', search]]
            : [],
          limit: isKanban ? 200 : 80,
          order: 'request_date desc',
        })
        .then(r => r.data),
  })

  const { data: stagesData } = useQuery({
    queryKey: ['maintenance-stages'],
    enabled: isKanban,
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/maintenance.stage', {
        fields: ['id', 'name', 'sequence', 'fold', 'done'],
        order: 'sequence asc, id asc',
        limit: 50,
      })
      return data
    },
  })

  const moveMut = useMutation({
    mutationFn: async ({ id, stageId }: { id: number; stageId: number }) => {
      await erpClient.raw.put(`/model/maintenance.request/${id}`, { vals: { stage_id: stageId } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-requests'] })
    },
    onError: (err: unknown) => {
      toast('error', 'Move failed', extractErrorMessage(err, 'Could not update request.'))
    },
  })

  const records: MaintenanceRequest[] = data?.records ?? []
  const stages = stagesData?.records || []

  interface StageRecord { id: number; name: string; sequence?: number; fold?: boolean; done?: boolean }
  const kanbanColumns: KanbanColumn[] = (stages as StageRecord[]).map((s) => ({
    id: s.id,
    title: s.name,
    fold: !!s.fold,
  }))
  const hasUnstaged = records.some(r => !Array.isArray(r.stage_id))
  if (hasUnstaged) kanbanColumns.unshift({ id: 'none', title: 'No Stage' })

  const kanbanCards: KanbanCardData[] = records.map((r): KanbanCardData => {
    const stageId: string | number = Array.isArray(r.stage_id) ? r.stage_id[0] : 'none'
    const equipmentName = Array.isArray(r.equipment_id) ? r.equipment_id[1] : ''
    const badges: { label: string; variant?: BadgeVariant }[] = []
    if (r.priority && ['1', '2', '3'].includes(r.priority)) {
      badges.push({ label: 'Urgent', variant: 'warning' })
    }
    if (r.maintenance_type) {
      badges.push({ label: typeLabels[r.maintenance_type] || r.maintenance_type, variant: 'outline' })
    }
    if (r.kanban_state && r.kanban_state !== 'normal') {
      badges.push({ label: kanbanLabels[r.kanban_state] || r.kanban_state, variant: kanbanColors[r.kanban_state] || 'secondary' })
    }
    return {
      id: r.id,
      columnId: stageId,
      title: r.name,
      subtitle: equipmentName || undefined,
      priority: parseInt(r.priority || '0') || 0,
      badges,
      onClick: () => navigate(`/admin/maintenance/${r.id}`),
    }
  })

  const handleKanbanMove = (cardId: number, _fromCol: string | number, toCol: string | number) => {
    if (toCol === 'none' || typeof toCol !== 'number') return
    moveMut.mutate({ id: cardId, stageId: toCol })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance Requests"
        subtitle={`${data?.total ?? '—'} requests`}
      />

      <div className="rounded-3xl border border-border/60 bg-card shadow-panel p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search requests..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rounded-2xl pl-9 border-border/60 bg-muted/30 focus:bg-background"
          />
        </div>
        <ViewToggle value={viewMode} onChange={setViewMode} />
      </div>

      {viewMode === 'kanban' ? (
        isLoading ? (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-72 shrink-0 space-y-3">
                <Skeleton className="h-8 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-2xl" />
                <Skeleton className="h-28 w-full rounded-2xl" />
              </div>
            ))}
          </div>
        ) : (
          <KanbanBoard columns={kanbanColumns} cards={kanbanCards} onCardMove={handleKanbanMove} />
        )
      ) : (
        <div className="rounded-3xl border border-border/60 bg-card shadow-panel overflow-hidden">
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
      )}
    </div>
  )
}
