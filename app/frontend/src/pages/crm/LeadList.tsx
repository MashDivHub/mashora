import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, cn } from '@mashora/design-system'
import { Star, Target, Trophy, ThumbsDown, Archive, AlertCircle, Clock, CheckCircle2 } from 'lucide-react'
import {
  DataTable, PageHeader, SearchBar, BulkActionBar,
  toast,
  type Column, type FilterOption, type BulkAction,
} from '@/components/shared'
import { useBulkSelect } from '@/hooks/useBulkSelect'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

const LIST_FIELDS = [
  'id', 'name', 'partner_id', 'partner_name', 'contact_name', 'email_from', 'phone',
  'stage_id', 'user_id', 'expected_revenue', 'probability', 'priority',
  'date_deadline', 'activity_date_deadline', 'activity_state',
  'city', 'country_id', 'tag_ids', 'type', 'create_date',
]

const FILTERS: FilterOption[] = [
  { key: 'opportunities', label: 'Opportunities', domain: [['type', '=', 'opportunity']] },
  { key: 'leads', label: 'Leads', domain: [['type', '=', 'lead']] },
  { key: 'high', label: 'High Priority', domain: [['priority', 'in', ['2', '3']]] },
  { key: 'unassigned', label: 'Unassigned', domain: [['user_id', '=', false]] },
]

export default function LeadList() {
  useDocumentTitle('Leads')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>('create_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const pageSize = 40
  const { selected, clear, setSelected } = useBulkSelect()

  const domain: unknown[] = []
  if (search) domain.push('|', '|', ['name', 'ilike', search], ['partner_name', 'ilike', search], ['email_from', 'ilike', search])
  for (const key of activeFilters) {
    const f = FILTERS.find(fl => fl.key === key)
    if (f?.domain) domain.push(...f.domain)
  }

  const order = sortField ? `${sortField} ${sortDir}` : 'create_date desc'

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['crm-leads', domain, page, order],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/crm.lead', {
        domain: domain.length ? domain : undefined,
        fields: LIST_FIELDS, offset: page * pageSize, limit: pageSize, order,
      })
      return data
    },
  })

  async function bulkAction(ids: number[], action: (id: number) => Promise<unknown>, successMsg: string) {
    try {
      await Promise.all(ids.map(action))
      toast.success(`${successMsg} (${ids.length})`)
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] })
      clear()
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, 'Action failed'))
    }
  }

  const bulkActions: BulkAction[] = [
    {
      key: 'won',
      label: 'Mark as Won',
      icon: <Trophy className="h-3.5 w-3.5" />,
      confirm: 'Mark {count} lead(s) as Won?',
      onClick: ids => bulkAction(ids, id => erpClient.raw.post(`/crm/leads/${id}/won`), 'Leads won'),
    },
    {
      key: 'lost',
      label: 'Mark as Lost',
      icon: <ThumbsDown className="h-3.5 w-3.5" />,
      confirm: 'Mark {count} lead(s) as Lost?',
      onClick: ids => bulkAction(ids, id => erpClient.raw.post(`/crm/leads/${id}/lost`, { lost_reason_id: 1 }), 'Leads lost'),
    },
    {
      key: 'archive',
      label: 'Archive',
      icon: <Archive className="h-3.5 w-3.5" />,
      variant: 'destructive',
      confirm: 'Archive {count} lead(s)?',
      onClick: ids => bulkAction(ids, id => erpClient.raw.put(`/model/crm.lead/${id}`, { vals: { active: false } }), 'Leads archived'),
    },
  ]

  const columns: Column[] = [
    {
      key: 'name', label: 'Opportunity',
      render: (_, row) => (
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{row.name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {row.partner_name || (Array.isArray(row.partner_id) ? row.partner_id[1] : '') || row.contact_name || ''}
          </p>
        </div>
      ),
    },
    { key: 'email_from', label: 'Email', render: v => v ? <span className="text-sm truncate">{v}</span> : '' },
    { key: 'phone', label: 'Phone' },
    {
      key: 'stage_id', label: 'Stage',
      render: v => Array.isArray(v) ? <Badge variant="secondary" className="rounded-full text-xs">{v[1]}</Badge> : '',
    },
    {
      key: 'expected_revenue', label: 'Revenue', align: 'right',
      format: v => v ? `$${Number(v).toLocaleString()}` : '',
    },
    {
      key: 'probability', label: 'Prob.', align: 'right',
      render: v => v != null ? <span className="text-sm font-mono">{v}%</span> : '',
    },
    {
      key: 'priority', label: 'Priority', align: 'center',
      render: v => {
        const n = parseInt(v) || 0
        return (
          <div className="flex gap-0.5 justify-center">
            {[0,1,2].map(i => <Star key={i} className={cn('h-3 w-3', i < n ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/20')} />)}
          </div>
        )
      },
    },
    {
      key: 'user_id', label: 'Salesperson',
      format: v => Array.isArray(v) ? v[1] : '',
    },
    {
      key: 'activity_date_deadline', label: 'Next Activity',
      render: (v, row) => {
        if (!v) return ''
        const as = row.activity_state
        const Icon = as === 'overdue' ? AlertCircle : as === 'today' ? Clock : as === 'planned' ? CheckCircle2 : null
        return (
          <span
            className={cn('text-xs inline-flex items-center gap-1', as === 'overdue' && 'text-red-400', as === 'today' && 'text-amber-400', as === 'planned' && 'text-emerald-400')}
            aria-label={as ? `${as} ${v}` : undefined}
          >
            {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
            {v}
          </span>
        )
      },
    },
  ]

  const records = data?.records || []
  const selectedSet = new Set(selected)

  return (
    <div className="space-y-4">
      <PageHeader title="Leads & Opportunities" subtitle="CRM" onNew={() => navigate('/admin/crm/leads/new')} />
      <SearchBar placeholder="Search leads..." onSearch={v => { setSearch(v); setPage(0) }}
        filters={FILTERS} activeFilters={activeFilters}
        onFilterToggle={k => { setActiveFilters(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]); setPage(0) }} />
      <BulkActionBar selected={selected} onClear={clear} actions={bulkActions} />
      <DataTable columns={columns} data={records} total={data?.total} page={page} pageSize={pageSize}
        onPageChange={setPage} sortField={sortField} sortDir={sortDir}
        onSort={(f, d) => { setSortField(f); setSortDir(d) }} loading={isLoading}
        isError={isError} error={error} onRetry={() => refetch()}
        rowLink={row => `/admin/crm/leads/${row.id}`}
        selectable
        selectedIds={selectedSet}
        onSelectionChange={(ids) => setSelected(Array.from(ids) as number[])}
        emptyMessage="No leads found" emptyIcon={<Target className="h-10 w-10" />} />
    </div>
  )
}
