import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  PageHeader, Input, Badge, Tabs, TabsList, TabsTrigger,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Skeleton,
} from '@mashora/design-system'
import { Search, Mail } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

interface Mailing {
  id: number
  name: string
  subject: string
  state: string
  email_from: string | false
  user_id: [number, string] | false
}

const stateColors: Record<string, 'secondary' | 'info' | 'warning' | 'success'> = {
  draft: 'secondary',
  in_queue: 'info',
  sending: 'warning',
  done: 'success',
}

const stateLabels: Record<string, string> = {
  draft: 'Draft',
  in_queue: 'Queued',
  sending: 'Sending',
  done: 'Sent',
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

type TabFilter = 'all' | 'draft' | 'in_queue' | 'sending' | 'done'

export default function EmailMarketing() {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<TabFilter>('all')

  const params: Record<string, any> = { search: search || undefined, limit: 50 }
  if (tab !== 'all') params.state = [tab]

  const { data, isLoading } = useQuery({
    queryKey: ['mailings', tab, search],
    queryFn: () => erpClient.raw.post('/mailing/campaigns', params).then(r => r.data),
  })

  const records: Mailing[] = data?.records ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="Email Marketing" description={`${data?.total ?? '—'} campaigns`} />

      {/* Filter bar */}
      <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search campaigns..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="rounded-2xl pl-9 border-border/60 bg-muted/30 focus:bg-background"
            />
          </div>
          <Tabs value={tab} onValueChange={v => setTab(v as TabFilter)}>
            <TabsList className="rounded-2xl">
              <TabsTrigger value="all" className="rounded-xl">All</TabsTrigger>
              <TabsTrigger value="draft" className="rounded-xl">Draft</TabsTrigger>
              <TabsTrigger value="in_queue" className="rounded-xl">Queued</TabsTrigger>
              <TabsTrigger value="sending" className="rounded-xl">Sending</TabsTrigger>
              <TabsTrigger value="done" className="rounded-xl">Sent</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Table card */}
      <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/70 bg-muted/20 hover:bg-muted/20">
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Campaign</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Subject</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">From</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Responsible</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Status</TableHead>
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
                      <Mail className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">No campaigns found.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              records.map(row => (
                <TableRow key={row.id} className="border-border/40 hover:bg-muted/50 transition-colors">
                  <TableCell>
                    <span className="font-medium text-sm">{row.name}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[240px] truncate">
                    {row.subject || '—'}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.email_from || '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.user_id ? row.user_id[1] : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={stateColors[row.state] ?? 'secondary'}>
                      {stateLabels[row.state] ?? row.state}
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
