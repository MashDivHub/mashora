import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Avatar, AvatarFallback, AvatarImage, Card, CardContent, Badge, Skeleton, cn } from '@mashora/design-system'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Users, Building2, Briefcase, GitBranch,
  Clock, CalendarDays, CalendarCheck, CalendarPlus,
  Receipt, FileText, Star, Home, Cake, UserPlus, UserMinus, Activity,
  FileSignature, Layers, Search,
} from 'lucide-react'
import { PageHeader, StatCards, type StatCardData } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface Employee {
  id: number
  name: string
  birthday?: string | false
  image_128?: string | false
  job_title?: string | false
  department_id?: [number, string] | false
}

interface Department {
  id: number
  name: string
  member_ids?: number[]
}

function daysUntilBirthday(birthday: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [_, mStr, dStr] = birthday.split('-')
  const m = Number(mStr) - 1
  const d = Number(dStr)
  const next = new Date(today.getFullYear(), m, d)
  if (next < today) next.setFullYear(today.getFullYear() + 1)
  return Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export default function HrDashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['hr-dashboard'],
    queryFn: async () => {
      const res = await erpClient.raw.get('/hr/dashboard').then(r => r.data).catch(() => null)
      if (res) return res

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

  // Birthdays in next 7 days
  const { data: birthdays, isLoading: birthdaysLoading } = useQuery({
    queryKey: ['hr-dashboard', 'birthdays'],
    queryFn: async (): Promise<Array<Employee & { _days: number }>> => {
      try {
        const { data } = await erpClient.raw.post('/model/hr.employee', {
          domain: [['active', '=', true], ['birthday', '!=', false]],
          fields: ['id', 'name', 'birthday', 'image_128', 'job_title'],
          limit: 200,
        })
        const list: Employee[] = data?.records || []
        type WithDays = Employee & { _days: number }
        return list
          .filter((e): e is Employee & { birthday: string } => typeof e.birthday === 'string')
          .map((e): WithDays => ({ ...e, _days: daysUntilBirthday(e.birthday) }))
          .filter(e => e._days <= 7)
          .sort((a, b) => a._days - b._days)
      } catch {
        return []
      }
    },
    staleTime: 5 * 60_000,
  })

  // KPIs - on leave today + recent hires
  const { data: kpis } = useQuery({
    queryKey: ['hr-dashboard', 'kpis'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]
      const monthStart = new Date()
      monthStart.setDate(1)
      const monthStr = monthStart.toISOString().split('T')[0]

      const [active, onLeave, recentHires] = await Promise.all([
        erpClient.raw.post('/model/hr.employee', {
          domain: [['active', '=', true]], fields: ['id'], limit: 1,
        }).then(r => r.data).catch(() => ({ total: 0 })),
        erpClient.raw.post('/model/hr.leave', {
          domain: [
            ['state', '=', 'validate'],
            ['date_from', '<=', today],
            ['date_to', '>=', today],
          ],
          fields: ['id'], limit: 1,
        }).then(r => r.data).catch(() => ({ total: 0 })),
        erpClient.raw.post('/model/hr.employee', {
          domain: [['active', '=', true], ['create_date', '>=', monthStr]],
          fields: ['id'], limit: 1,
        }).then(r => r.data).catch(() => ({ total: 0 })),
      ])
      return {
        active: active.total || 0,
        on_leave: onLeave.total || 0,
        recent_hires: recentHires.total || 0,
      }
    },
    staleTime: 60_000,
  })

  // Department headcount
  const { data: depts, isLoading: deptsLoading } = useQuery({
    queryKey: ['hr-dashboard', 'departments-headcount'],
    queryFn: async (): Promise<Department[]> => {
      try {
        const { data } = await erpClient.raw.post('/model/hr.department', {
          domain: [],
          fields: ['id', 'name', 'member_ids'],
          limit: 50,
        })
        return data?.records || []
      } catch {
        return []
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
          {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  const emp = data?.employees ?? {}
  const deptCount = Array.isArray(data?.departments)
    ? data.departments.length
    : (typeof data?.departments === 'number' ? data.departments : 0)

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

  // Top KPIs row
  const topKpis: StatCardData[] = [
    {
      label: 'Active Employees',
      value: kpis?.active ?? 0,
      icon: <UserPlus className="h-5 w-5" />,
      color: 'info',
      onClick: () => navigate('/admin/hr/employees?filter=active'),
    },
    {
      label: 'On Leave Today',
      value: kpis?.on_leave ?? 0,
      sub: (kpis?.on_leave ?? 0) > 0 ? 'currently away' : '—',
      icon: <UserMinus className="h-5 w-5" />,
      color: (kpis?.on_leave ?? 0) > 0 ? 'warning' : 'default',
      onClick: () => navigate('/admin/hr/leaves?filter=today'),
    },
    {
      label: 'Recent Hires',
      value: kpis?.recent_hires ?? 0,
      sub: 'this month',
      icon: <Activity className="h-5 w-5" />,
      color: 'success',
      onClick: () => navigate('/admin/hr/employees?filter=recent'),
    },
  ]

  // Department chart data
  const deptChart = (depts || [])
    .map(d => ({ name: d.name, headcount: Array.isArray(d.member_ids) ? d.member_ids.length : 0 }))
    .filter(d => d.headcount > 0)
    .sort((a, b) => b.headcount - a.headcount)
    .slice(0, 10)

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
      title: 'Payroll & Recruitment',
      actions: [
        { label: 'Contracts', desc: 'Employee contracts & terms', icon: <FileSignature className="h-5 w-5" />, path: '/admin/hr/contracts' },
        { label: 'Payslip Batches', desc: 'Period-based payslip runs', icon: <Layers className="h-5 w-5" />, path: '/admin/hr/payslip-batches' },
        { label: 'Payslips', desc: 'Individual employee payslips', icon: <FileText className="h-5 w-5" />, path: '/admin/hr/payslips' },
        { label: 'Recruitment', desc: 'Applicant pipeline (kanban)', icon: <Search className="h-5 w-5" />, path: '/admin/hr/recruitment' },
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
      <PageHeader title="Human Resources" subtitle="Today's overview" onNew="/admin/hr/employees/new" newLabel="New Employee" />

      <StatCards stats={stats} columns={4} />

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">
          Top KPIs
        </p>
        <StatCards stats={topKpis} columns={3} />
      </div>

      {/* Birthdays + Dept chart side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Birthday widget */}
        <Card className="rounded-2xl hover:shadow-md transition-shadow">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cake className="h-4 w-4 text-pink-500" />
                <h3 className="text-sm font-semibold">Upcoming Birthdays</h3>
              </div>
              <span className="text-xs text-muted-foreground">next 7 days</span>
            </div>
            {birthdaysLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-xl" />
                ))}
              </div>
            ) : (birthdays?.length || 0) === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                No birthdays this week —
              </div>
            ) : (
              <div className="space-y-2">
                {birthdays!.slice(0, 6).map((e) => (
                  <button
                    key={e.id}
                    onClick={() => navigate(`/admin/hr/employees/${e.id}`)}
                    className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-muted/30 transition-colors text-left"
                  >
                    <Avatar className="h-9 w-9">
                      {e.image_128 && (
                        <AvatarImage src={`data:image/png;base64,${e.image_128}`} alt={e.name} />
                      )}
                      <AvatarFallback className="text-xs bg-pink-500/10 text-pink-600">
                        {e.name?.split(' ').map((s: string) => s[0]).slice(0, 2).join('') || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{e.name}</p>
                      {e.job_title && (
                        <p className="text-[11px] text-muted-foreground truncate">{e.job_title}</p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] shrink-0',
                        e._days === 0 && 'bg-pink-500/10 border-pink-500/30 text-pink-600',
                      )}
                    >
                      {e._days === 0 ? 'Today' : e._days === 1 ? 'Tomorrow' : `in ${e._days}d`}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Department headcount chart */}
        <Card className="rounded-2xl hover:shadow-md transition-shadow lg:col-span-2">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Headcount by Department</h3>
              </div>
              <span className="text-xs text-muted-foreground">top 10</span>
            </div>
            {deptsLoading ? (
              <Skeleton className="h-64 rounded-xl" />
            ) : deptChart.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                No department data —
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, deptChart.length * 32)}>
                <BarChart data={deptChart} layout="vertical" margin={{ left: 12, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="headcount" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

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
