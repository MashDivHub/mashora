import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@mashora/design-system'
import { ClipboardList } from 'lucide-react'
import { DataTable, PageHeader, SearchBar, type Column, type FilterOption } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface Survey {
  id: number
  title: string
  state: 'draft' | 'open' | 'closed'
  answer_count: number
  question_count: number
  scoring_type: string
  certification: boolean
  access_mode: string
}

const SCORING_LABELS: Record<string, string> = {
  no_scoring: 'None',
  scoring_with_answers: 'With Answers',
  scoring_without_answers: 'Without Answers',
}

const STATE_VARIANT: Record<string, 'secondary' | 'success' | 'default'> = {
  draft: 'secondary',
  open: 'success',
  closed: 'default',
}

const STATE_LABEL: Record<string, string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
}

const FILTERS: FilterOption[] = [
  { key: 'draft', label: 'Draft', domain: [['state', '=', 'draft']] },
  { key: 'open', label: 'Open', domain: [['state', '=', 'open']] },
  { key: 'closed', label: 'Closed', domain: [['state', '=', 'closed']] },
]

export default function SurveyList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>('create_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const pageSize = 40

  const stateFilter = activeFilters.length > 0 ? activeFilters : undefined
  const order = sortField ? `${sortField} ${sortDir}` : 'create_date desc'

  const { data, isLoading } = useQuery({
    queryKey: ['surveys', search, stateFilter, page, order],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/surveys/list', {
        state: stateFilter,
        search: search || undefined,
        offset: page * pageSize,
        limit: pageSize,
        order,
      })
      return data
    },
  })

  const columns: Column<Survey>[] = [
    {
      key: 'title',
      label: 'Title',
      render: (v) => <span className="font-semibold text-sm">{v}</span>,
    },
    {
      key: 'question_count',
      label: 'Questions',
      align: 'right',
      format: (v) => String(v ?? 0),
    },
    {
      key: 'answer_count',
      label: 'Responses',
      align: 'right',
      format: (v) => String(v ?? 0),
    },
    {
      key: 'scoring_type',
      label: 'Scoring',
      format: (v) => SCORING_LABELS[v] ?? v ?? '',
    },
    {
      key: 'certification',
      label: 'Certification',
      align: 'center',
      render: (v) =>
        v ? (
          <Badge variant="default" className="rounded-full text-xs">
            Certified
          </Badge>
        ) : (
          ''
        ),
    },
    {
      key: 'access_mode',
      label: 'Access',
      format: (v) => v ?? '',
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
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Surveys"
        subtitle={data?.total != null ? `${data.total} survey${data.total !== 1 ? 's' : ''}` : undefined}
      />
      <SearchBar
        placeholder="Search surveys..."
        onSearch={(v) => { setSearch(v); setPage(0) }}
        filters={FILTERS}
        activeFilters={activeFilters}
        onFilterToggle={(k) => {
          setActiveFilters((p) =>
            p.includes(k) ? p.filter((x) => x !== k) : [...p, k]
          )
          setPage(0)
        }}
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
        rowLink={(row) => `/admin/surveys/${row.id}`}
        emptyMessage="No surveys found"
        emptyIcon={<ClipboardList className="h-10 w-10" />}
      />
    </div>
  )
}
