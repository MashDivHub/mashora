import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import { LayoutDashboard } from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

function fmt(dateStr: string | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function DashboardView() {
  const { id } = useParams<{ id: string }>()

  const { data, isLoading } = useQuery({
    queryKey: ['spreadsheet.dashboard', id],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.post('/model/spreadsheet.dashboard', {
          domain: [['id', '=', Number(id)]],
          fields: ['id', 'name', 'spreadsheet_data', 'create_date', 'write_date'],
          limit: 1,
        })
        return data?.records?.[0] ?? null
      } catch {
        return null
      }
    },
    enabled: !!id,
  })

  const name = isLoading ? '' : (data?.name ?? 'Dashboard')

  return (
    <div className="space-y-4">
      <PageHeader title={name} backTo="/dashboards" />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      ) : (
        <>
          {/* Info card */}
          <div className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-2">
            <p className="text-sm font-semibold">
              Name: <span className="font-normal text-muted-foreground">{data?.name ?? '—'}</span>
            </p>
            <p className="text-sm font-semibold">
              Created: <span className="font-normal text-muted-foreground">{fmt(data?.create_date)}</span>
            </p>
            <p className="text-sm font-semibold">
              Last Modified: <span className="font-normal text-muted-foreground">{fmt(data?.write_date)}</span>
            </p>
          </div>

          {/* Placeholder viewer card */}
          <div className="rounded-2xl border border-border/30 bg-card/50 p-10 flex flex-col items-center justify-center gap-4 text-center">
            <LayoutDashboard className="h-14 w-14 text-muted-foreground opacity-30" />
            <p className="text-sm text-muted-foreground max-w-xs">
              Dashboard viewer coming soon — spreadsheet rendering requires a dedicated engine.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
