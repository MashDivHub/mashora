import { useQuery } from '@tanstack/react-query'
import { DataTable, PageHeader } from '@/components/shared'
import type { Column } from '@/components/shared/DataTable'
import { Badge } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { Layers } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BatchTransfer {
  id: number
  name: string
  state: string
  user_id: [number, string] | false
  picking_ids: number[]
  scheduled_date: string
  company_id: [number, string] | false
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(dt: string): string {
  if (!dt) return '—'
  try {
    const [date] = dt.split(' ')
    const [y, m, d] = date.split('-')
    return `${d}/${m}/${y}`
  } catch {
    return dt
  }
}

const STATE_BADGE: Record<string, { variant: 'secondary' | 'info' | 'success' | 'destructive'; label: string }> = {
  draft:       { variant: 'secondary',   label: 'Draft' },
  in_progress: { variant: 'info',        label: 'In Progress' },
  done:        { variant: 'success',     label: 'Done' },
  cancel:      { variant: 'destructive', label: 'Cancelled' },
}

// ─── Columns ──────────────────────────────────────────────────────────────────

const columns: Column<BatchTransfer>[] = [
  {
    key: 'name',
    label: 'Batch',
    render: (v) => <span className="font-mono text-xs">{String(v)}</span>,
  },
  {
    key: 'user_id',
    label: 'Responsible',
    render: (v) => (Array.isArray(v) ? v[1] : '—'),
  },
  {
    key: 'picking_ids',
    label: 'Transfers',
    render: (v) => (Array.isArray(v) ? String(v.length) : '0'),
  },
  {
    key: 'scheduled_date',
    label: 'Scheduled Date',
    render: (v) => fmtDate(String(v || '')),
  },
  {
    key: 'state',
    label: 'Status',
    render: (v) => {
      const cfg = STATE_BADGE[String(v)] ?? { variant: 'secondary' as const, label: String(v) }
      return <Badge variant={cfg.variant}>{cfg.label}</Badge>
    },
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BatchPicking() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['batch-picking'],
    queryFn: () =>
      erpClient.raw
        .post('/model/stock.picking.batch', {
          fields: ['id', 'name', 'state', 'user_id', 'picking_ids', 'scheduled_date', 'company_id'],
          order: 'scheduled_date desc',
          limit: 50,
        })
        .then(r => r.data),
    retry: false,
  })

  if (isError) {
    return (
      <div className="space-y-4">
        <PageHeader title="Batch Transfers" />
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/30 bg-card/50 py-20 text-muted-foreground">
          <Layers className="h-10 w-10" />
          <p className="text-sm font-medium">Batch picking module not installed</p>
          <p className="text-xs">Enable the Batch Transfers module to use this feature.</p>
        </div>
      </div>
    )
  }

  const records: BatchTransfer[] = data?.records ?? []
  const total: number = data?.total ?? records.length

  return (
    <div className="space-y-4">
      <PageHeader
        title="Batch Transfers"
        subtitle={isLoading ? undefined : `${total} batch${total !== 1 ? 'es' : ''}`}
      />

      <DataTable
        columns={columns}
        data={records}
        total={total}
        page={0}
        pageSize={50}
        onPageChange={() => {}}
        loading={isLoading}
        emptyMessage="No batch transfers found"
        emptyIcon={<Layers className="h-10 w-10" />}
      />
    </div>
  )
}
