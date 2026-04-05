import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  PageHeader, Button, DataTable, Input, Badge, Tabs, TabsList, TabsTrigger,
  cn, type Column,
} from '@mashora/design-system'
import { Plus, Search, Star } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

interface Lead {
  id: number
  name: string
  type: string
  stage_id: [number, string] | false
  partner_id: [number, string] | false
  contact_name: string | false
  email_from: string | false
  user_id: [number, string] | false
  expected_revenue: number
  probability: number
  priority: string
  won_status: string
  create_date: string
  activity_date_deadline: string | false
}

const wonStatusVariants: Record<string, string> = {
  pending: 'secondary',
  won: 'success',
  lost: 'destructive',
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

const columns: Column<Lead>[] = [
  {
    key: 'name',
    header: 'Name',
    cell: (row) => (
      <div className="flex items-center gap-1.5">
        {Number(row.priority) > 0 && (
          <Star className={cn('h-3 w-3 fill-current shrink-0', Number(row.priority) >= 2 ? 'text-amber-400' : 'text-muted-foreground')} />
        )}
        <span className="font-medium">{row.name}</span>
      </div>
    ),
  },
  {
    key: 'partner_id',
    header: 'Contact',
    cell: (row) => row.partner_id ? row.partner_id[1] : row.contact_name || '—',
  },
  {
    key: 'email_from',
    header: 'Email',
    cell: (row) => row.email_from || '—',
  },
  {
    key: 'stage_id',
    header: 'Stage',
    cell: (row) => row.stage_id ? (
      <Badge variant="outline" className="rounded-full text-[11px] font-medium">{row.stage_id[1]}</Badge>
    ) : '—',
  },
  {
    key: 'expected_revenue',
    header: 'Revenue',
    className: 'text-right',
    cell: (row) => row.expected_revenue > 0 ? (
      <span className="font-mono text-sm">{formatCurrency(row.expected_revenue)}</span>
    ) : '—',
  },
  {
    key: 'probability',
    header: 'Prob.',
    className: 'text-right',
    cell: (row) => <span className="font-mono text-sm">{row.probability}%</span>,
  },
  {
    key: 'user_id',
    header: 'Salesperson',
    cell: (row) => row.user_id ? row.user_id[1] : '—',
  },
  {
    key: 'won_status',
    header: 'Status',
    cell: (row) => (
      <Badge
        variant={(wonStatusVariants[row.won_status] as any) || 'secondary'}
        className="rounded-full text-[11px] font-semibold capitalize"
      >
        {row.won_status === 'pending' ? 'In Progress' : row.won_status}
      </Badge>
    ),
  },
]

type TabFilter = 'all' | 'leads' | 'opportunities' | 'won' | 'lost'

export default function LeadList() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabFilter>('all')
  const [search, setSearch] = useState('')

  const params: Record<string, any> = { search: search || undefined, limit: 50 }

  if (tab === 'leads') params.type = 'lead'
  else if (tab === 'opportunities') { params.type = 'opportunity'; params.won_status = 'pending' }
  else if (tab === 'won') { params.won_status = 'won'; params.active = true }
  else if (tab === 'lost') { params.active = false }

  const { data, isLoading } = useQuery({
    queryKey: ['crm-leads', tab, search],
    queryFn: () => erpClient.raw.post('/crm/leads', params).then((r) => r.data),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads & Opportunities"
        description={`${data?.total ?? '—'} records`}
        actions={
          <Button
            onClick={() => navigate('/crm/leads/new')}
            className="rounded-2xl"
          >
            <Plus className="h-4 w-4" />
            New
          </Button>
        }
      />

      {/* Search + tabs bar */}
      <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-2xl pl-9 border-border/60 bg-muted/30 focus:bg-background"
            />
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabFilter)}>
            <TabsList className="rounded-2xl">
              <TabsTrigger value="all" className="rounded-xl">All</TabsTrigger>
              <TabsTrigger value="leads" className="rounded-xl">Leads</TabsTrigger>
              <TabsTrigger value="opportunities" className="rounded-xl">Opportunities</TabsTrigger>
              <TabsTrigger value="won" className="rounded-xl">Won</TabsTrigger>
              <TabsTrigger value="lost" className="rounded-xl">Lost</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
        <DataTable
          columns={columns}
          data={data?.records ?? []}
          loading={isLoading}
          emptyMessage="No records found."
          onRowClick={(row) => navigate(`/crm/leads/${row.id}`)}
        />
      </div>
    </div>
  )
}
