import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Badge,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Skeleton,
} from '@mashora/design-system'
import { PageHeader } from '@/components/shared'
import { DollarSign } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

interface VehicleCost {
  id: number
  vehicle_id: [number, string] | false
  cost_subtype_id: [number, string] | false
  amount: number
  date: string | false
  description: string | false
  create_date: string
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
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

export default function FleetCosts() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const vehicleId = parseInt(id || '0')

  const { data: vehicleData } = useQuery({
    queryKey: ['fleet-vehicle-name', vehicleId],
    queryFn: () =>
      erpClient.raw.get(`/fleet/vehicles/${vehicleId}`).then(r => r.data as { name: string }),
    enabled: vehicleId > 0,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['fleet-costs', vehicleId],
    queryFn: () =>
      erpClient.raw
        .get(`/fleet/vehicles/${vehicleId}/costs`)
        .then(r => r.data as { records: VehicleCost[]; total: number }),
    enabled: vehicleId > 0,
  })

  const records = data?.records ?? []

  const totalAmount = records.reduce((sum, r) => sum + (r.amount || 0), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehicle Costs"
        subtitle={vehicleData?.name ?? `Vehicle #${vehicleId}`}
        backTo={`/admin/fleet/${vehicleId}`}
      />

      {/* Summary strip */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6 flex items-center gap-4">
        <div className="rounded-xl bg-primary/10 p-3">
          <DollarSign className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Total Costs</p>
          <p className="text-2xl font-bold">
            ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="ml-auto">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Records</p>
          <p className="text-2xl font-bold">{data?.total ?? '—'}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-border/60 bg-card shadow-panel overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/70 bg-muted/20 hover:bg-muted/20">
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Description</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Amount</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Date</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Cost Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton cols={4} />
            ) : records.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
                      <DollarSign className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">No costs recorded for this vehicle.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              records.map(row => (
                <TableRow key={row.id} className="border-border/40 hover:bg-muted/50 transition-colors">
                  <TableCell className="text-sm">
                    {row.description || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono font-medium text-sm">
                      ${(row.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.date || '—'}
                  </TableCell>
                  <TableCell>
                    {row.cost_subtype_id
                      ? <Badge variant="outline">{row.cost_subtype_id[1]}</Badge>
                      : <span className="text-muted-foreground text-sm">—</span>}
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
