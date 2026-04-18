import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@mashora/design-system'
import { Gauge } from 'lucide-react'
import {
  DataTable, PageHeader, SearchBar,
  type Column, type FilterOption,
} from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface OdometerRow {
  id: number
  name: string | false
  vehicle_id: [number, string] | false
  driver_id: [number, string] | false
  date: string
  value: number
  unit: string
}

export default function OdometerList() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const vehicleFilter = searchParams.get('vehicle')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const pageSize = 40

  const domain: unknown[] = []
  if (vehicleFilter) domain.push(['vehicle_id', '=', parseInt(vehicleFilter)])
  if (search) domain.push(['vehicle_id.name', 'ilike', search])

  const order = sortField ? `${sortField} ${sortDir}` : 'date desc'

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['fleet-odometer', domain, page, order],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/fleet.vehicle.odometer', {
        domain: domain.length ? domain : undefined,
        fields: ['id', 'name', 'vehicle_id', 'driver_id', 'date', 'value', 'unit'],
        offset: page * pageSize,
        limit: pageSize,
        order,
      })
      return data
    },
  })

  const records: OdometerRow[] = data?.records || []

  const columns: Column<OdometerRow>[] = [
    {
      key: 'date', label: 'Date', sortable: true,
      format: (v) => v ? new Date(v).toLocaleDateString() : '',
    },
    {
      key: 'vehicle_id', label: 'Vehicle',
      render: (v) => Array.isArray(v) ? <span className="font-medium">{v[1]}</span> : '—',
    },
    {
      key: 'driver_id', label: 'Driver',
      format: (v) => Array.isArray(v) ? v[1] : '—',
    },
    {
      key: 'value', label: 'Reading', align: 'right', sortable: true,
      render: (v, row) => (
        <span className="font-mono">
          {v != null ? Number(v).toLocaleString() : '—'}{' '}
          <Badge variant="outline" className="ml-1 text-xs">{row.unit === 'miles' ? 'mi' : 'km'}</Badge>
        </span>
      ),
    },
    {
      key: 'name', label: 'Description',
      format: (v) => v || '—',
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Odometer Logs"
        subtitle={vehicleFilter ? 'filtered by vehicle' : 'all readings'}
        onNew={() => navigate('/admin/fleet/odometer/new')}
      />
      <SearchBar
        placeholder="Search by vehicle..."
        onSearch={(v) => { setSearch(v); setPage(0) }}
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
        rowLink={(row) => `/admin/fleet/odometer/${row.id}`}
        emptyMessage="No odometer readings found"
        emptyIcon={<Gauge className="h-10 w-10" />}
      />
    </div>
  )
}
