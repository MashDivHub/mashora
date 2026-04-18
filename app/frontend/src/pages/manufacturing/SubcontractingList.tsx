import { useQuery } from '@tanstack/react-query'
import { Badge, type BadgeVariant } from '@mashora/design-system'
import { Truck } from 'lucide-react'
import { DataTable, PageHeader, type Column } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface StockPicking {
  id: number
  name: string
  partner_id: [number, string] | false
  state: string
  scheduled_date: string | false
  date_done: string | false
  origin: string | false
}

interface PickingResponse {
  records: StockPicking[]
  total: number
}

const STATE_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  draft:       { label: 'Draft',       variant: 'secondary' },
  waiting:     { label: 'Waiting',     variant: 'secondary' },
  confirmed:   { label: 'Confirmed',   variant: 'info' },
  assigned:    { label: 'Ready',       variant: 'warning' },
  done:        { label: 'Done',        variant: 'success' },
  cancel:      { label: 'Cancelled',   variant: 'destructive' },
}

function fmtDate(v: string | false | null) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString()
}

function fmt(v: unknown): string {
  if (Array.isArray(v)) return String(v[1] ?? '')
  return v == null || v === false ? '' : String(v)
}

export default function SubcontractingList() {
  const { data, isLoading } = useQuery<PickingResponse>({
    queryKey: ['subcontracting-list'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.post('/model/stock.picking', {
          domain: [['is_subcontract', '=', true]],
          fields: ['id', 'name', 'partner_id', 'state', 'scheduled_date', 'date_done', 'origin'],
          order: 'scheduled_date desc',
          limit: 50,
        })
        return data
      } catch {
        // Fallback: fetch without subcontract domain filter
        const { data } = await erpClient.raw.post('/model/stock.picking', {
          fields: ['id', 'name', 'partner_id', 'state', 'scheduled_date', 'date_done', 'origin'],
          order: 'scheduled_date desc',
          limit: 50,
        })
        return data
      }
    },
  })

  const columns: Column<StockPicking>[] = [
    {
      key: 'name',
      label: 'Reference',
      render: (v) => <span className="font-medium font-mono text-sm">{v}</span>,
    },
    {
      key: 'partner_id',
      label: 'Subcontractor',
      format: fmt,
    },
    {
      key: 'origin',
      label: 'Source',
      format: (v) => v || '—',
    },
    {
      key: 'scheduled_date',
      label: 'Scheduled Date',
      format: fmtDate,
    },
    {
      key: 'date_done',
      label: 'Done Date',
      format: fmtDate,
    },
    {
      key: 'state',
      label: 'Status',
      render: (v) => {
        const s = STATE_BADGE[v] ?? { label: v, variant: 'secondary' as BadgeVariant }
        return <Badge variant={s.variant} className="rounded-full text-xs">{s.label}</Badge>
      },
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Subcontracting" subtitle="manufacturing" />
      <DataTable
        columns={columns}
        data={data?.records ?? []}
        total={data?.total}
        loading={isLoading}
        emptyMessage="No subcontracting orders found"
        emptyIcon={<Truck className="h-10 w-10" />}
      />
    </div>
  )
}
