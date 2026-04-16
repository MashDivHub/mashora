import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import {
  Users, Building2, Briefcase, GitBranch,
  Clock, CalendarDays, CalendarCheck, CalendarPlus,
  Receipt, FileText, Star, Home,
} from 'lucide-react'
import { PageHeader, StatCards, type StatCardData } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

export default function HrDashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['hr-dashboard'],
    queryFn: async () => {
      const res = await erpClient.raw.get('/hr/dashboard').then(r => r.data).catch(() => null)
      if (res) return res

      // Fallback: derive from models
      const [employees, departments, leaves] = await Promise.all([
        erpClient.raw.post('/model/hr.employee', { domain: [['active', '=', true]], fields: ['id'], limit: 1 }).then(r => r.data).catch(() => ({ total: 0 })),
        erpClient.raw.post('/model/hr.department', { fields: ['id'], limit: 1 }).then(r => r.data).catch(() => ({ total: 0 })),
        erpClient.raw.post('/model/hr.leave', { domain: [['state', '=', 'confirm']], fields: ['id'], limit: 1 }).then(r => r.data).catch(() => ({ total: 0 })),
      ])
      return {
        total_employees: employees.total || 0,
        present_today: 0,
        pending_leaves: leaves.total || 0,
        departments: departments.total || 0,
      }
    },
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 13 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  // API returns: { employees: { total, newly_hired, present_today }, departments: [...], pending_leaves }
  const emp = data?.employees ?? {}
  const deptCount = Array.isArray(data?.departments) ? data.departments.length : (typeof data?.departments === 'number' ? data.departments : 0)

  const stats: StatCardData[] = [
    {
      label: 'Total Employees',
      value: emp.total ?? data?.total_employees ?? 0,
      icon: <Users className="h-5 w-5" />,
      color: 'info',
      onClick: () => navigate('/admin/hr/employees'),
    },
    {
      label: 'Present Today',
      value: emp.present_today ?? data?.present_today ?? 0,
      icon: <Clock className="h-5 w-5" />,
      color: 'success',
      onClick: () => navigate('/admin/hr/attendance'),
    },
    {
      label: 'Pending Leaves',
      value: data?.pending_leaves ?? 0,
      icon: <CalendarDays className="h-5 w-5" />,
      color: 'warning',
      onClick: () => navigate('/admin/hr/leaves'),
    },
    {
      label: 'Departments',
      value: deptCount,
      icon: <Building2 className="h-5 w-5" />,
      color: 'default',
      onClick: () => navigate('/admin/hr/departments'),
    },
  ]

  const sections = [
    {
      title: 'People',
      actions: [
        { label: 'Employees', desc: 'Browse employee directory', icon: <Users className="h-5 w-5" />, path: '/admin/hr/employees' },
        { label: 'Departments', desc: 'Organization structure', icon: <Building2 className="h-5 w-5" />, path: '/admin/hr/departments' },
        { label: 'Job Positions', desc: 'Manage roles & positions', icon: <Briefcase className="h-5 w-5" />, path: '/admin/hr/jobs' },
        { label: 'Organization Chart', desc: 'Visual org hierarchy', icon: <GitBranch className="h-5 w-5" />, path: '/admin/hr/org-chart' },
      ],
    },
    {
      title: 'Time & Attendance',
      actions: [
        { label: 'Attendance', desc: 'Track check-ins & hours', icon: <Clock className="h-5 w-5" />, path: '/admin/hr/attendance' },
        { label: 'Leave Requests', desc: 'Review pending leaves', icon: <CalendarDays className="h-5 w-5" />, path: '/admin/hr/leaves' },
        { label: 'Leave Types', desc: 'Configure leave policies', icon: <CalendarCheck className="h-5 w-5" />, path: '/admin/hr/leave-types' },
        { label: 'Allocations', desc: 'Manage leave allocations', icon: <CalendarPlus className="h-5 w-5" />, path: '/admin/hr/allocations' },
      ],
    },
    {
      title: 'Finance & Skills',
      actions: [
        { label: 'Expenses', desc: 'Submit & review expenses', icon: <Receipt className="h-5 w-5" />, path: '/admin/hr/expenses' },
        { label: 'Expense Reports', desc: 'View expense sheets', icon: <FileText className="h-5 w-5" />, path: '/admin/hr/expense-sheets' },
        { label: 'Skills Matrix', desc: 'Employee skills & levels', icon: <Star className="h-5 w-5" />, path: '/admin/hr/skills' },
        { label: 'Work Entries', desc: 'Payroll work records', icon: <Clock className="h-5 w-5" />, path: '/admin/hr/work-entries' },
      ],
    },
    {
      title: 'Other',
      actions: [
        { label: 'Homeworking', desc: 'Remote work schedules', icon: <Home className="h-5 w-5" />, path: '/admin/hr/homeworking' },
      ],
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Human Resources" subtitle="overview" />
      <StatCards stats={stats} columns={4} />

      <div className="space-y-5">
        {sections.map(section => (
          <div key={section.title}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">
              {section.title}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {section.actions.map(item => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="rounded-2xl border border-border/50 bg-card p-5 text-left transition-all hover:bg-muted/20 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-primary/10 p-2.5 text-primary">{item.icon}</div>
                    <div>
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
