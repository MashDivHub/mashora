import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { DataTable, PageHeader, SearchBar } from '@/components/shared'
import type { Column } from '@/components/shared/DataTable'
import type { FilterOption } from '@/components/shared/SearchBar'
import { Badge, Button, cn } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { CalendarCheck, AlertCircle, Clock, CheckCircle2, Plus } from 'lucide-react'

type ActivityState = 'overdue' | 'today' | 'planned'

interface Activity {
  id: number
  summary: string
  note: string
  date_deadline: string
  user_id: [number, string]
  activity_type_id: [number, string]
  res_id: number
  res_name: string
  state: ActivityState
}

const FILTERS: FilterOption[] = [
  { key: 'overdue', label: 'Overdue', domain: [['state', '=', 'overdue']] },
  { key: 'today', label: 'Today', domain: [['state', '=', 'today']] },
  { key: 'planned', label: 'Planned', domain: [['state', '=', 'planned']] },
]

const STATE_BADGE: Record<ActivityState, { variant: 'destructive' | 'warning' | 'info'; label: string }> = {
  overdue: { variant: 'destructive', label: 'Overdue' },
  today: { variant: 'warning', label: 'Today' },
  planned: { variant: 'info', label: 'Planned' },
}

const PAGE_SIZE = 40

export default function CrmActivities() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>('date_deadline')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const domain: unknown[] = []
  if (search) domain.push(['summary', 'ilike', search])
  for (const key of activeFilters) {
    const f = FILTERS.find(fl => fl.key === key)
    if (f?.domain) domain.push(...f.domain)
  }

  const order = sortField ? `${sortField} ${sortDir}` : 'date_deadline asc'

  const { data, isLoading } = useQuery({
    queryKey: ['crm-activities', search, page, activeFilters, order],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.post('/crm/activities', {
          search,
          offset: page * PAGE_SIZE,
          limit: PAGE_SIZE,
          order,
          ...(domain.length ? { domain } : {}),
        })
        return data as { records: Activity[]; total: number }
      } catch {
        // Fallback: fetch via generic model endpoint
        try {
          const d: unknown[] = [['res_model', '=', 'crm.lead']]
          if (search) d.push(['summary', 'ilike', search])
          domain.forEach(item => d.push(item))
          const { data } = await erpClient.raw.post('/model/mail.activity', {
            domain: d,
            fields: ['id', 'summary', 'note', 'date_deadline', 'user_id', 'activity_type_id', 'res_id', 'res_name', 'state'],
            offset: page * PAGE_SIZE,
            limit: PAGE_SIZE,
            order,
          })
          return { records: data.records ?? [], total: data.total ?? 0 }
        } catch {
          return { records: [], total: 0 }
        }
      }
    },
  })

  const columns: Column<Activity>[] = [
    {
      key: 'summary',
      label: 'Activity',
      render: (v: string) => (
        <span className="text-sm font-medium">{v || 'No summary'}</span>
      ),
    },
    {
      key: 'activity_type_id',
      label: 'Type',
      render: (v: [number, string]) => (
        Array.isArray(v)
          ? <Badge variant="secondary" className="rounded-full text-xs">{v[1]}</Badge>
          : ''
      ),
    },
    {
      key: 'res_name',
      label: 'Lead / Opportunity',
      render: (v: string, row: Activity) => (
        <button
          className="text-sm text-primary hover:underline text-left"
          onClick={e => { e.stopPropagation(); navigate(`/admin/crm/leads/${row.res_id}`) }}
        >
          {v || row.res_id}
        </button>
      ),
    },
    {
      key: 'user_id',
      label: 'Assigned To',
      format: (v: [number, string]) => Array.isArray(v) ? v[1] : '',
    },
    {
      key: 'date_deadline',
      label: 'Deadline',
      sortable: true,
      render: (v: string, row: Activity) => {
        const Icon = row.state === 'overdue' ? AlertCircle : row.state === 'today' ? Clock : row.state === 'planned' ? CheckCircle2 : null
        return (
          <span
            className={cn(
              'text-xs inline-flex items-center gap-1',
              row.state === 'overdue' && 'text-red-400',
              row.state === 'today' && 'text-amber-400',
              row.state === 'planned' && 'text-emerald-400',
            )}
            aria-label={row.state ? `${row.state} ${v || ''}` : undefined}
          >
            {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
            {v || '—'}
          </span>
        )
      },
    },
    {
      key: 'state',
      label: 'Status',
      align: 'center',
      render: (v: ActivityState) => {
        const cfg = STATE_BADGE[v]
        if (!cfg) return ''
        return <Badge variant={cfg.variant} className="rounded-full text-xs">{cfg.label}</Badge>
      },
    },
  ]

  const total = data?.total ?? 0
  const records = data?.records ?? []
  const hasFilters = search.length > 0 || activeFilters.length > 0
  const showEmptyCta = !isLoading && records.length === 0 && !hasFilters

  return (
    <div className="space-y-4">
      <PageHeader
        title="CRM Activities"
        subtitle={total > 0 ? `${total} activit${total === 1 ? 'y' : 'ies'}` : undefined}
        actions={
          <Button size="sm" className="rounded-xl gap-1.5" onClick={() => navigate('/admin/crm/leads')}>
            <Plus className="h-3.5 w-3.5" /> Schedule Activity
          </Button>
        }
      />
      <SearchBar
        placeholder="Search activities..."
        onSearch={v => { setSearch(v); setPage(0) }}
        filters={FILTERS}
        activeFilters={activeFilters}
        onFilterToggle={k => {
          setActiveFilters(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])
          setPage(0)
        }}
      />
      {showEmptyCta ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-12 text-center space-y-4">
          <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-primary">
            <CalendarCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">No activities scheduled</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Activities are scheduled from a lead or opportunity. Open a lead to schedule calls, meetings, or to-dos.
            </p>
          </div>
          <Button onClick={() => navigate('/admin/crm/leads')} className="gap-2">
            <Plus className="h-4 w-4" />
            Go to Leads
          </Button>
        </div>
      ) : (
        <DataTable<Activity>
          columns={columns}
          data={records}
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          sortField={sortField}
          sortDir={sortDir}
          onSort={(f, d) => { setSortField(f); setSortDir(d) }}
          loading={isLoading}
          onRowClick={row => navigate(`/admin/crm/leads/${row.res_id}`)}
          emptyMessage="No activities found"
          emptyIcon={<CalendarCheck className="h-10 w-10" />}
          rowKey={row => row.id}
          className={undefined}
        />
      )}
    </div>
  )
}
