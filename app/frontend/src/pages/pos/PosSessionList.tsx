import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { DataTable, PageHeader, SearchBar, toast } from '@/components/shared'
import type { Column } from '@/components/shared/DataTable'
import {
  Badge, Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Input, Label, type BadgeVariant,
} from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'
import { Monitor, Plus, Activity } from 'lucide-react'
import { fmtMoney, fmtRelativeTime } from './utils'

const STATE_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  opening_control: { label: 'Opening', variant: 'info' },
  opened:          { label: 'Open',    variant: 'success' },
  closing_control: { label: 'Closing', variant: 'warning' },
  closed:          { label: 'Closed',  variant: 'secondary' },
}

type StateFilter = 'all' | 'opened' | 'closed'

interface PosConfigSummary {
  id: number
  name: string
}

interface PosConfigsResponse {
  records?: PosConfigSummary[]
}

interface PosSessionRow {
  id: number
  name: string
  config_id: [number, string] | null
  user_id: [number, string] | null
  state: string
  start_at: string | null
  stop_at: string | null
  order_count: number
  total_amount: number
  cash_register_balance_start: number | null
}

interface PosSessionsResponse {
  records?: PosSessionRow[]
  total?: number
}

export default function PosSessionList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [stateFilter, setStateFilter] = useState<StateFilter>('all')
  const [configFilter, setConfigFilter] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 40

  const [openDialog, setOpenDialog] = useState(false)
  const [newConfigId, setNewConfigId] = useState<number | ''>('')
  const [openingCash, setOpeningCash] = useState<string>('0')
  const [openingNotes, setOpeningNotes] = useState<string>('')

  const { data: configsData } = useQuery<PosConfigsResponse>({
    queryKey: ['pos-configs'],
    queryFn: async () => {
      const { data } = await erpClient.raw.get('/pos/configs')
      return data
    },
  })
  const configs: PosConfigSummary[] = configsData?.records ?? []

  const { data, isLoading } = useQuery<PosSessionsResponse>({
    queryKey: ['pos-sessions', stateFilter, configFilter, page],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        limit: pageSize,
        offset: page * pageSize,
      }
      if (stateFilter !== 'all') params.state = stateFilter
      if (configFilter) params.config_id = configFilter
      const { data } = await erpClient.raw.get('/pos/sessions', { params })
      return data
    },
  })

  const records = useMemo(() => {
    const raw = data?.records ?? []
    if (!search.trim()) return raw
    const q = search.trim().toLowerCase()
    return raw.filter(r =>
      r.name?.toLowerCase().includes(q) ||
      (Array.isArray(r.config_id) && r.config_id[1]?.toLowerCase().includes(q))
    )
  }, [data, search])
  const total = data?.total ?? records.length

  const openMut = useMutation({
    mutationFn: async () => {
      if (!newConfigId) throw new Error('Pick a register first')
      const body = {
        config_id: newConfigId,
        opening_cash: Number(openingCash) || 0,
        opening_notes: openingNotes,
      }
      const { data } = await erpClient.raw.post('/pos/sessions', body)
      return data as { id: number; config_id: [number, string] }
    },
    onSuccess: session => {
      toast.success('Session Opened', `Opened ${session.config_id?.[1] ?? 'register'}`)
      queryClient.invalidateQueries({ queryKey: ['pos-sessions'] })
      setOpenDialog(false)
      setNewConfigId('')
      setOpeningCash('0')
      setOpeningNotes('')
      const cfgId = Array.isArray(session.config_id) ? session.config_id[0] : newConfigId
      if (cfgId) navigate(`/admin/pos/terminal/${cfgId}`)
    },
    onError: e => toast.error('Failed to Open Session', extractErrorMessage(e, 'Unknown error')),
  })

  const columns: Column[] = [
    {
      key: 'name',
      label: 'Session',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          {row.state === 'opened' && (
            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
          )}
          <span className="font-mono font-medium text-sm">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'config_id',
      label: 'Register',
      format: v => (Array.isArray(v) ? v[1] : ''),
    },
    {
      key: 'user_id',
      label: 'User',
      format: v => (Array.isArray(v) ? v[1] : ''),
    },
    {
      key: 'start_at',
      label: 'Started',
      render: (_, row) => {
        if (!row.start_at) return <span className="text-muted-foreground">—</span>
        return (
          <span title={new Date(row.start_at).toLocaleString()} className="text-sm text-muted-foreground">
            {fmtRelativeTime(row.start_at)}
          </span>
        )
      },
    },
    {
      key: 'state',
      label: 'State',
      render: v => {
        const s = STATE_BADGE[v] || { label: v, variant: 'secondary' as BadgeVariant }
        return <Badge variant={s.variant} className="rounded-full text-xs">{s.label}</Badge>
      },
    },
    { key: 'order_count', label: 'Orders', align: 'right' as const, className: 'tabular-nums' },
    {
      key: 'total_amount',
      label: 'Total',
      align: 'right' as const,
      className: 'tabular-nums font-medium',
      format: v => (typeof v === 'number' ? fmtMoney(v) : ''),
    },
  ]

  const showGuidedEmpty = !isLoading && total === 0 && stateFilter === 'all' && !configFilter && !search

  return (
    <div className="space-y-6">
      <PageHeader
        title="POS Sessions"
        subtitle={`${total} session${total !== 1 ? 's' : ''}`}
        actions={
          <Button onClick={() => setOpenDialog(true)} className="gap-2 rounded-xl">
            <Plus className="h-4 w-4" />
            Open Session
          </Button>
        }
      />

      {/* Filter card */}
      <div className="rounded-2xl border border-border/40 bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[240px]">
            <SearchBar
              placeholder="Search sessions..."
              onSearch={v => { setSearch(v); setPage(0) }}
              filters={[
                { key: 'opened', label: 'Open',   active: stateFilter === 'opened' },
                { key: 'closed', label: 'Closed', active: stateFilter === 'closed' },
              ]}
              activeFilters={stateFilter === 'all' ? [] : [stateFilter]}
              onFilterToggle={k => {
                setStateFilter(prev => (prev === k ? 'all' : (k as StateFilter)))
                setPage(0)
              }}
            />
          </div>
          <select
            value={configFilter ?? ''}
            onChange={e => { setConfigFilter(e.target.value ? Number(e.target.value) : null); setPage(0) }}
            className="h-9 rounded-xl border border-border/40 bg-background px-3 text-sm transition-colors hover:bg-muted/30"
          >
            <option value="">All Registers</option>
            {configs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {showGuidedEmpty ? (
        <div className="rounded-3xl border border-dashed border-border/40 bg-gradient-to-br from-primary/5 via-background to-emerald-500/5 p-12 text-center space-y-5">
          <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-primary">
            <Activity className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-bold tracking-tight">No POS sessions yet</p>
            <p className="text-sm text-muted-foreground">
              Open a register to start selling.
            </p>
          </div>
          <Button onClick={() => setOpenDialog(true)} className="gap-2 rounded-xl">
            <Plus className="h-4 w-4" />
            Open First Session
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={records}
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          loading={isLoading}
          rowLink={row => `/admin/pos/sessions/${row.id}`}
          emptyMessage="No sessions match the current filter"
          emptyIcon={<Monitor className="h-10 w-10" />}
        />
      )}

      <Dialog open={openDialog} onOpenChange={v => !openMut.isPending && setOpenDialog(v)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Open POS Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pos-register">Register</Label>
              <select
                id="pos-register"
                value={newConfigId}
                onChange={e => setNewConfigId(e.target.value ? Number(e.target.value) : '')}
                className="h-9 w-full rounded-xl border border-border/40 bg-background px-3 text-sm"
              >
                <option value="">Select a register...</option>
                {configs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pos-opening-cash">Opening Cash</Label>
              <Input
                id="pos-opening-cash"
                type="number"
                step="0.01"
                value={openingCash}
                onChange={e => setOpeningCash(e.target.value)}
                className="rounded-xl tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pos-opening-notes">Opening Notes</Label>
              <Input
                id="pos-opening-notes"
                value={openingNotes}
                onChange={e => setOpeningNotes(e.target.value)}
                placeholder="Optional notes"
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setOpenDialog(false)} disabled={openMut.isPending} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={() => openMut.mutate()} disabled={openMut.isPending || !newConfigId} className="rounded-xl">
              {openMut.isPending ? 'Opening...' : 'Open Session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
