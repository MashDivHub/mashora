import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { PageHeader, Badge, Separator, Skeleton } from '@mashora/design-system'
import {
  Users, UserPlus, Clock, Calendar, Building2, ArrowRight,
  UserCheck, ClipboardList,
} from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HrDashboardData {
  employees: {
    total?: number
    newly_hired?: number
    present_today?: number
  }
  departments: Array<{ id: number; name: string; total_employee: number }>
  pending_leaves?: number
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ElementType
  description: string
  accent?: 'default' | 'success' | 'warning'
}

function StatCard({ title, value, icon: Icon, description, accent = 'default' }: StatCardProps) {
  const iconHover = {
    default:
      'group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:border-zinc-700 dark:group-hover:bg-zinc-800 dark:group-hover:text-zinc-50',
    success:
      'group-hover:bg-emerald-950 group-hover:text-emerald-300 group-hover:border-emerald-800 dark:group-hover:bg-emerald-950 dark:group-hover:border-emerald-800 dark:group-hover:text-emerald-300',
    warning:
      'group-hover:bg-amber-950 group-hover:text-amber-300 group-hover:border-amber-800 dark:group-hover:bg-amber-950 dark:group-hover:border-amber-800 dark:group-hover:text-amber-300',
  }

  return (
    <div className="group overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_80px_-40px_rgba(15,23,42,0.55)]">
      <div className="mb-5 flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            {title}
          </p>
          <div className="text-3xl font-semibold tracking-tight">{value}</div>
        </div>
        <div
          className={`rounded-2xl border border-border/70 bg-muted/60 p-3 text-muted-foreground transition-all duration-200 ${iconHover[accent]}`}
        >
          <Icon className="size-5" />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

// ─── Quick Action Button ──────────────────────────────────────────────────────

interface QuickActionProps {
  label: string
  description: string
  icon: React.ElementType
  onClick: () => void
}

function QuickActionItem({ label, description, icon: Icon, onClick }: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-2xl border border-border/70 bg-card/85 p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-zinc-900/20 hover:shadow-xl dark:hover:border-zinc-100/20"
    >
      <div className="shrink-0 rounded-xl border border-border/70 bg-muted/60 p-2.5 text-muted-foreground transition-colors group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:border-zinc-700 dark:group-hover:bg-zinc-800 dark:group-hover:text-zinc-50">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HrDashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery<HrDashboardData>({
    queryKey: ['hr-dashboard'],
    queryFn: () => erpClient.raw.get('/hr/dashboard').then((r) => r.data),
  })

  const employees = data?.employees ?? {}
  const departments: HrDashboardData['departments'] = data?.departments ?? []

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Operations"
        title="Human Resources"
        description="Workforce overview, attendance, and leave management."
      />

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Employees"
          value={isLoading ? '—' : (employees.total ?? 0)}
          icon={Users}
          description="Active workforce headcount"
        />
        <StatCard
          title="Newly Hired"
          value={isLoading ? '—' : (employees.newly_hired ?? 0)}
          icon={UserPlus}
          description="Joined this month"
          accent="success"
        />
        <StatCard
          title="Present Today"
          value={isLoading ? '—' : (employees.present_today ?? 0)}
          icon={Clock}
          description="Currently checked in"
          accent="success"
        />
        <StatCard
          title="Pending Leaves"
          value={isLoading ? '—' : (data?.pending_leaves ?? 0)}
          icon={Calendar}
          description="Awaiting manager approval"
          accent="warning"
        />
      </div>

      {/* Departments + Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2">

        {/* Departments */}
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)]">
          <div className="flex items-center gap-2 border-b border-border/70 bg-muted/20 px-6 py-4">
            <Building2 className="size-4 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              Departments
            </p>
          </div>
          <div className="p-6">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </div>
            ) : departments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No departments found.</p>
            ) : (
              <div className="space-y-0">
                {departments.slice(0, 10).map((dept, idx, arr) => (
                  <div
                    key={dept.id}
                    className={`flex items-center justify-between py-3 text-sm ${
                      idx < arr.length - 1 ? 'border-b border-border/50' : ''
                    }`}
                  >
                    <span className="text-foreground">{dept.name}</span>
                    <Badge variant="secondary" className="tabular-nums">
                      {dept.total_employee}
                    </Badge>
                  </div>
                ))}
                {departments.length > 10 && (
                  <p className="pt-3 text-xs text-muted-foreground">
                    …and {departments.length - 10} more departments
                  </p>
                )}
              </div>
            )}
            <Separator className="my-4 opacity-50" />
            <button
              onClick={() => navigate('/hr/employees')}
              className="group flex w-full items-center justify-between rounded-2xl border border-border/70 bg-muted/40 px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 hover:bg-muted/70 hover:shadow-md"
            >
              View All Employees
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)]">
          <div className="border-b border-border/70 bg-muted/20 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              Quick Actions
            </p>
          </div>
          <div className="space-y-2 p-4">
            <QuickActionItem
              icon={Users}
              label="Employee Directory"
              description="Browse and manage all active employees."
              onClick={() => navigate('/hr/employees')}
            />
            <QuickActionItem
              icon={Calendar}
              label="Leave Requests"
              description="Review, approve, or refuse time-off requests."
              onClick={() => navigate('/hr/leaves')}
            />
            <QuickActionItem
              icon={Clock}
              label="Attendance"
              description="Track daily check-ins and working hours."
              onClick={() => navigate('/hr/attendance')}
            />
            <QuickActionItem
              icon={UserCheck}
              label="Recruitment"
              description="Open positions and applicant pipeline."
              onClick={() => navigate('/hr/recruitment')}
            />
            <QuickActionItem
              icon={ClipboardList}
              label="Payroll"
              description="Salary structures and payslip generation."
              onClick={() => navigate('/hr/payroll')}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
