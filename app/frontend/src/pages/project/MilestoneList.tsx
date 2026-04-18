import { useQuery } from '@tanstack/react-query'
import { Badge, cn } from '@mashora/design-system'
import { Milestone, Clock } from 'lucide-react'
import { DataTable, PageHeader, type Column } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

const LIST_FIELDS = ['id', 'name', 'project_id', 'deadline', 'is_reached', 'create_date']

const today = new Date()
today.setHours(0, 0, 0, 0)

function getStatusBadge(is_reached: boolean, deadline: string | false) {
  if (is_reached) return <Badge variant="success" className="rounded-full text-xs">Reached</Badge>
  if (deadline && new Date(deadline) < today) return <Badge variant="destructive" className="rounded-full text-xs">Overdue</Badge>
  return <Badge variant="secondary" className="rounded-full text-xs">Pending</Badge>
}

export default function MilestoneList() {
  const { data, isLoading } = useQuery({
    queryKey: ['milestones'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/project.milestone', {
        fields: LIST_FIELDS,
        order: 'deadline asc',
        limit: 100,
      })
      return data
    },
  })

  const columns: Column[] = [
    {
      key: 'name',
      label: 'Milestone',
      render: (_, row) => <span className="text-sm font-medium">{row.name}</span>,
    },
    {
      key: 'project_id',
      label: 'Project',
      format: v => Array.isArray(v) ? v[1] : '',
    },
    {
      key: 'deadline',
      label: 'Deadline',
      render: v => {
        const overdue = v && new Date(v) < today
        return (
          <span
            className={cn('text-sm inline-flex items-center gap-1', overdue && 'text-red-400')}
            aria-label={overdue ? `overdue ${new Date(v).toLocaleDateString()}` : undefined}
          >
            {overdue && <Clock className="h-3 w-3" aria-hidden="true" />}
            {v ? new Date(v).toLocaleDateString() : 'No deadline'}
          </span>
        )
      },
    },
    {
      key: 'is_reached',
      label: 'Status',
      render: (v, row) => getStatusBadge(v, row.deadline),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Milestones" subtitle="project" />
      <DataTable
        columns={columns}
        data={data?.records || []}
        total={data?.total}
        loading={isLoading}
        emptyMessage="No milestones found"
        emptyIcon={<Milestone className="h-10 w-10" />}
      />
    </div>
  )
}
