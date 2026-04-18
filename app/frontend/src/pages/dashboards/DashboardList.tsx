import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import { LayoutDashboard } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, EmptyState } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

function fmt(dateStr: string | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function DashboardList() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['spreadsheet.dashboard.list'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.post('/model/spreadsheet.dashboard', {
          fields: ['id', 'name', 'create_date', 'write_date'],
          order: 'name asc',
          limit: 100,
        })
        return data
      } catch {
        return { records: [], total: 0 }
      }
    },
  })

  interface DashboardRow { id: number; name: string; write_date?: string | false; create_date?: string | false }
  const records: DashboardRow[] = data?.records ?? []

  return (
    <div className="space-y-4">
      <PageHeader title="Dashboards" />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <EmptyState
          icon={<LayoutDashboard className="h-12 w-12" />}
          title="No dashboards yet"
          description="Create your first dashboard to start visualizing your data."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {records.map((row) => (
            <div
              key={row.id}
              onClick={() => navigate(`/admin/dashboards/${row.id}`)}
              className="rounded-2xl border border-border/30 bg-card/50 p-5 hover:bg-muted/20 hover:-translate-y-0.5 transition-all cursor-pointer"
            >
              <p className="text-base font-bold truncate">{row.name}</p>
              <p className="mt-2 text-xs text-muted-foreground">Last modified: {fmt(typeof row.write_date === 'string' ? row.write_date : undefined)}</p>
              <p className="text-xs text-muted-foreground">Created: {fmt(typeof row.create_date === 'string' ? row.create_date : undefined)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
