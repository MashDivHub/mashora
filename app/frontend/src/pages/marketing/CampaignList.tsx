import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button, cn, type BadgeVariant } from '@mashora/design-system'
import { Mail, AlertCircle, Plus, Users, ArrowRight } from 'lucide-react'
import { DataTable, PageHeader, SearchBar, type Column, type FilterOption } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

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

const STATE_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
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
  useDocumentTitle('Campaigns')
  const navigate = useNavigate()
  const [search, setSearch]           = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [page, setPage]               = useState(0)
  const [sortField, setSortField]     = useState<string | null>('create_date')
  const [sortDir, setSortDir]         = useState<'asc' | 'desc'>('desc')
  const pageSize = 40

  // Check if any mailing lists exist — campaigns need at least one
  const { data: listsData } = useQuery({
    queryKey: ['mailing-lists-count'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/mailing.list', {
        fields: ['id'],
        limit: 1,
      })
      return data as { records: Array<{ id: number }>; total: number }
    },
    staleTime: 60_000,
  })
  const hasMailingLists = (listsData?.total ?? 0) > 0

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
          <span
            className={cn('font-mono text-xs inline-flex items-center gap-1', n > 0 ? 'text-red-400' : '')}
            aria-label={n > 0 ? `${n} bounced` : undefined}
          >
            {n > 0 && <AlertCircle className="h-3 w-3" aria-hidden="true" />}
            {n.toLocaleString()}
          </span>
        )
      },
    },
    {
      key: 'state',
      label: 'Status',
      render: (v) => {
        const cfg = STATE_BADGE[v] ?? { label: v, variant: 'secondary' as BadgeVariant }
        return (
          <Badge variant={cfg.variant} className="rounded-full text-xs">
            {cfg.label}
          </Badge>
        )
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
        title="Email Campaigns"
        subtitle={total > 0 ? `${total} campaign${total !== 1 ? 's' : ''}` : undefined}
        onNew={() => navigate('/admin/model/mailing.mailing/new')}
        newLabel="New Campaign"
      />

      {!hasMailingLists && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
          <Users className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">Create a mailing list first</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Email campaigns need at least one mailing list of recipients before they can be sent.
            </p>
          </div>
          <Button size="sm" variant="outline" className="rounded-xl gap-1.5 shrink-0"
            onClick={() => navigate('/admin/marketing/mailing-lists')}>
            Go to Mailing Lists <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

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
      {showEmptyCta ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-12 text-center space-y-4">
          <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-primary">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">No email campaigns yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Design your first email campaign to reach customers on your mailing lists.
            </p>
          </div>
          <Button onClick={() => navigate('/admin/model/mailing.mailing/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            New Campaign
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
          rowLink={row => `/admin/email-marketing/${row.id}`}
          emptyMessage="No campaigns found"
          emptyIcon={<Mail className="h-10 w-10" />}
        />
      )}
    </div>
  )
}
