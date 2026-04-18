import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input, Badge, Skeleton } from '@mashora/design-system'
import { PageHeader, EmptyState } from '@/components/shared'
import { Search, Package, MapPin, User, Calendar } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

interface Equipment {
  id: number
  name: string
  category_id: [number, string] | false
  technician_user_id: [number, string] | false
  owner_user_id: [number, string] | false
  equipment_assign_to: string
  location: string | false
  period: number | false
  next_action_date: string | false
}

const FIELDS = [
  'id', 'name', 'category_id', 'technician_user_id', 'owner_user_id',
  'equipment_assign_to', 'location', 'period', 'next_action_date',
]

function EquipmentCard({ eq }: { eq: Equipment }) {
  const isOverdue = eq.next_action_date
    ? new Date(eq.next_action_date) < new Date()
    : false

  return (
    <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4 hover:border-border/60 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="rounded-xl bg-primary/10 p-2 shrink-0">
            <Package className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{eq.name}</p>
            {eq.equipment_assign_to && (
              <p className="text-xs text-muted-foreground capitalize">{eq.equipment_assign_to}</p>
            )}
          </div>
        </div>
        {eq.category_id && (
          <Badge variant="secondary" className="shrink-0 text-xs">
            {eq.category_id[1]}
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        {eq.technician_user_id && (
          <div className="flex items-center gap-2 text-sm">
            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground text-xs">Technician:</span>
            <span className="text-xs font-medium truncate">{eq.technician_user_id[1]}</span>
          </div>
        )}
        {eq.location && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground text-xs">Location:</span>
            <span className="text-xs font-medium truncate">{eq.location}</span>
          </div>
        )}
        {eq.next_action_date && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground text-xs">Next Maintenance:</span>
            <span className={`text-xs font-medium ${isOverdue ? 'text-destructive' : ''}`}>
              {eq.next_action_date}
            </span>
            {isOverdue && (
              <Badge variant="destructive" className="text-xs px-1.5 py-0">Overdue</Badge>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-xl" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  )
}

export default function EquipmentList() {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['maintenance-equipment', search],
    queryFn: () =>
      erpClient.raw
        .post('/model/maintenance.equipment', {
          fields: FIELDS,
          domain: search ? [['name', 'ilike', search]] : [],
          limit: 80,
          order: 'name asc',
        })
        .then(r => r.data),
  })

  const records: Equipment[] = data?.records ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipment"
        subtitle={`${data?.total ?? '—'} items`}
      />

      <div className="rounded-3xl border border-border/60 bg-card shadow-panel p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search equipment..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rounded-2xl pl-9 border-border/60 bg-muted/30 focus:bg-background"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : records.length === 0 ? (
        <EmptyState
          icon={<Package className="h-12 w-12" />}
          title="No equipment yet"
          description="Register equipment to track maintenance and assignments."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {records.map(eq => <EquipmentCard key={eq.id} eq={eq} />)}
        </div>
      )}
    </div>
  )
}
