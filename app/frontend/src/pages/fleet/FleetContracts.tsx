import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { DataTable, PageHeader } from '@/components/shared'
import type { Column } from '@/components/shared/DataTable'
import { Badge } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { FileText } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FleetContract {
  id: number
  name: string
  vehicle_id: [number, string] | false
  cost_subtype_id: [number, string] | false
  date_start: string
  date_end: string
  insurer_id: [number, string] | false
  state: string
  cost_amount: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(dt: string): string {
  if (!dt) return '—'
  try {
    const [y, m, d] = dt.split('-')
    return `${d}/${m}/${y}`
  } catch {
    return dt
  }
}

function fmtAmount(amount: number): string {
  if (amount == null) return '—'
  return `$${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const STATE_BADGE: Record<string, { variant: 'secondary' | 'success' | 'default' | 'destructive' | 'info'; label: string }> = {
  new:         { variant: 'secondary',   label: 'New' },
  open:        { variant: 'success',     label: 'Active' },
  expired:     { variant: 'destructive', label: 'Expired' },
  closed:      { variant: 'default',     label: 'Closed' },
  cancelled:   { variant: 'destructive', label: 'Cancelled' },
}

// ─── Columns ──────────────────────────────────────────────────────────────────

const columns: Column<FleetContract>[] = [
  {
    key: 'name',
    label: 'Contract',
    render: (v) => <span className="font-medium">{String(v)}</span>,
  },
  {
    key: 'vehicle_id',
    label: 'Vehicle',
    render: (v) => (Array.isArray(v) ? v[1] : '—'),
  },
  {
    key: 'cost_subtype_id',
    label: 'Type',
    render: (v) => (Array.isArray(v) ? v[1] : '—'),
  },
  {
    key: 'date_start',
    label: 'Start Date',
    render: (v) => fmtDate(String(v || '')),
  },
  {
    key: 'date_end',
    label: 'End Date',
    render: (v) => fmtDate(String(v || '')),
  },
  {
    key: 'insurer_id',
    label: 'Insurer',
    render: (v) => (Array.isArray(v) ? v[1] : '—'),
  },
  {
    key: 'cost_amount',
    label: 'Amount',
    render: (v) => fmtAmount(v as number),
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

export default function FleetContracts() {
  const navigate = useNavigate()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['fleet-contracts'],
    queryFn: () =>
      erpClient.raw
        .post('/model/fleet.vehicle.log.contract', {
          fields: ['id', 'name', 'vehicle_id', 'cost_subtype_id', 'date_start', 'date_end', 'insurer_id', 'state', 'cost_amount'],
          order: 'date_start desc',
          limit: 100,
        })
        .then(r => r.data),
    retry: false,
  })

  if (isError) {
    return (
      <div className="space-y-4">
        <PageHeader title="Fleet Contracts" />
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/30 bg-card/50 py-20 text-muted-foreground">
          <FileText className="h-10 w-10" />
          <p className="text-sm font-medium">Fleet contracts not available</p>
          <p className="text-xs">Enable the Fleet module to use this feature.</p>
        </div>
      </div>
    )
  }

  const records: FleetContract[] = data?.records ?? []
  const total: number = data?.total ?? records.length

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fleet Contracts"
        subtitle={isLoading ? undefined : `${total} contract${total !== 1 ? 's' : ''}`}
        onNew={() => navigate('/admin/model/fleet.vehicle.log.contract/new')}
        newLabel="New Contract"
      />

      <DataTable
        columns={columns}
        data={records}
        total={total}
        page={0}
        pageSize={100}
        onPageChange={() => {}}
        loading={isLoading}
        rowLink={row => `/admin/fleet/contracts/${row.id}`}
        emptyMessage="No contracts found"
        emptyIcon={<FileText className="h-10 w-10" />}
      />
    </div>
  )
}
