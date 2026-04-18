import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Badge, Skeleton, cn } from '@mashora/design-system'
import { CheckCircle2, Clock, AlertCircle, Calendar, ArrowRight, Filter, type LucideIcon } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

type ActivityFilter = 'all' | 'overdue' | 'today' | 'upcoming'

type DomainTerm = string | [string, string, unknown]

interface ActivityRecord {
  id: number
  activity_type_id?: [number, string] | false
  summary?: string | false
  note?: string | false
  date_deadline?: string | false
  res_model?: string | false
  res_id?: number | false
  res_name?: string | false
  user_id?: [number, string] | false
  state?: string | false
}

export default function ActivityDashboard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<ActivityFilter>('all')

  const { data, isLoading } = useQuery({
    queryKey: ['activities', 'dashboard', filter],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]
      let domain: DomainTerm[] = []

      if (filter === 'overdue') {
        domain = [['date_deadline', '<', today]]
      } else if (filter === 'today') {
        domain = [['date_deadline', '=', today]]
      } else if (filter === 'upcoming') {
        domain = [['date_deadline', '>', today]]
      }

      try {
        const { data } = await erpClient.raw.post('/model/mail.activity', {
          domain: domain.length ? domain : undefined,
          fields: ['id', 'activity_type_id', 'summary', 'note', 'date_deadline', 'res_model', 'res_id', 'res_name', 'user_id', 'state'],
          limit: 100,
          order: 'date_deadline asc',
        })
        return data
      } catch {
        return { records: [], total: 0 }
      }
    },
  })

  const markDoneMut = useMutation({
    mutationFn: async (activityId: number) => {
      await erpClient.raw.post(`/chatter/activities/${activityId}/done`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] })
    },
  })

  const activities = data?.records || []
  const today = new Date().toISOString().split('T')[0]

  const filters: { key: ActivityFilter; label: string; icon: LucideIcon }[] = [
    { key: 'all', label: 'All', icon: Filter },
    { key: 'overdue', label: 'Overdue', icon: AlertCircle },
    { key: 'today', label: 'Today', icon: Clock },
    { key: 'upcoming', label: 'Upcoming', icon: Calendar },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Collaboration</p>
          <h1 className="text-xl font-semibold tracking-tight">Activities</h1>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5">
        {filters.map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            variant={filter === key ? 'default' : 'outline'}
            size="sm"
            className="rounded-xl gap-1.5"
            onClick={() => setFilter(key)}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Button>
        ))}
      </div>

      {/* Activity list */}
      <div className="rounded-3xl border border-border/60 bg-card shadow-panel overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : activities.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-lg font-medium text-muted-foreground">No activities</p>
            <p className="text-sm text-muted-foreground mt-1">
              {filter === 'all' ? 'You have no pending activities.' : `No ${filter} activities found.`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {(activities as ActivityRecord[]).map((activity) => {
              const isOverdue = activity.date_deadline && activity.date_deadline < today
              const isToday = activity.date_deadline === today

              return (
                <div
                  key={activity.id}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors"
                >
                  {/* Status indicator */}
                  <div className={cn(
                    'rounded-full p-2',
                    isOverdue ? 'bg-destructive/10 text-destructive' :
                    isToday ? 'bg-warning/10 text-warning' :
                    'bg-muted/60 text-muted-foreground'
                  )}>
                    {isOverdue ? <AlertCircle className="h-4 w-4" /> :
                     isToday ? <Clock className="h-4 w-4" /> :
                     <Calendar className="h-4 w-4" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {Array.isArray(activity.activity_type_id) ? activity.activity_type_id[1] : 'Activity'}
                      </span>
                      <Badge variant={isOverdue ? 'destructive' : isToday ? 'warning' : 'secondary'} className="text-[10px] rounded-full">
                        {activity.date_deadline || 'No date'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {activity.summary || activity.res_name || ''}
                    </p>
                    {activity.res_model && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {activity.res_model} {activity.res_name ? `· ${activity.res_name}` : ''}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-xl text-xs gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                      onClick={() => markDoneMut.mutate(activity.id)}
                      disabled={markDoneMut.isPending}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Done
                    </Button>
                    {activity.res_model && activity.res_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl text-xs gap-1"
                        onClick={() => navigate(`/admin/model/${activity.res_model}/${activity.res_id}`)}
                      >
                        Open <ArrowRight className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
