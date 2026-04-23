import { useQuery } from '@tanstack/react-query'
import { Badge, cn, type BadgeVariant } from '@mashora/design-system'
import { DollarSign } from 'lucide-react'
import { DataTable, PageHeader, type Column } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface ProjectBillingRow {
  id: number
  name: string
  partner_id: [number, string] | false
  analytic_account_id: [number, string] | false
  total_timesheet_time: number
  planned_hours: number
  remaining_hours: number
}

interface ProjectResponse {
  records: ProjectBillingRow[]
  total: number
}

function fmt(v: unknown): string {
  if (Array.isArray(v)) return String(v[1] ?? '')
  return v == null || v === false ? '—' : String(v)
}

function fmtHours(h: number | null | undefined): string {
  if (!h && h !== 0) return '—'
  return `${Number(h).toFixed(1)}h`
}

function ProfitBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-muted-foreground text-sm">—</span>
  const variant: BadgeVariant = pct >= 80 ? 'success' : pct >= 50 ? 'warning' : 'destructive'
  return (
    <Badge variant={variant} className="rounded-full text-xs tabular-nums">
      {pct.toFixed(0)}%
    </Badge>
  )
}

function calcProfitability(row: ProjectBillingRow): number | null {
  const planned = Number(row.planned_hours ?? 0)
  const remaining = Number(row.remaining_hours ?? 0)
  if (!planned) return null
  return ((planned - remaining) / planned) * 100
}

export default function ProjectBilling() {
  const { data, isLoading } = useQuery<ProjectResponse>({
    queryKey: ['project-billing'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/project.project', {
        fields: [
          'id', 'name', 'partner_id', 'analytic_account_id',
          'total_timesheet_time', 'planned_hours', 'remaining_hours',
        ],
        order: 'name asc',
        limit: 100,
      })
      return data
    },
  })

  const columns: Column<ProjectBillingRow>[] = [
    {
      key: 'name',
      label: 'Project',
      render: (v) => <span className="font-medium text-sm">{v}</span>,
    },
    {
      key: 'partner_id',
      label: 'Customer',
      format: fmt,
    },
    {
      key: 'planned_hours',
      label: 'Planned',
      align: 'right',
      format: fmtHours,
    },
    {
      key: 'total_timesheet_time',
      label: 'Timesheet',
      align: 'right',
      format: fmtHours,
    },
    {
      key: 'remaining_hours',
      label: 'Remaining',
      align: 'right',
      render: (v, row) => {
        const rem = Number(v ?? 0)
        const planned = Number(row.planned_hours ?? 0)
        const over = planned > 0 && rem < 0
        return (
          <span className={cn('tabular-nums text-sm', over && 'text-destructive font-semibold')}>
            {fmtHours(rem)}
          </span>
        )
      },
    },
    {
      key: 'id',
      label: 'Profitability',
      align: 'center',
      render: (_, row) => <ProfitBadge pct={calcProfitability(row)} />,
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Project Billing" subtitle="project" />
      <DataTable
        columns={columns}
        data={data?.records ?? []}
        total={data?.total}
        loading={isLoading}
        rowLink={row => `/admin/projects/${row.id}`}
        emptyMessage="No projects found"
        emptyIcon={<DollarSign className="h-10 w-10" />}
      />
    </div>
  )
}
