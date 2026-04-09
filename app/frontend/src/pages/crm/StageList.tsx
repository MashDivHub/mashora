import { useQuery } from '@tanstack/react-query'
import { Badge, Skeleton } from '@mashora/design-system'
import { CheckCircle2, GitBranch } from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface Stage {
  id: number
  name: string
  is_won: boolean
  sequence: number
  fold: boolean
  team_ids?: number[]
}

interface StagesResponse {
  records: Stage[]
  total: number
}

export default function StageList() {
  const { data, isLoading } = useQuery<StagesResponse>({
    queryKey: ['crm-stages'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/crm/stages', {})
      return data
    },
  })

  const stages = [...(data?.records ?? [])].sort((a, b) => a.sequence - b.sequence)
  const total = data?.total ?? 0

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pipeline Stages"
        subtitle={isLoading ? 'Loading…' : `${total} stage${total !== 1 ? 's' : ''}`}
      />

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      )}

      {!isLoading && stages.length === 0 && (
        <div className="rounded-2xl border border-border/30 bg-card/50 p-6 flex flex-col items-center justify-center gap-2 py-12">
          <GitBranch className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No pipeline stages configured</p>
        </div>
      )}

      {!isLoading && stages.length > 0 && (
        <div className="flex flex-col">
          {stages.map((stage, idx) => (
            <div key={stage.id} className="flex flex-col items-stretch">
              <div className="rounded-2xl border border-border/30 bg-card/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  {/* Left: sequence + name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono text-muted-foreground/60 w-6 text-right shrink-0">
                      {stage.sequence}
                    </span>
                    <span className="text-sm font-bold truncate">{stage.name}</span>
                    {stage.is_won && (
                      <Badge className="rounded-full bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="h-3 w-3" />
                        Won
                      </Badge>
                    )}
                    {stage.fold && (
                      <span className="text-xs text-muted-foreground/60 shrink-0">Folded</span>
                    )}
                  </div>

                  {/* Right: team */}
                  <span className="text-xs text-muted-foreground shrink-0">
                    {stage.team_ids && stage.team_ids.length > 0 ? `${stage.team_ids.length} team${stage.team_ids.length !== 1 ? 's' : ''}` : 'All Teams'}
                  </span>
                </div>
              </div>

              {/* Pipeline connector between cards */}
              {idx < stages.length - 1 && (
                <div className="flex justify-center">
                  <div className="w-px h-3 bg-border/40" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
