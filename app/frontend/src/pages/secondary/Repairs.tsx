import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Input, Badge, Button, Tabs, TabsList, TabsTrigger,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Skeleton,
} from '@mashora/design-system'
import { PageHeader } from '@/components/shared'
import { Search, Wrench, Plus } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

interface Repair {
  id: number
  name: string
  state: string
  product_id: [number, string] | false
  partner_id: [number, string] | false
  priority: string
}

const stateLabels: Record<string, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  under_repair: 'In Repair',
  done: 'Done',
  cancel: 'Cancelled',
}

const stateColors: Record<string, 'secondary' | 'info' | 'warning' | 'success' | 'destructive'> = {
  draft: 'secondary',
  confirmed: 'info',
  under_repair: 'warning',
  done: 'success',
  cancel: 'destructive',
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

type TabFilter = 'all' | 'draft' | 'confirmed' | 'under_repair' | 'done'

export default function Repairs() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<TabFilter>('all')

  const params: Record<string, any> = { search: search || undefined, limit: 50 }
  if (tab !== 'all') params.state = [tab]

  const { data, isLoading } = useQuery({
    queryKey: ['repairs', tab, search],
    queryFn: () => erpClient.raw.post('/repair/orders', params).then(r => r.data),
  })

  const records: Repair[] = data?.records ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Repairs"
        subtitle={`${data?.total ?? '—'} repair orders`}
        actions={
          <Button size="sm" className="rounded-xl gap-1.5" onClick={() => navigate('/admin/repairs/new')}>
            <Plus className="h-3.5 w-3.5" /> New
          </Button>
        }
      />

      {/* Filter bar */}
      <div className="rounded-3xl border border-border/60 bg-card shadow-panel p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search repair orders..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="rounded-2xl pl-9 border-border/60 bg-muted/30 focus:bg-background"
            />
          </div>
          <Tabs value={tab} onValueChange={v => setTab(v as TabFilter)}>
            <TabsList className="rounded-2xl">
              <TabsTrigger value="all" className="rounded-xl">All</TabsTrigger>
              <TabsTrigger value="draft" className="rounded-xl">Draft</TabsTrigger>
              <TabsTrigger value="confirmed" className="rounded-xl">Confirmed</TabsTrigger>
              <TabsTrigger value="under_repair" className="rounded-xl">In Repair</TabsTrigger>
              <TabsTrigger value="done" className="rounded-xl">Done</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Table card */}
      <div className="rounded-3xl border border-border/60 bg-card shadow-panel overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/70 bg-muted/20 hover:bg-muted/20">
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Reference</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Product</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Customer</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Priority</TableHead>
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
                      <Wrench className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">No repair orders found.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              records.map(row => (
                <TableRow
                  key={row.id}
                  className="border-border/40 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/admin/repairs/${row.id}`)}
                >
                  <TableCell>
                    <span className="font-mono font-medium text-sm">{row.name}</span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.product_id ? row.product_id[1] : '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.partner_id ? row.partner_id[1] : '—'}
                  </TableCell>
                  <TableCell>
                    {row.priority === '1'
                      ? <Badge variant="warning">Urgent</Badge>
                      : <span className="text-xs text-muted-foreground">Normal</span>}
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
