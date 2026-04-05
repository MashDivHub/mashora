import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Button, DataTable, Input, Badge, Tabs, TabsList, TabsTrigger,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  cn, type Column,
} from '@mashora/design-system'
import { Plus, Search, PackageCheck, Truck, ArrowLeftRight, AlertCircle } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

interface Transfer {
  id: number
  name: string
  state: string
  picking_type_id: [number, string] | false
  picking_type_code: string
  partner_id: [number, string] | false
  location_id: [number, string] | false
  location_dest_id: [number, string] | false
  scheduled_date: string | false
  date_done: string | false
  origin: string | false
  priority: string
  backorder_id: [number, string] | false
}

const stateLabels: Record<string, string> = {
  draft: 'Draft',
  waiting: 'Waiting',
  confirmed: 'Waiting',
  assigned: 'Ready',
  done: 'Done',
  cancel: 'Cancelled',
}

const stateVariants: Record<string, 'secondary' | 'warning' | 'success' | 'default' | 'destructive'> = {
  draft: 'secondary',
  waiting: 'warning',
  confirmed: 'warning',
  assigned: 'success',
  done: 'default',
  cancel: 'destructive',
}

const typeConfig: Record<string, { label: string; icon: typeof Truck; className: string }> = {
  incoming: { label: 'Receipt',   icon: PackageCheck,   className: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-800/50' },
  outgoing: { label: 'Delivery',  icon: Truck,          className: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/40 dark:border-blue-800/50' },
  internal: { label: 'Internal',  icon: ArrowLeftRight, className: 'text-violet-600 bg-violet-50 border-violet-200 dark:text-violet-400 dark:bg-violet-950/40 dark:border-violet-800/50' },
}

const columns: Column<Transfer>[] = [
  {
    key: 'name',
    header: 'Reference',
    cell: (row) => (
      <div className="flex items-center gap-2">
        {row.priority === '1' && (
          <span title="Urgent">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-warning" />
          </span>
        )}
        <span className="font-mono font-semibold tracking-tight">{row.name}</span>
        {row.backorder_id && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Backorder</Badge>
        )}
      </div>
    ),
  },
  {
    key: 'picking_type_code',
    header: 'Type',
    cell: (row) => {
      const cfg = typeConfig[row.picking_type_code]
      if (!cfg) return <Badge variant="outline">{row.picking_type_code}</Badge>
      const Icon = cfg.icon
      return (
        <span className={cn('inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-xs font-medium', cfg.className)}>
          <Icon className="h-3 w-3" />
          {cfg.label}
        </span>
      )
    },
  },
  {
    key: 'partner_id',
    header: 'Contact',
    cell: (row) => (
      <span className="text-sm">{row.partner_id ? row.partner_id[1] : <span className="text-muted-foreground">—</span>}</span>
    ),
  },
  {
    key: 'location_id',
    header: 'From',
    cell: (row) => (
      <span className="text-xs text-muted-foreground">{row.location_id ? row.location_id[1] : '—'}</span>
    ),
  },
  {
    key: 'location_dest_id',
    header: 'To',
    cell: (row) => (
      <span className="text-xs text-muted-foreground">{row.location_dest_id ? row.location_dest_id[1] : '—'}</span>
    ),
  },
  {
    key: 'scheduled_date',
    header: 'Scheduled',
    cell: (row) => (
      <span className="font-mono text-xs tabular-nums">
        {row.scheduled_date ? row.scheduled_date.split(' ')[0] : <span className="text-muted-foreground">—</span>}
      </span>
    ),
  },
  {
    key: 'state',
    header: 'Status',
    cell: (row) => (
      <Badge variant={stateVariants[row.state] ?? 'secondary'}>
        {stateLabels[row.state] ?? row.state}
      </Badge>
    ),
  },
]

type TabFilter = 'all' | 'ready' | 'waiting' | 'done' | 'cancelled'

export default function TransferList() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabFilter>('all')
  const [search, setSearch] = useState('')
  const [typeCode, setTypeCode] = useState<string>('all')

  const params: Record<string, any> = { search: search || undefined, limit: 50 }
  if (typeCode !== 'all') params.picking_type_code = typeCode

  if (tab === 'ready') params.state = ['assigned']
  else if (tab === 'waiting') params.state = ['draft', 'waiting', 'confirmed']
  else if (tab === 'done') params.state = ['done']
  else if (tab === 'cancelled') params.state = ['cancel']

  const { data, isLoading } = useQuery({
    queryKey: ['transfers', tab, search, typeCode],
    queryFn: () => erpClient.raw.post('/inventory/transfers', params).then((r) => r.data),
  })

  const total = data?.total ?? '—'

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Inventory
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Transfers</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Loading transfers…' : `${total} transfer${total === 1 ? '' : 's'}`}
          </p>
        </div>
        <Button className="rounded-2xl" onClick={() => navigate('/inventory/transfers/new')}>
          <Plus className="h-4 w-4" />
          New Transfer
        </Button>
      </div>

      {/* Filters + table card */}
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)]">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 bg-muted/20 px-6 py-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabFilter)}>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="ready" className="text-xs">Ready</TabsTrigger>
              <TabsTrigger value="waiting" className="text-xs">Waiting</TabsTrigger>
              <TabsTrigger value="done" className="text-xs">Done</TabsTrigger>
              <TabsTrigger value="cancelled" className="text-xs">Cancelled</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-3">
            <Select value={typeCode} onValueChange={setTypeCode}>
              <SelectTrigger className="h-8 w-36 rounded-xl text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="incoming">Receipts</SelectItem>
                <SelectItem value="outgoing">Deliveries</SelectItem>
                <SelectItem value="internal">Internal</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search transfers…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-56 rounded-xl pl-8 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <DataTable
          columns={columns}
          data={data?.records ?? []}
          loading={isLoading}
          emptyMessage="No transfers found."
          onRowClick={(row) => navigate(`/inventory/transfers/${row.id}`)}
        />
      </div>
    </div>
  )
}
