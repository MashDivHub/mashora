import { useQuery } from '@tanstack/react-query'
import { Badge } from '@mashora/design-system'
import { Layers } from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

const LIST_FIELDS = ['id', 'name', 'sequence', 'fold', 'project_ids']

interface StageRecord {
  id: number
  name: string
  sequence: number
  fold: boolean
  project_ids: number[]
}

export default function TaskStages() {
  const { data, isLoading } = useQuery({
    queryKey: ['task-stages'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/project.task.type', {
        fields: LIST_FIELDS,
        order: 'sequence asc',
        limit: 100,
      })
      return data
    },
  })

  const records: StageRecord[] = data?.records || []

  return (
    <div className="space-y-4">
      <PageHeader title="Task Stages" subtitle="project" />

      {isLoading && (
        <div className="space-y-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="h-4 w-4 rounded-full bg-border/50 animate-pulse mt-5" />
                {i < 4 && <div className="w-px flex-1 bg-border/30 min-h-[2rem]" />}
              </div>
              <div className="rounded-2xl border border-border/30 bg-card/50 p-4 flex-1 h-16 mb-2 animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && records.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Layers className="h-10 w-10" />
          <p className="text-sm">No task stages found</p>
        </div>
      )}

      {!isLoading && records.length > 0 && (
        <div>
          {records.map((stage, index) => (
            <div key={stage.id} className="flex gap-4">
              {/* Connector column */}
              <div className="flex flex-col items-center">
                <div className="h-5 w-px bg-border/30 mt-0" style={{ visibility: index === 0 ? 'hidden' : 'visible' }} />
                <div className="h-2.5 w-2.5 rounded-full bg-primary/50 ring-2 ring-primary/20 shrink-0 my-1" />
                <div className="w-px flex-1 bg-border/30" style={{ visibility: index === records.length - 1 ? 'hidden' : 'visible' }} />
              </div>

              {/* Stage card */}
              <div className="rounded-2xl border border-border/30 bg-card/50 p-4 flex-1 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold">{stage.name}</span>
                  <Badge variant="secondary" className="rounded-full text-[10px] px-1.5 py-0 tabular-nums">
                    #{stage.sequence}
                  </Badge>
                  {stage.fold && (
                    <span className="text-xs text-muted-foreground italic">Folded in Kanban</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stage.project_ids.length} {stage.project_ids.length === 1 ? 'project' : 'projects'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
