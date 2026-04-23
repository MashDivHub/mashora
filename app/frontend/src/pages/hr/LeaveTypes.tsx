import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { PageHeader, EmptyState } from '@/components/shared'
import { Badge } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { Calendar } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeaveTypeRecord {
  id: number
  name: string
  color: number
  sequence: number
  requires_allocation: 'yes' | 'no'
  leave_validation_type: string
  request_unit: string
  max_leaves: number
  leaves_taken: number
  virtual_remaining_leaves: number
}

// ─── Color mapping ────────────────────────────────────────────────────────────

const COLOR_MAP: Record<number, string> = {
  0:  'bg-gray-400',
  1:  'bg-red-500',
  2:  'bg-orange-500',
  3:  'bg-amber-500',
  4:  'bg-yellow-400',
  5:  'bg-lime-500',
  6:  'bg-green-500',
  7:  'bg-teal-500',
  8:  'bg-cyan-500',
  9:  'bg-blue-500',
  10: 'bg-violet-500',
}

function colorClass(n: number): string {
  return COLOR_MAP[n] ?? COLOR_MAP[0]
}

// ─── Validation label ─────────────────────────────────────────────────────────

type BadgeVariant = 'secondary' | 'warning' | 'info' | 'success' | 'destructive'

const VALIDATION_LABELS: Record<string, { label: string; variant: BadgeVariant }> = {
  no_validation:  { label: 'No Validation',    variant: 'secondary' },
  time_off:       { label: 'Time Off Officer',  variant: 'info'      },
  both:           { label: 'Two Approvals',     variant: 'warning'   },
  manager:        { label: 'Manager Approval',  variant: 'success'   },
}

function validationCfg(type: string) {
  return VALIDATION_LABELS[type] ?? { label: type, variant: 'secondary' as BadgeVariant }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeaveTypes() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['leave-types'],
    queryFn: () => erpClient.raw.post('/hr/leave-types', {}).then(r => r.data),
  })

  const records: LeaveTypeRecord[] = data?.records ?? []
  const total: number = data?.total ?? 0
  const handleCreate = () => navigate('/admin/model/hr.leave.type/new')

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Leave Types" onNew={handleCreate} newLabel="New Leave Type" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/30 bg-card/50 p-5 animate-pulse h-36" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Leave Types"
        subtitle={`${total} type${total !== 1 ? 's' : ''}`}
        onNew={handleCreate}
        newLabel="New Leave Type"
      />

      {records.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-12 w-12" />}
          title="No leave types yet"
          description="Configure leave types before employees can request time off."
          actionLabel="New Leave Type"
          onAction={handleCreate}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {records.map(lt => {
            const vcfg = validationCfg(lt.leave_validation_type)
            const remaining = lt.virtual_remaining_leaves
            return (
              <button
                key={lt.id}
                type="button"
                onClick={() => navigate(`/admin/model/hr.leave.type/${lt.id}`)}
                className="w-full text-left rounded-2xl border border-border/30 bg-card/50 p-5 flex flex-col gap-4 transition-colors hover:border-border/60 hover:bg-card/70 focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {/* Header */}
                <div className="flex items-center gap-3">
                  <span
                    className={`h-3 w-3 rounded-full shrink-0 ${colorClass(lt.color)}`}
                    aria-hidden
                  />
                  <span className="font-semibold text-foreground leading-tight">
                    {lt.name}
                  </span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted/40 px-2 py-2">
                    <p className="text-xs text-muted-foreground mb-0.5">Max Days</p>
                    <p className="text-lg font-semibold text-foreground">
                      {lt.max_leaves > 0 ? lt.max_leaves : '∞'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/40 px-2 py-2">
                    <p className="text-xs text-muted-foreground mb-0.5">Taken</p>
                    <p className="text-lg font-semibold text-foreground">
                      {lt.leaves_taken}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/40 px-2 py-2">
                    <p className="text-xs text-muted-foreground mb-0.5">Remaining</p>
                    <p className={`text-lg font-semibold ${remaining < 0 ? 'text-destructive' : 'text-foreground'}`}>
                      {remaining > 0 ? remaining : remaining === 0 ? '0' : remaining}
                    </p>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant={vcfg.variant}>{vcfg.label}</Badge>
                  <Badge variant={lt.requires_allocation === 'yes' ? 'warning' : 'secondary'}>
                    {lt.requires_allocation === 'yes' ? 'Allocation Required' : 'No Allocation'}
                  </Badge>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
