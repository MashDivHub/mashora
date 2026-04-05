import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  PageHeader, Input, Badge,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Skeleton,
} from '@mashora/design-system'
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

export default function Fleet() {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['fleet', search],
    queryFn: () => erpClient.raw.post('/fleet/vehicles', { search: search || undefined, limit: 50 }).then(r => r.data),
  })

  const records: Vehicle[] = data?.records ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="Fleet" description={`${data?.total ?? '—'} vehicles`} />

      {/* Filter bar */}
      <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search vehicles..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rounded-2xl pl-9 border-border/60 bg-muted/30 focus:bg-background"
          />
        </div>
      </div>

      {/* Table card */}
      <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/70 bg-muted/20 hover:bg-muted/20">
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Vehicle</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Plate</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Model</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Driver</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Fuel</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton cols={6} />
            ) : records.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
                      <Car className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">No vehicles found.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              records.map(row => (
                <TableRow key={row.id} className="border-border/40 hover:bg-muted/50 transition-colors">
                  <TableCell>
                    <span className="font-medium text-sm">{row.name}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm">{row.license_plate}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.model_id ? row.model_id[1] : '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.driver_id ? row.driver_id[1] : '—'}
                  </TableCell>
                  <TableCell>
                    {row.fuel_type
                      ? <Badge variant="outline" className="capitalize">{row.fuel_type}</Badge>
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {row.state_id
                      ? <Badge variant="secondary">{row.state_id[1]}</Badge>
                      : '—'}
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
