import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import { XCircle } from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface LostReason {
  id: number
  name: string
}

interface LostReasonsResponse {
  records: LostReason[]
  total: number
}

export default function LostReasons() {
  const { data, isLoading } = useQuery<LostReasonsResponse>({
    queryKey: ['crm-lost-reasons'],
    queryFn: async () => {
      const { data } = await erpClient.raw.get('/crm/lost-reasons')
      return data
    },
  })

  const reasons = data?.records ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-4">
      <PageHeader
        title="Lost Reasons"
        subtitle={isLoading ? 'Loading…' : `${total} reason${total !== 1 ? 's' : ''}`}
      />

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-2xl" />
          ))}
        </div>
      )}

      {!isLoading && reasons.length === 0 && (
        <div className="rounded-2xl border border-border/30 bg-card/50 p-6 flex flex-col items-center justify-center gap-2 py-12">
          <XCircle className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No lost reasons configured</p>
        </div>
      )}

      {!isLoading && reasons.length > 0 && (
        <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-1">
          {reasons.map((reason, idx) => (
            <div
              key={reason.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-muted/30 ${
                idx !== reasons.length - 1 ? 'border-b border-border/20' : ''
              }`}
            >
              <XCircle className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              <span className="text-sm text-foreground">{reason.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
