import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import { Users, Building2, UserPlus, Briefcase } from 'lucide-react'
import { PageHeader, StatCards, type StatCardData } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

export default function HrDashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['hr-dashboard'],
    queryFn: async () => {
      const [employees, departments] = await Promise.all([
        erpClient.raw.post('/model/hr.employee', { domain: [['active', '=', true]], fields: ['id'], limit: 1 }).then(r => r.data),
        erpClient.raw.post('/model/hr.department', { fields: ['id'], limit: 1 }).then(r => r.data),
      ])
      return { employees: employees.total || 0, departments: departments.total || 0 }
    },
    staleTime: 60_000,
  })

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-48 rounded-xl" /><div className="grid grid-cols-2 md:grid-cols-3 gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div></div>
  }

  const stats: StatCardData[] = [
    { label: 'Employees', value: data?.employees || 0, sub: 'active', icon: <Users className="h-5 w-5" />, color: 'info', onClick: () => navigate('/hr/employees') },
    { label: 'Departments', value: data?.departments || 0, icon: <Building2 className="h-5 w-5" />, color: 'success', onClick: () => navigate('/hr/departments') },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Employees" subtitle="overview" />
      <StatCards stats={stats} columns={2} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { label: 'All Employees', desc: 'Browse employee directory', icon: <Users className="h-5 w-5" />, path: '/hr/employees' },
          { label: 'New Employee', desc: 'Add a new team member', icon: <UserPlus className="h-5 w-5" />, path: '/hr/employees/new' },
          { label: 'Departments', desc: 'Organization structure', icon: <Building2 className="h-5 w-5" />, path: '/hr/departments' },
        ].map(item => (
          <button key={item.path} onClick={() => navigate(item.path)}
            className="rounded-2xl border border-border/50 bg-card p-5 text-left transition-all hover:bg-muted/20 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">{item.icon}</div>
              <div><p className="text-sm font-semibold">{item.label}</p><p className="text-xs text-muted-foreground">{item.desc}</p></div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
