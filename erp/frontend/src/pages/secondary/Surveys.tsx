import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  PageHeader, Input, Badge,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Skeleton,
} from '@mashora/design-system'
import { Search, ClipboardList } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

interface Survey {
  id: number
  title: string
  survey_type: string
  user_id: [number, string] | false
  session_state: string | false
  active: boolean
}

const typeColors: Record<string, 'default' | 'info' | 'warning' | 'secondary'> = {
  survey: 'default',
  live_session: 'info',
  assessment: 'warning',
  custom: 'secondary',
}

const typeLabels: Record<string, string> = {
  survey: 'Survey',
  live_session: 'Live Session',
  assessment: 'Assessment',
  custom: 'Custom',
}

const sessionColors: Record<string, 'secondary' | 'success' | 'warning'> = {
  ready: 'secondary',
  in_progress: 'success',
  closed: 'warning',
}

const sessionLabels: Record<string, string> = {
  ready: 'Ready',
  in_progress: 'In Progress',
  closed: 'Closed',
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

export default function Surveys() {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['surveys', search],
    queryFn: () => erpClient.raw.post('/surveys/list', { search: search || undefined, limit: 50 }).then(r => r.data),
  })

  const records: Survey[] = data?.records ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="Surveys" description={`${data?.total ?? '—'} surveys`} />

      {/* Filter bar */}
      <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search surveys..."
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
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Survey</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Type</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Owner</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Session</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton cols={5} />
            ) : records.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
                      <ClipboardList className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">No surveys found.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              records.map(row => (
                <TableRow key={row.id} className="border-border/40 hover:bg-muted/50 transition-colors">
                  <TableCell>
                    <span className="font-medium text-sm">{row.title}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={typeColors[row.survey_type] ?? 'secondary'}>
                      {typeLabels[row.survey_type] ?? row.survey_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.user_id ? row.user_id[1] : '—'}
                  </TableCell>
                  <TableCell>
                    {row.session_state
                      ? <Badge variant={sessionColors[row.session_state] ?? 'secondary'}>
                          {sessionLabels[row.session_state] ?? row.session_state}
                        </Badge>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.active ? 'success' : 'secondary'}>
                      {row.active ? 'Active' : 'Archived'}
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
