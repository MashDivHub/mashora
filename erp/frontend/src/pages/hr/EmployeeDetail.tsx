import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge, Separator, Button, Input, Label, CardTitle, cn } from '@mashora/design-system'
import {
  ArrowLeft, Mail, Phone, MapPin, Building2, Briefcase,
  Calendar, Shield, Circle, User, ChevronRight,
} from 'lucide-react'
import { erpClient } from '@/lib/erp-api'
import { useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

const presenceConfig: Record<string, { label: string; dot: string; badge: string }> = {
  present: {
    label: 'Present',
    dot: 'bg-emerald-500 shadow-emerald-500/40',
    badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
  },
  absent: {
    label: 'Absent',
    dot: 'bg-red-500 shadow-red-500/40',
    badge: 'bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400',
  },
  to_define: {
    label: 'Unknown',
    dot: 'bg-zinc-400',
    badge: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
  },
  out_of_working_hour: {
    label: 'Off Hours',
    dot: 'bg-zinc-400',
    badge: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
  },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)]">
      <div className="flex items-center gap-2 border-b border-border/70 bg-muted/20 px-6 py-4">
        <Icon className="size-4 text-muted-foreground" />
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
          {title}
        </p>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

function InfoRow({
  label,
  value,
  mono = false,
  last = false,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
  last?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between py-3 text-sm',
        !last && 'border-b border-border/50',
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-medium text-right', mono && 'font-mono')}>{value}</span>
    </div>
  )
}

