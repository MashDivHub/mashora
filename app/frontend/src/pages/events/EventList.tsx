import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button } from '@mashora/design-system'
import { CalendarDays, Plus } from 'lucide-react'
import { DataTable, PageHeader, SearchBar, type Column, type FilterOption } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface EventRecord {
  id: number
  name: string
  date_begin: string
  date_end: string
  state: 'draft' | 'confirm' | 'done' | 'cancel'
  seats_max: number
  seats_reserved: number
  seats_available: number
  registration_ids: number[]
  organizer_id: [number, string] | false
  company_id: [number, string]
}

const STATE_BADGE: Record<string, { variant: 'secondary' | 'success' | 'default' | 'destructive'; label: string }> = {
  draft:   { variant: 'secondary',    label: 'Draft' },
  confirm: { variant: 'success',      label: 'Confirmed' },
  done:    { variant: 'default',      label: 'Done' },
  cancel:  { variant: 'destructive',  label: 'Cancelled' },
}

const FILTERS: FilterOption[] = [
  { key: 'upcoming', label: 'Upcoming',  domain: [['state', '=', 'confirm']] },
  { key: 'draft',    label: 'Draft',     domain: [['state', '=', 'draft']] },
  { key: 'done',     label: 'Done',      domain: [['state', '=', 'done']] },
]

function fmtDate(dt: string): string {
  if (!dt) return '—'
  const d = dt.split(' ')[0]
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

export default function EventList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>('date_begin')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const pageSize = 40

  // Build state filter from active filter chips
  const stateFilters: string[] = []
  if (activeFilters.includes('upcoming')) stateFilters.push('confirm')
  if (activeFilters.includes('draft'))    stateFilters.push('draft')
  if (activeFilters.includes('done'))     stateFilters.push('done')

  const order = sortField ? `${sortField} ${sortDir}` : 'date_begin desc'

  const { data, isLoading } = useQuery({
    queryKey: ['events-list', search, stateFilters, page, order],
    queryFn: async () => {
      const body: Record<string, any> = {
        offset: page * pageSize,
        limit: pageSize,
        order,
      }
      if (search) body.search = search
      if (stateFilters.length > 0) body.state = stateFilters
      const { data: res } = await erpClient.raw.post('/events/list', body)
      return res
    },
  })

  const columns: Column<EventRecord>[] = [
    {
      key: 'name',
      label: 'Event',
      render: (v) => <span className="font-bold text-sm">{v}</span>,
    },
    {
      key: 'date_begin',
      label: 'Start Date',
      sortable: true,
      render: (v) => <span className="font-mono text-xs text-muted-foreground">{fmtDate(v)}</span>,
    },
    {
      key: 'date_end',
      label: 'End Date',
      sortable: true,
      render: (v) => <span className="font-mono text-xs text-muted-foreground">{fmtDate(v)}</span>,
    },
    {
      key: 'organizer_id',
      label: 'Organizer',
      render: (v) => (
        <span className="text-sm text-muted-foreground">
          {Array.isArray(v) ? v[1] : '—'}
        </span>
      ),
    },
    {
      key: 'seats_max',
      label: 'Seats',
      align: 'right',
      render: (_, row) =>
        row.seats_max === 0 ? (
          <span className="text-xs text-muted-foreground">Unlimited</span>
        ) : (
          <span className="font-mono text-xs">
            {row.seats_reserved}/{row.seats_max}
          </span>
        ),
    },
    {
      key: 'registration_ids',
      label: 'Registrations',
      align: 'right',
      render: (v) => (
        <span className="font-mono text-xs">{Array.isArray(v) ? v.length : 0}</span>
      ),
    },
    {
      key: 'state',
      label: 'Status',
      render: (v) => {
        const cfg = STATE_BADGE[v] ?? { variant: 'secondary' as const, label: v }
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>
      },
    },
  ]

  const records = data?.records ?? []
  const hasFilters = search.length > 0 || activeFilters.length > 0
  const showEmptyCta = !isLoading && records.length === 0 && !hasFilters

  return (
    <div className="space-y-4">
      <PageHeader
        title="Events"
        subtitle={data?.total != null ? `${data.total} event${data.total !== 1 ? 's' : ''}` : undefined}
        onNew={() => navigate('/admin/events/new')}
      />
      <SearchBar
        placeholder="Search events..."
        onSearch={v => { setSearch(v); setPage(0) }}
        filters={FILTERS}
        activeFilters={activeFilters}
        onFilterToggle={k => {
          setActiveFilters(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k])
          setPage(0)
        }}
      />
      {showEmptyCta ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-12 text-center space-y-4">
          <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-primary">
            <CalendarDays className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">No events yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Create your first event to start managing tickets, sessions, and registrations.
            </p>
          </div>
          <Button onClick={() => navigate('/admin/events/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Create First Event
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={records}
          total={data?.total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          sortField={sortField}
          sortDir={sortDir}
          onSort={(f, d) => { setSortField(f); setSortDir(d) }}
          loading={isLoading}
          rowLink={row => `/admin/events/${row.id}`}
          emptyMessage="No events found"
          emptyIcon={<CalendarDays className="h-10 w-10" />}
        />
      )}
    </div>
  )
}
