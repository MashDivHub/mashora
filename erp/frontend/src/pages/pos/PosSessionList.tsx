import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { DataTable, PageHeader, SearchBar } from '@/components/shared'
import type { Column } from '@/components/shared/DataTable'
import { Badge } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { Monitor } from 'lucide-react'

const STATE_BADGE: Record<string, { label: string; variant: string }> = {
  opening_control: { label: 'Opening', variant: 'info' },
  opened:          { label: 'Open',    variant: 'success' },
  closing_control: { label: 'Closing', variant: 'warning' },
  closed:          { label: 'Closed',  variant: 'secondary' },
}

type Tab = 'all' | 'opened' | 'closing_control' | 'closed'

export default function PosSessionList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<Tab>('all')
  const [page, setPage] = useState(0)
  const pageSize = 40

  const { data, isLoading } = useQuery({
    queryKey: ['pos-sessions', tab, search, page],
    queryFn: async () => {
      const body: Record<string, unknown> = {
        search,
        offset: page * pageSize,
        limit: pageSize,
      }
      if (tab !== 'all') body.state = [tab]
      const { data } = await erpClient.raw.post('/pos/sessions', body)
      return data
    },
  })

  const total: number = data?.total ?? 0

  const columns: Column[] = [
    {
      key: 'name',
      label: 'Session',
      render: (_, row) => (
        <span className="font-mono font-medium text-sm">{row.name}</span>
      ),
    },
    {
      key: 'config_id',
      label: 'Terminal',
      format: v => Array.isArray(v) ? v[1] : '',
    },
    {
      key: 'user_id',
      label: 'Opened By',
      format: v => Array.isArray(v) ? v[1] : '',
    },
    {
      key: 'start_at',
      label: 'Opened',
      format: v => v ? new Date(v).toLocaleString() : '',
    },
    {
      key: 'stop_at',
      label: 'Closed',
      format: v => v ? new Date(v).toLocaleString() : '\u2014',
    },
    {
      key: 'order_count',
      label: 'Orders',
      align: 'right' as const,
    },
    {
      key: 'total_payments_amount',
      label: 'Total Payments',
      align: 'right' as const,
      format: v =>
        typeof v === 'number'
          ? `$${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
          : '',
    },
    {
      key: 'state',
      label: 'Status',
      render: v => {
        const s = STATE_BADGE[v] || { label: v, variant: 'secondary' }
        return (
          <Badge variant={s.variant as any} className="rounded-full text-xs">
            {s.label}
          </Badge>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="POS Sessions"
        subtitle={`${total} session${total !== 1 ? 's' : ''}`}
      />
      <SearchBar
        placeholder="Search sessions..."
        onSearch={v => { setSearch(v); setPage(0) }}
        filters={[
          { key: 'opened',          label: 'Open',    active: tab === 'opened' },
          { key: 'closing_control', label: 'Closing', active: tab === 'closing_control' },
          { key: 'closed',          label: 'Closed',  active: tab === 'closed' },
        ]}
        activeFilters={tab === 'all' ? [] : [tab]}
        onFilterToggle={k => {
          setTab(prev => prev === k ? 'all' : k as Tab)
          setPage(0)
        }}
      />
      <DataTable
        columns={columns}
        data={data?.records || []}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        loading={isLoading}
        rowLink={row => `/pos/sessions/${row.id}`}
        emptyMessage="No sessions found"
        emptyIcon={<Monitor className="h-10 w-10" />}
      />
    </div>
  )
}
