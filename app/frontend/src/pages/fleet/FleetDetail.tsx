import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button, Skeleton } from '@mashora/design-system'
import { PageHeader } from '@/components/shared'
import { ArrowLeft, Car, DollarSign, Gauge, Users, FileText } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

interface VehicleDetail {
  id: number
  name: string
  license_plate: string
  model_id: [number, string] | false
  driver_id: [number, string] | false
  state_id: [number, string] | false
  fuel_type: string | false
  color: string | false
  horsepower: number | false
  odometer: number | false
  company_id: [number, string] | false
  acquisition_date: string | false
  seats: number | false
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value ?? '—'}</span>
    </div>
  )
}

export default function FleetDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const vehicleId = parseInt(id || '0')

  const { data: vehicle, isLoading } = useQuery({
    queryKey: ['fleet-vehicle', vehicleId],
    queryFn: () =>
      erpClient.raw.get(`/fleet/vehicles/${vehicleId}`).then(r => r.data as VehicleDetail),
    enabled: vehicleId > 0,
  })

  // Counts for smart buttons
  const { data: counts } = useQuery({
    queryKey: ['fleet-vehicle-counts', vehicleId],
    enabled: vehicleId > 0,
    queryFn: async () => {
      const dom = [['vehicle_id', '=', vehicleId]]
      const [odo, asg, ctr] = await Promise.all([
        erpClient.raw.post('/model/fleet.vehicle.odometer', { domain: dom, fields: ['id'], limit: 1 }).then(r => r.data?.total ?? 0).catch(() => 0),
        erpClient.raw.post('/model/fleet.vehicle.assignation.log', { domain: dom, fields: ['id'], limit: 1 }).then(r => r.data?.total ?? 0).catch(() => 0),
        erpClient.raw.post('/model/fleet.vehicle.log.contract', { domain: dom, fields: ['id'], limit: 1 }).then(r => r.data?.total ?? 0).catch(() => 0),
      ])
      return { odometer: odo, assignation: asg, contract: ctr }
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  if (!vehicle) {
    return (
      <div className="flex flex-col items-center gap-4 py-24">
        <Car className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">Vehicle not found.</p>
        <Button variant="outline" className="rounded-xl" onClick={() => navigate('/admin/fleet')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Fleet
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={vehicle.name}
        subtitle={vehicle.license_plate || undefined}
        backTo="/admin/fleet"
      />

      {/* Smart Buttons */}
      <div className="flex flex-wrap gap-2.5">
        <button
          onClick={() => navigate(`/admin/fleet/odometer?vehicle=${vehicleId}`)}
          className="flex items-center gap-3 rounded-2xl border border-border/40 bg-gradient-to-b from-card to-card/80 px-5 py-3 cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30 transition-all text-left min-w-[140px]"
        >
          <div className="rounded-xl bg-primary/8 p-2 text-muted-foreground"><Gauge className="h-5 w-5" /></div>
          <div>
            <div className="text-lg font-bold leading-tight tabular-nums">{counts?.odometer ?? 0}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium">Odometer Logs</div>
          </div>
        </button>
        <button
          onClick={() => navigate(`/admin/fleet/assignations?vehicle=${vehicleId}`)}
          className="flex items-center gap-3 rounded-2xl border border-border/40 bg-gradient-to-b from-card to-card/80 px-5 py-3 cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30 transition-all text-left min-w-[140px]"
        >
          <div className="rounded-xl bg-primary/8 p-2 text-muted-foreground"><Users className="h-5 w-5" /></div>
          <div>
            <div className="text-lg font-bold leading-tight tabular-nums">{counts?.assignation ?? 0}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium">Assignment History</div>
          </div>
        </button>
        <button
          onClick={() => navigate(`/admin/fleet/contracts?vehicle=${vehicleId}`)}
          className="flex items-center gap-3 rounded-2xl border border-border/40 bg-gradient-to-b from-card to-card/80 px-5 py-3 cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30 transition-all text-left min-w-[140px]"
        >
          <div className="rounded-xl bg-primary/8 p-2 text-muted-foreground"><FileText className="h-5 w-5" /></div>
          <div>
            <div className="text-lg font-bold leading-tight tabular-nums">{counts?.contract ?? 0}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium">Contracts</div>
          </div>
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Info card */}
        <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-1">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Vehicle Information
          </h3>
          <InfoRow
            label="Model"
            value={vehicle.model_id ? vehicle.model_id[1] : undefined}
          />
          <InfoRow label="License Plate" value={vehicle.license_plate || undefined} />
          <InfoRow
            label="Driver"
            value={vehicle.driver_id ? vehicle.driver_id[1] : undefined}
          />
          <InfoRow
            label="State"
            value={
              vehicle.state_id ? (
                <Badge variant="secondary">{vehicle.state_id[1]}</Badge>
              ) : undefined
            }
          />
          <InfoRow
            label="Mileage"
            value={
              vehicle.odometer
                ? `${(vehicle.odometer as number).toLocaleString()} km`
                : undefined
            }
          />
          <InfoRow
            label="Fuel Type"
            value={
              vehicle.fuel_type ? (
                <Badge variant="outline" className="capitalize">
                  {vehicle.fuel_type as string}
                </Badge>
              ) : undefined
            }
          />
          <InfoRow label="Color" value={vehicle.color || undefined} />
          <InfoRow label="Seats" value={vehicle.seats || undefined} />
          <InfoRow label="Horsepower" value={vehicle.horsepower ? `${vehicle.horsepower} hp` : undefined} />
          <InfoRow
            label="Company"
            value={vehicle.company_id ? vehicle.company_id[1] : undefined}
          />
          <InfoRow label="Acquisition Date" value={vehicle.acquisition_date || undefined} />
        </div>

        {/* Costs shortcut */}
        <div className="rounded-2xl border border-border/30 bg-card/50 p-6 flex flex-col gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Costs
          </h3>
          <p className="text-sm text-muted-foreground">
            View all logged costs and expenses for this vehicle.
          </p>
          <Button
            variant="outline"
            className="rounded-xl gap-2 w-fit"
            onClick={() => navigate(`/admin/fleet/${vehicleId}/costs`)}
          >
            <DollarSign className="h-4 w-4" />
            View Vehicle Costs
          </Button>
        </div>
      </div>
    </div>
  )
}
