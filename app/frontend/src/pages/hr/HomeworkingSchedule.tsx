import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared'
import { Badge } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { Building2, Home, MapPin } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type WorkLocationType = 'office' | 'home' | 'other'

interface EmployeeRecord {
  id: number
  name: string
  work_location_id: [number, string] | false
  work_location_type: WorkLocationType | false
  department_id: [number, string] | false
}

// ─── Group config ─────────────────────────────────────────────────────────────

const GROUP_CONFIG: Record<WorkLocationType, { label: string; icon: React.ReactNode; badgeVariant: 'secondary' | 'info' | 'success' }> = {
  office: { label: 'Office',    icon: <Building2 className="h-4 w-4" />, badgeVariant: 'info'      },
  home:   { label: 'Remote',    icon: <Home      className="h-4 w-4" />, badgeVariant: 'success'   },
  other:  { label: 'Other',     icon: <MapPin    className="h-4 w-4" />, badgeVariant: 'secondary' },
}

const GROUP_ORDER: WorkLocationType[] = ['office', 'home', 'other']

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomeworkingSchedule() {
  const { data, isLoading } = useQuery({
    queryKey: ['homeworking-schedule'],
    queryFn: () =>
      erpClient.raw
        .post('/model/hr.employee', {
          fields: ['id', 'name', 'work_location_id', 'work_location_type', 'department_id'],
          order: 'name asc',
          limit: 200,
        })
        .then(r => r.data),
  })

  const employees: EmployeeRecord[] = data?.records ?? []

  // Group employees by work_location_type
  const groups = new Map<WorkLocationType, EmployeeRecord[]>()
  for (const emp of employees) {
    const key: WorkLocationType = (emp.work_location_type as WorkLocationType) || 'other'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(emp)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Homeworking Schedule"
        subtitle={isLoading ? undefined : `${employees.length} employee${employees.length !== 1 ? 's' : ''}`}
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/30 bg-card/50 p-5 animate-pulse h-48" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {GROUP_ORDER.map(type => {
            const cfg = GROUP_CONFIG[type]
            const members = groups.get(type) ?? []
            return (
              <div
                key={type}
                className="rounded-2xl border border-border/30 bg-card/50 p-5 flex flex-col gap-4"
              >
                {/* Group header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-foreground font-semibold">
                    {cfg.icon}
                    <span>{cfg.label}</span>
                  </div>
                  <Badge variant={cfg.badgeVariant}>{members.length}</Badge>
                </div>

                {/* Employee list */}
                {members.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">No employees</p>
                ) : (
                  <ul className="space-y-2">
                    {members.map(emp => (
                      <li
                        key={emp.id}
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/30 transition-colors"
                      >
                        <span className="text-sm text-foreground truncate">{emp.name}</span>
                        {emp.department_id && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {emp.department_id[1]}
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Work location breakdown */}
                {members.length > 0 && (
                  <div className="text-xs text-muted-foreground border-t border-border/30 pt-3">
                    {Array.from(
                      members.reduce((acc, emp) => {
                        const loc = emp.work_location_id ? emp.work_location_id[1] : 'Unknown'
                        acc.set(loc, (acc.get(loc) ?? 0) + 1)
                        return acc
                      }, new Map<string, number>())
                    ).map(([loc, count]) => (
                      <div key={loc} className="flex justify-between">
                        <span>{loc}</span>
                        <span className="font-medium text-foreground">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
