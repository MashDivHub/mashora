import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import { LayoutDashboard } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/shared'
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

  const records: any[] = data?.records ?? []

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
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <LayoutDashboard className="h-10 w-10 opacity-40" />
          <p className="text-sm">No dashboards available</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {records.map((row: any) => (
            <div
              key={row.id}
              onClick={() => navigate(`/admin/dashboards/${row.id}`)}
              className="rounded-2xl border border-border/30 bg-card/50 p-5 hover:bg-muted/20 hover:-translate-y-0.5 transition-all cursor-pointer"
            >
              <p className="text-base font-bold truncate">{row.name}</p>
              <p className="mt-2 text-xs text-muted-foreground">Last modified: {fmt(row.write_date)}</p>
              <p className="text-xs text-muted-foreground">Created: {fmt(row.create_date)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
