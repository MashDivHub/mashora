import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge, cn } from '@mashora/design-system'
import { Mail } from 'lucide-react'
import { DataTable, PageHeader, SearchBar, type Column, type FilterOption } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface MailingRecord {
  id: number
  subject: string
  state: 'draft' | 'in_queue' | 'sending' | 'done' | 'cancel'
  email_from: string | false
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  mailing_model_id: [number, string] | false
  create_date: string
}

const STATE_BADGE: Record<string, { label: string; variant: string }> = {
  draft:    { label: 'Draft',    variant: 'secondary' },
  in_queue: { label: 'Queued',   variant: 'info' },
  sending:  { label: 'Sending',  variant: 'warning' },
  done:     { label: 'Sent',     variant: 'success' },
  cancel:   { label: 'Cancelled',variant: 'destructive' },
}

const FILTERS: FilterOption[] = [
  { key: 'draft',    label: 'Draft',   domain: [['state', '=', 'draft']] },
  { key: 'sending',  label: 'Sending', domain: [['state', 'in', ['in_queue', 'sending']]] },
  { key: 'done',     label: 'Done',    domain: [['state', '=', 'done']] },
]

export default function CampaignList() {
  const [search, setSearch]           = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [page, setPage]               = useState(0)
  const [sortField, setSortField]     = useState<string | null>('create_date')
  const [sortDir, setSortDir]         = useState<'asc' | 'desc'>('desc')
  const pageSize = 40

  // Build state array from active filters
  const stateValues: string[] = []
  if (activeFilters.includes('draft'))   stateValues.push('draft')
  if (activeFilters.includes('sending')) stateValues.push('in_queue', 'sending')
  if (activeFilters.includes('done'))    stateValues.push('done')

  const order = sortField ? `${sortField} ${sortDir}` : 'create_date desc'

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns', search, stateValues, page, order],
    queryFn: async () => {
      const body: Record<string, any> = {
        offset: page * pageSize,
        limit: pageSize,
        order,
      }
      if (search) body.search = search
      if (stateValues.length > 0) body.state = stateValues
      const { data: res } = await erpClient.raw.post('/mailing/campaigns', body)
      return res as { records: MailingRecord[]; total: number }
    },
  })

  const columns: Column<MailingRecord>[] = [
    {
      key: 'subject',
      label: 'Subject',
      render: (v) => <span className="font-bold text-sm">{v || '—'}</span>,
    },
    {
      key: 'email_from',
      label: 'From',
      render: (v) => (
        <span className="font-mono text-xs text-muted-foreground">{v || '—'}</span>
      ),
    },
    {
      key: 'sent',
      label: 'Sent',
      align: 'right',
      render: (v) => <span className="font-mono text-xs">{Number(v || 0).toLocaleString()}</span>,
    },
    {
      key: 'delivered',
      label: 'Delivered',
      align: 'right',
      render: (v) => <span className="font-mono text-xs">{Number(v || 0).toLocaleString()}</span>,
    },
    {
      key: 'opened',
      label: 'Opened',
      align: 'right',
      render: (v, row) => {
        const opened = Number(v || 0)
        const sent   = Number(row.sent || 0)
        const rate   = sent > 0 ? ((opened / sent) * 100).toFixed(1) : '0.0'
        return (
          <span className="font-mono text-xs">
            {opened.toLocaleString()}{' '}
            <span className="text-muted-foreground">({rate}%)</span>
          </span>
        )
      },
    },
    {
      key: 'clicked',
      label: 'Clicked',
      align: 'right',
      render: (v) => <span className="font-mono text-xs">{Number(v || 0).toLocaleString()}</span>,
    },
    {
      key: 'bounced',
      label: 'Bounced',
      align: 'right',
      render: (v) => {
        const n = Number(v || 0)
        return (
          <span className={cn('font-mono text-xs', n > 0 ? 'text-red-400' : '')}>
            {n.toLocaleString()}
          </span>
        )
      },
    },
    {
      key: 'state',
      label: 'Status',
      render: (v) => {
        const cfg = STATE_BADGE[v] ?? { label: v, variant: 'secondary' }
        return (
          <Badge variant={cfg.variant as any} className="rounded-full text-xs">
            {cfg.label}
          </Badge>
        )
      },
    },
  ]

  const total = data?.total ?? 0

  return (
    <div className="space-y-4">
      <PageHeader
        title="Email Campaigns"
        subtitle={total > 0 ? `${total} campaign${total !== 1 ? 's' : ''}` : undefined}
      />
      <SearchBar
        placeholder="Search campaigns..."
        onSearch={v => { setSearch(v); setPage(0) }}
        filters={FILTERS}
        activeFilters={activeFilters}
        onFilterToggle={k => {
          setActiveFilters(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k])
          setPage(0)
        }}
      />
      <DataTable
        columns={columns}
        data={data?.records ?? []}
        total={data?.total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        sortField={sortField}
        sortDir={sortDir}
        onSort={(f, d) => { setSortField(f); setSortDir(d) }}
        loading={isLoading}
        rowLink={row => `/admin/email-marketing/${row.id}`}
        emptyMessage="No campaigns found"
        emptyIcon={<Mail className="h-10 w-10" />}
      />
    </div>
  )
}
