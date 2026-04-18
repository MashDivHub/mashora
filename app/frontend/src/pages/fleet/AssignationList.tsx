import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge, Button } from '@mashora/design-system'
import { Users, XCircle } from 'lucide-react'
import {
  DataTable, PageHeader, SearchBar, toast,
  type Column, type FilterOption,
} from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

interface AssignationRow {
  id: number
  vehicle_id: [number, string] | false
  driver_id: [number, string] | false
  date_start: string
  date_end: string | false
}

const FILTERS: FilterOption[] = [
  { key: 'current', label: 'Current', domain: [['date_end', '=', false]] },
  { key: 'past', label: 'Past', domain: [['date_end', '!=', false]] },
]

export default function AssignationList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const vehicleFilter = searchParams.get('vehicle')
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>('date_start')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const pageSize = 40

  const domain: unknown[] = []
  if (vehicleFilter) domain.push(['vehicle_id', '=', parseInt(vehicleFilter)])
  if (search) domain.push(['driver_id.name', 'ilike', search])
  for (const key of activeFilters) {
    const f = FILTERS.find(fl => fl.key === key)
    if (f?.domain) domain.push(...f.domain)
  }

  const order = sortField ? `${sortField} ${sortDir}` : 'date_start desc'

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['fleet-assignations', domain, page, order],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/fleet.vehicle.assignation.log', {
        domain: domain.length ? domain : undefined,
        fields: ['id', 'vehicle_id', 'driver_id', 'date_start', 'date_end'],
        offset: page * pageSize,
        limit: pageSize,
        order,
      })
      return data
    },
  })

  const endMut = useMutation({
    mutationFn: async (id: number) => {
      await erpClient.raw.put(`/model/fleet.vehicle.assignation.log/${id}`, {
        vals: { date_end: new Date().toISOString().slice(0, 10) },
      })
    },
    onSuccess: () => {
      toast.success('Ended', 'Assignment ended')
      queryClient.invalidateQueries({ queryKey: ['fleet-assignations'] })
    },
    onError: (e: unknown) => toast.error('Failed', extractErrorMessage(e)),
  })

  const records: AssignationRow[] = data?.records || []

  const columns: Column<AssignationRow>[] = [
    {
      key: 'vehicle_id', label: 'Vehicle',
      render: (v) => Array.isArray(v) ? <span className="font-medium">{v[1]}</span> : '—',
    },
    {
      key: 'driver_id', label: 'Driver',
      format: (v) => Array.isArray(v) ? v[1] : '—',
    },
    {
      key: 'date_start', label: 'Start Date', sortable: true,
      format: (v) => v ? new Date(v).toLocaleDateString() : '',
    },
    {
      key: 'date_end', label: 'End Date',
      render: (v) => v
        ? <span>{new Date(v as string).toLocaleDateString()}</span>
        : <Badge variant="success">Current</Badge>,
    },
    {
      key: 'id', label: 'Actions', align: 'right',
      render: (_v, row) => row.date_end
        ? null
        : (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-xl gap-1.5 text-destructive"
            onClick={(e) => { e.stopPropagation(); endMut.mutate(row.id) }}
            disabled={endMut.isPending}
          >
            <XCircle className="h-3.5 w-3.5" /> End
          </Button>
        ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Vehicle Assignments"
        subtitle={vehicleFilter ? 'filtered by vehicle' : 'driver history'}
        onNew={() => navigate(`/admin/fleet/assignations/new${vehicleFilter ? `?vehicle=${vehicleFilter}` : ''}`)}
      />
      <SearchBar
        placeholder="Search by driver..."
        onSearch={(v) => { setSearch(v); setPage(0) }}
        filters={FILTERS}
        activeFilters={activeFilters}
        onFilterToggle={k => { setActiveFilters(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]); setPage(0) }}
      />
      <DataTable
        columns={columns}
        data={records}
        total={data?.total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        sortField={sortField}
        sortDir={sortDir}
        onSort={(f, d) => { setSortField(f); setSortDir(d) }}
        loading={isLoading}
        isError={isError} error={error} onRetry={() => refetch()}
        rowLink={(row) => `/admin/fleet/assignations/${row.id}`}
        emptyMessage="No assignments found"
        emptyIcon={<Users className="h-10 w-10" />}
      />
    </div>
  )
}
