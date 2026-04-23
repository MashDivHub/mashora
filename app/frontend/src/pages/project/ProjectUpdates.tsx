import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Badge, type BadgeVariant } from '@mashora/design-system'
import { Activity } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

const LIST_FIELDS = ['id', 'name', 'project_id', 'status', 'date', 'description', 'user_id', 'create_date']

const STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
  on_track:  { label: 'On Track',  variant: 'success' },
  at_risk:   { label: 'At Risk',   variant: 'warning' },
  off_track: { label: 'Off Track', variant: 'destructive' },
  on_hold:   { label: 'On Hold',   variant: 'secondary' },
}

interface UpdateRecord {
  id: number
  name: string
  project_id: [number, string] | false
  status: string
  date: string
  description: string
  user_id: [number, string] | false
}

export default function ProjectUpdates() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['project-updates'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/project.update', {
        fields: LIST_FIELDS,
        order: 'date desc',
        limit: 50,
      })
      return data
    },
  })

  const records: UpdateRecord[] = data?.records || []
  const handleCreate = () => navigate('/admin/model/project.update/new')

  return (
    <div className="space-y-4">
      <PageHeader
        title="Project Updates"
        subtitle="project"
        onNew={handleCreate}
        newLabel="New Update"
      />

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/30 bg-card/50 p-5 h-28 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && records.length === 0 && (
        <EmptyState
          icon={<Activity className="h-12 w-12" />}
          title="No project updates yet"
          description="Post status updates to keep stakeholders informed on project progress."
          actionLabel="New Update"
          onAction={handleCreate}
        />
      )}

      {!isLoading && records.length > 0 && (
        <div className="space-y-3">
          {records.map(update => {
            const statusCfg = STATUS_CONFIG[update.status] || { label: update.status, variant: 'secondary' as BadgeVariant }
            const projectName = Array.isArray(update.project_id) ? update.project_id[1] : 'Unknown Project'
            const authorName = Array.isArray(update.user_id) ? update.user_id[1] : ''
            const formattedDate = update.date ? new Date(update.date).toLocaleDateString() : ''

            return (
              <button
                key={update.id}
                type="button"
                onClick={() => navigate(`/admin/model/project.update/${update.id}`)}
                className="w-full text-left rounded-2xl border border-border/30 bg-card/50 p-5 space-y-2 transition-colors hover:border-border/60 hover:bg-card/70 focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-muted-foreground">{projectName}</span>
                  <Badge variant={statusCfg.variant} className="rounded-full text-xs">
                    {statusCfg.label}
                  </Badge>
                </div>
                <p className="text-sm font-bold leading-snug">{update.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formattedDate}{authorName ? ` · ${authorName}` : ''}
                </p>
                {update.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{update.description}</p>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
