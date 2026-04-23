import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Input, Badge,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Skeleton,
} from '@mashora/design-system'
import { PageHeader, EmptyState } from '@/components/shared'
import { Search, Car } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

interface Vehicle {
  id: number
  name: string
  license_plate: string
  model_id: [number, string] | false
  driver_id: [number, string] | false
  state_id: [number, string] | false
  fuel_type: string | false
  odometer?: number
  company_id: [number, string] | false
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i} className="hover:bg-transparent">
          {Array.from({ length: cols }).map((__, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full max-w-[140px]" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

export default function FleetList() {
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['fleet-vehicles', search],
    queryFn: () =>
      erpClient.raw
        .post('/fleet/vehicles', { search: search || undefined, limit: 50 })
        .then(r => r.data),
  })

  const records: Vehicle[] = data?.records ?? []
  const handleCreate = () => navigate('/admin/model/fleet.vehicle/new')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fleet Vehicles"
        subtitle={`${data?.total ?? '—'} vehicles`}
        onNew={handleCreate}
        newLabel="New Vehicle"
      />

      <div className="rounded-3xl border border-border/60 bg-card shadow-panel p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search vehicles or plates..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rounded-2xl pl-9 border-border/60 bg-muted/30 focus:bg-background"
          />
        </div>
      </div>

      <div className="rounded-3xl border border-border/60 bg-card shadow-panel overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/70 bg-muted/20 hover:bg-muted/20">
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Vehicle</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">License Plate</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Driver</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">State</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Mileage</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Company</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton cols={6} />
            ) : records.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="h-40 text-center">
                  <EmptyState
                    icon={<Car className="h-12 w-12" />}
                    title="No vehicles yet"
                    description="Add vehicles to manage your fleet."
                    actionLabel="New Vehicle"
                    onAction={handleCreate}
                  />
                </TableCell>
              </TableRow>
            ) : (
              records.map(row => (
                <TableRow
                  key={row.id}
                  className="border-border/40 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/admin/fleet/${row.id}`)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{row.name}</p>
                      {row.model_id && (
                        <p className="text-xs text-muted-foreground">{row.model_id[1]}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm">{row.license_plate || '—'}</span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.driver_id ? row.driver_id[1] : '—'}
                  </TableCell>
                  <TableCell>
                    {row.state_id
                      ? <Badge variant="secondary">{row.state_id[1]}</Badge>
                      : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.odometer != null ? `${row.odometer.toLocaleString()} km` : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.company_id ? row.company_id[1] : '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