function ContactRow({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ElementType
  value: string
  label?: string
}) {
  return (
    <div className="flex items-center gap-3 py-3 text-sm border-b border-border/50 last:border-0">
      <div className="rounded-xl border border-border/70 bg-muted/60 p-2 text-muted-foreground shrink-0">
        <Icon className="size-3.5" />
      </div>
      <span className="min-w-0 truncate">{value}</span>
      {label && (
        <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {label}
        </span>
      )}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="space-y-2">
        <div className="h-3 w-24 rounded-full bg-muted" />
        <div className="h-8 w-64 rounded-xl bg-muted" />
        <div className="h-4 w-40 rounded-full bg-muted" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-64 rounded-3xl bg-muted" />
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = id === 'new'

  const [formName, setFormName] = useState('')
  const [formJobTitle, setFormJobTitle] = useState('')
  const [formDepartment, setFormDepartment] = useState('')
  const [formEmail, setFormEmail] = useState('')

  const createMut = useMutation({
    mutationFn: (vals: Record<string, any>) =>
      erpClient.raw.post('/hr/employees/create', vals).then((r) => r.data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['employee'] })
      navigate(`/hr/employees/${result.id}`, { replace: true })
    },
  })

  const { data: emp, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => erpClient.raw.get(`/hr/employees/${id}`).then((r) => r.data),
    enabled: !isNew,
  })

  // ── Create mode ──
  if (isNew) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Human Resources</p>
          <h1 className="text-2xl font-bold tracking-tight">New Employee</h1>
        </div>
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)]">
          <div className="border-b border-border/70 bg-muted/20 px-6 py-4">
            <CardTitle>Employee Details</CardTitle>
          </div>
          <div className="p-6 space-y-4 max-w-lg">
            <div className="space-y-1.5">
              <Label htmlFor="emp-name">Name</Label>
              <Input id="emp-name" placeholder="Full name" value={formName} onChange={(e) => setFormName(e.target.value)} className="rounded-2xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-job">Job Title</Label>
              <Input id="emp-job" placeholder="Job title" value={formJobTitle} onChange={(e) => setFormJobTitle(e.target.value)} className="rounded-2xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-dept">Department</Label>
              <Input id="emp-dept" placeholder="Department name" value={formDepartment} onChange={(e) => setFormDepartment(e.target.value)} className="rounded-2xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-email">Work Email</Label>
              <Input id="emp-email" type="email" placeholder="work@company.com" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="rounded-2xl" />
            </div>
          </div>
          <div className="border-t border-border/60 bg-muted/20 px-6 py-4 flex gap-2">
            <Button
              onClick={() => createMut.mutate({ name: formName, job_title: formJobTitle || undefined, department_name: formDepartment || undefined, work_email: formEmail || undefined })}
              disabled={createMut.isPending || !formName}
              className="rounded-2xl"
            >
              {createMut.isPending ? 'Creating…' : 'Create Employee'}
            </Button>
            <Button variant="outline" className="rounded-2xl" onClick={() => navigate('/hr/employees')}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) return <DetailSkeleton />

  if (!emp) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <div className="rounded-2xl border border-border/70 bg-muted/60 p-4 text-muted-foreground">
          <User className="size-6" />
        </div>
        <p className="text-sm font-medium">Employee not found</p>
        <button
          onClick={() => navigate('/hr/employees')}
          className="text-xs text-muted-foreground underline underline-offset-4"
        >
          Back to directory
        </button>
      </div>
    )
  }

  const presence = presenceConfig[emp.hr_presence_state] ?? presenceConfig.to_define
  const jobLabel = emp.job_title || (emp.job_id ? emp.job_id[1] : 'Employee')
  const initials = (emp.name as string)
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')

  return (
    <div className="space-y-8">

      {/* Back breadcrumb */}
      <button
        onClick={() => navigate('/hr/employees')}
        className="group flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
        Employee Directory
      </button>

      {/* Profile header */}
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)]">
        <div className="border-b border-border/70 bg-muted/20 px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Employee Profile
          </p>
        </div>
        <div className="flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-zinc-900 text-xl font-semibold text-white dark:border dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50">
              {initials}
            </div>
            <span
              className={cn(
                'absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-background shadow-sm',
                presence.dot,
              )}
            />
          </div>

          {/* Name + role */}
          <div className="flex-1 space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">{emp.name}</h1>
            <p className="text-sm text-muted-foreground">{jobLabel}</p>
            {emp.department_id && (
              <p className="text-xs text-muted-foreground">
                {emp.department_id[1]}
              </p>
            )}
          </div>

          {/* Presence badge */}
          <div
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5',
              presence.badge,
            )}
          >
            <Circle className="size-2 fill-current" />
            {presence.label}
          </div>
        </div>
      </div>

      {/* Two-column grid */}
      <div className="grid gap-6 md:grid-cols-2">

        {/* Work Information */}
        <SectionCard icon={Briefcase} title="Work Information">
          <div className="-my-0">
            <InfoRow
              label="Department"
              value={emp.department_id ? emp.department_id[1] : '—'}
            />
            <InfoRow
              label="Job Position"
              value={emp.job_id ? emp.job_id[1] : '—'}
            />
            <InfoRow
              label="Manager"
              value={emp.parent_id ? emp.parent_id[1] : '—'}
            />
            <InfoRow
              label="Coach"
              value={emp.coach_id ? emp.coach_id[1] : '—'}
            />
            <InfoRow
              label="Work Location"
              value={
                emp.work_location_type ? (
                  <span className="capitalize">{emp.work_location_type}</span>
                ) : '—'
              }
            />
            <InfoRow
              label="Company"
              value={emp.company_id ? emp.company_id[1] : '—'}
              last
            />
          </div>
        </SectionCard>

        {/* Contact */}
        <SectionCard icon={User} title="Contact">
          {[
            emp.work_email && { icon: Mail, value: emp.work_email, label: 'work' },
            emp.work_phone && { icon: Phone, value: emp.work_phone, label: 'work' },
            emp.mobile_phone && { icon: Phone, value: emp.mobile_phone, label: 'mobile' },
            emp.private_email && { icon: Mail, value: emp.private_email, label: 'personal' },
          ]
            .filter(Boolean)
            .map((item: any, i) => (
              <ContactRow key={i} icon={item.icon} value={item.value} label={item.label} />
            ))}
          {!emp.work_email && !emp.work_phone && !emp.mobile_phone && !emp.private_email && (
            <p className="text-sm text-muted-foreground">No contact details recorded.</p>
          )}
        </SectionCard>

        {/* Contract */}
        <SectionCard icon={Calendar} title="Contract">
          {emp.contract_type_id || emp.contract_date_start || emp.contract_date_end ? (
            <>
              {emp.contract_type_id && (
                <InfoRow label="Contract Type" value={emp.contract_type_id[1]} />
              )}
              {emp.contract_date_start && (
                <InfoRow label="Start Date" value={emp.contract_date_start} mono />
              )}
              {emp.contract_date_end ? (
                <InfoRow label="End Date" value={emp.contract_date_end} mono last />
              ) : (
                <InfoRow
                  label="End Date"
                  value={
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                      Open-ended
                    </span>
                  }
                  last
                />
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No contract information available.</p>
          )}
        </SectionCard>

        {/* Personal */}
        <SectionCard icon={Shield} title="Personal">
          {emp.birthday || emp.sex || emp.identification_id ? (
            <>
              {emp.birthday && (
                <InfoRow label="Birthday" value={emp.birthday} mono />
              )}
              {emp.sex && (
                <InfoRow
                  label="Gender"
                  value={<span className="capitalize">{emp.sex}</span>}
                />
              )}
              {emp.identification_id && (
                <InfoRow label="ID Number" value={emp.identification_id} mono last />
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No personal details recorded.</p>
          )}
        </SectionCard>
      </div>

      {/* Tags */}
      {emp.category_ids?.length > 0 && (
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)]">
          <div className="border-b border-border/70 bg-muted/20 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              Tags
            </p>
          </div>
          <div className="flex flex-wrap gap-2 p-6">
            {emp.category_ids.map((cat: any) => (
              <Badge
                key={typeof cat === 'number' ? cat : cat[0]}
                variant="secondary"
                className="rounded-full"
              >
                {typeof cat === 'number' ? `Tag ${cat}` : cat[1]}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
