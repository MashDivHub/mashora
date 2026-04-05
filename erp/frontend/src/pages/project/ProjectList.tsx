import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Button, Badge, Input, Skeleton, cn,
  CardTitle, CardDescription,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@mashora/design-system'
import { Plus, Search, Star, SlidersHorizontal, FolderKanban } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Project {
  id: number
  name: string
  user_id: [number, string] | false
  partner_id: [number, string] | false
  task_count: number
  open_task_count: number
  closed_task_count: number
  task_completion_percentage: number
  last_update_status: string | false
  date_start: string | false
  date: string | false
  tag_ids: any[]
  is_favorite: boolean
}

// ─── Status config ────────────────────────────────────────────────────────────

const statusConfig: Record<string, { badge: 'success' | 'warning' | 'destructive' | 'info' | 'secondary'; label: string }> = {
  on_track: { badge: 'success', label: 'On Track' },
  at_risk: { badge: 'warning', label: 'At Risk' },
  off_track: { badge: 'destructive', label: 'Off Track' },
  on_hold: { badge: 'info', label: 'On Hold' },
  done: { badge: 'secondary', label: 'Done' },
  to_define: { badge: 'secondary', label: 'Not Set' },
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, Math.round(value)))
  const color =
    pct >= 80 ? 'bg-emerald-500' :
    pct >= 40 ? 'bg-amber-500' :
    'bg-zinc-400 dark:bg-zinc-600'

  return (
    <div className="flex items-center gap-2.5 min-w-[140px]">
      <div className="h-1.5 flex-1 rounded-full bg-border/60 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs font-mono text-muted-foreground tabular-nums">
        {pct}%
      </span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const params: Record<string, any> = { limit: 50, search: search || undefined }

  const { data, isLoading } = useQuery({
    queryKey: ['projects', search],
    queryFn: () => erpClient.raw.post('/projects/list', params).then((r) => r.data),
  })

  const records: Project[] = data?.records ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Projects
          </p>
          <h1 className="text-2xl font-bold tracking-tight">All Projects</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Loading...' : `${data?.total ?? 0} projects`}
          </p>
        </div>
        <Button className="rounded-2xl" onClick={() => navigate('/projects/new')}>
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
      </div>

      {/* Table card */}
      <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
        <div className="border-b border-border/70 bg-muted/20 px-6 py-4 flex items-center justify-between">
          <div>
            <CardTitle>Projects</CardTitle>
            <CardDescription className="mt-0.5">
              {isLoading ? 'Loading...' : `${records.length} result${records.length !== 1 ? 's' : ''}`}
            </CardDescription>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="rounded-2xl border border-border/70 bg-muted/60 p-4">
              <SlidersHorizontal className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No projects found</p>
            <p className="text-xs text-muted-foreground">
              Try adjusting your search or create a new project.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Project
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Manager
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Customer
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Progress
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Tasks
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((row) => {
                const status = row.last_update_status || 'to_define'
                const cfg = statusConfig[status] ?? statusConfig.to_define
                return (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer border-border/40 hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/projects/${row.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg border border-border/60 bg-muted/50 p-1.5 text-muted-foreground shrink-0">
                          <FolderKanban className="size-3.5" />
                        </div>
                        <div>
                          <span className="text-sm font-medium">{row.name}</span>
                          {row.is_favorite && (
                            <Star className="ml-1.5 inline h-3 w-3 fill-amber-400 text-amber-400" />
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.user_id ? row.user_id[1] : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.partner_id ? row.partner_id[1] : '—'}
                    </TableCell>
                    <TableCell>
                      <ProgressBar value={row.task_completion_percentage} />
                    </TableCell>
                    <TableCell>
                      <span className="text-sm tabular-nums">
                        <span className="font-medium">{row.closed_task_count}</span>
                        <span className="text-muted-foreground"> / {row.task_count}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={cfg.badge}>{cfg.label}</Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
