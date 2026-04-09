import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@mashora/design-system'
import { Landmark } from 'lucide-react'
import { DataTable, PageHeader, type Column } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface BankStatement {
  id: number
  name: string
  date: string
  journal_id: [number, string]
  balance_start: number
  balance_end_real: number
  state: string
}

const STATE_BADGE: Record<string, { label: string; variant: 'secondary' | 'success' | 'destructive' | 'default' | 'warning' }> = {
  open:   { label: 'Open',     variant: 'default' },
  posted: { label: 'Posted',   variant: 'success' },
  confirm: { label: 'Confirmed', variant: 'success' },
  done:   { label: 'Done',     variant: 'secondary' },
}

const fmt = (v: number) =>
  `$${Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function BankStatements() {
  const [page, setPage]           = useState(0)
  const [sortField, setSortField] = useState<string | null>('date')
  const [sortDir, setSortDir]     = useState<'asc' | 'desc'>('desc')
  const pageSize = 40

  const order = sortField ? `${sortField} ${sortDir}` : 'date desc'

  const { data, isLoading } = useQuery({
    queryKey: ['bank-statements', page, order],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/accounting/bank-statements', {
        domain: [],
        offset: page * pageSize,
        limit: pageSize,
        order,
      })
      return data
    },
  })

  const columns: Column<BankStatement>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (v) => (
        <span className="font-mono text-sm font-medium">{v || '—'}</span>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      format: (v) => (v ? new Date(v).toLocaleDateString() : ''),
    },
    {
      key: 'journal_id',
      label: 'Journal',
      format: (v) => (Array.isArray(v) ? v[1] : ''),
    },
    {
      key: 'balance_start',
      label: 'Opening Balance',
      align: 'right',
      format: fmt,
    },
    {
      key: 'balance_end_real',
      label: 'Closing Balance',
      align: 'right',
      format: fmt,
    },
    {
      key: 'state',
      label: 'Status',
      render: (v) => {
        const s = STATE_BADGE[v] ?? { label: v, variant: 'secondary' as const }
        return (
          <Badge variant={s.variant} className="rounded-full text-xs capitalize">
            {s.label}
          </Badge>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bank Statements"
        subtitle="accounting"
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
        emptyMessage="No bank statements found"
        emptyIcon={<Landmark className="h-10 w-10" />}
      />
    </div>
  )
}
