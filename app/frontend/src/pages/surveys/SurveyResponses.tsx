import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@mashora/design-system'
import { MessageSquare } from 'lucide-react'
import { DataTable, PageHeader, type Column } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface SurveyAnswer {
  id: number
  partner_id: [number, string] | false
  email: string
  state: 'new' | 'done' | 'skip'
  create_date: string
  scoring_total: number
  scoring_percentage: number
}

const STATE_VARIANT: Record<string, 'secondary' | 'success' | 'warning'> = {
  new: 'secondary',
  done: 'success',
  skip: 'warning',
}

const STATE_LABEL: Record<string, string> = {
  new: 'New',
  done: 'Done',
  skip: 'Skipped',
}

function formatDate(raw: string): string {
  if (!raw) return '—'
  try {
    return new Date(raw).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return raw
  }
}

export default function SurveyResponses() {
  const { id } = useParams<{ id: string }>()
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>('create_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const pageSize = 40

  const order = sortField ? `${sortField} ${sortDir}` : 'create_date desc'

  const { data, isLoading } = useQuery({
    queryKey: ['survey-answers', id, page, order],
    queryFn: async () => {
      const { data } = await erpClient.raw.post(`/surveys/${id}/answers`, {
        offset: page * pageSize,
        limit: pageSize,
        order,
      })
      return data
    },
    enabled: !!id,
  })

  const columns: Column<SurveyAnswer>[] = [
    {
      key: 'partner_id',
      label: 'Respondent',
      render: (v, row) => {
        const name = Array.isArray(v) ? v[1] : row.email || 'Anonymous'
        return <span className="text-sm">{name}</span>
      },
    },
    {
      key: 'state',
      label: 'Status',
      render: (v) => (
        <Badge variant={STATE_VARIANT[v] ?? 'secondary'}>
          {STATE_LABEL[v] ?? v}
        </Badge>
      ),
    },
    {
      key: 'scoring_percentage',
      label: 'Score',
      align: 'right',
      render: (v) =>
        v > 0 ? (
          <span className="text-sm font-mono">{Number(v).toFixed(0)}%</span>
        ) : (
          ''
        ),
    },
    {
      key: 'create_date',
      label: 'Submitted',
      format: (v) => formatDate(v),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Survey Responses"
        backTo={`/admin/surveys/${id}`}
        subtitle={data?.total != null ? `${data.total} response${data.total !== 1 ? 's' : ''}` : undefined}
      />
      <DataTable
        columns={columns}
        data={data?.records ?? []}
        total={data?.total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        sortField={sortField}
        sortDir={sortDir}
        onSort={(f, d) => { setSortField(f); setSortDir(d) }}
        loading={isLoading}
        emptyMessage="No responses yet"
        emptyIcon={<MessageSquare className="h-10 w-10" />}
      />
    </div>
  )
}
