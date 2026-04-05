import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  PageHeader, Button, Input, Badge, cn,
} from '@mashora/design-system'
import { Plus, Search, ArrowRight } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  id: number
  name: string
  department_id: [number, string] | false
  job_id: [number, string] | false
  job_title: string | false
  parent_id: [number, string] | false
  work_email: string | false
  work_phone: string | false
  work_location_type: string | false
  hr_presence_state: string
  active: boolean
}

// ─── Presence indicator ───────────────────────────────────────────────────────

const presenceDot: Record<string, string> = {
  present: 'bg-emerald-500 shadow-emerald-500/40',
  absent: 'bg-red-500 shadow-red-500/40',
  to_define: 'bg-zinc-400',
  out_of_working_hour: 'bg-zinc-400',
}

const presenceLabel: Record<string, string> = {
  present: 'Present',
  absent: 'Absent',
  to_define: 'Unknown',
  out_of_working_hour: 'Off Hours',
}

const locationBadge: Record<string, string> = {
  home: 'bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400',
  office: 'bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400',
  other: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
}

// ─── Employee row card ────────────────────────────────────────────────────────

function EmployeeRow({ emp, onClick }: { emp: Employee; onClick: () => void }) {
  const dot = presenceDot[emp.hr_presence_state] ?? 'bg-zinc-400'
  const jobLabel = emp.job_title || (emp.job_id ? emp.job_id[1] : null)
  const locType = typeof emp.work_location_type === 'string' ? emp.work_location_type : null

  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-2xl border border-border/60 bg-card/60 px-5 py-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-900/20 hover:bg-card hover:shadow-lg dark:hover:border-zinc-100/15"
    >
      {/* Avatar + presence */}
      <div className="relative shrink-0">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-muted font-semibold text-sm text-foreground">
          {emp.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
        </div>
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background shadow-sm',
            dot,
          )}
          title={presenceLabel[emp.hr_presence_state]}
        />
      </div>

      {/* Name + role */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight">{emp.name}</p>
        {jobLabel && (
          <p className="truncate text-xs text-muted-foreground">{jobLabel}</p>
        )}
      </div>

      {/* Department */}
      {emp.department_id && (
        <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
          {emp.department_id[1]}
        </Badge>
      )}

      {/* Location */}
      {locType && (
        <span
          className={cn(
            'hidden shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize lg:inline-flex',
            locationBadge[locType] ?? locationBadge.other,
          )}
        >
          {locType}
        </span>
      )}

      {/* Email */}
      {emp.work_email && (
        <span className="hidden truncate text-xs text-muted-foreground xl:block max-w-[180px]">
          {emp.work_email}
        </span>
      )}

      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmployeeList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const params: Record<string, any> = { limit: 50, search: search || undefined }

  const { data, isLoading } = useQuery({
    queryKey: ['employees', search],
    queryFn: () => erpClient.raw.post('/hr/employees', params).then((r) => r.data),
  })

  const records: Employee[] = data?.records ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Human Resources"
        title="Employees"
        description={isLoading ? 'Loading…' : `${data?.total ?? 0} employees in the directory`}
        actions={
          <Button className="rounded-2xl">
            <Plus className="size-4" />
            New Employee
          </Button>
        }
      />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search employees…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-2xl pl-10"
        />
      </div>

      {/* Presence legend */}
      <div className="flex items-center gap-5">
        {(['present', 'absent', 'out_of_working_hour'] as const).map((key) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={cn('size-2 rounded-full', presenceDot[key])} />
            <span className="text-xs text-muted-foreground">{presenceLabel[key]}</span>
          </div>
        ))}
      </div>

      {/* Employee list */}
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)]">
        {/* Header row */}
        <div className="border-b border-border/70 bg-muted/20 px-6 py-3">
          <div className="flex items-center gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              Employee
            </p>
            <p className="ml-auto hidden text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground sm:block">
              Department
            </p>
          </div>
        </div>

        <div className="p-3 space-y-1.5">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-2xl border border-border/40 bg-muted/20 px-5 py-4 animate-pulse"
              >
                <div className="size-10 rounded-2xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-36 rounded-full bg-muted" />
                  <div className="h-3 w-24 rounded-full bg-muted" />
                </div>
              </div>
            ))
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <div className="rounded-2xl border border-border/70 bg-muted/60 p-4 text-muted-foreground">
                <Search className="size-6" />
              </div>
              <p className="text-sm font-medium">No employees found</p>
              <p className="text-xs text-muted-foreground">
                Try adjusting your search query
              </p>
            </div>
          ) : (
            records.map((emp) => (
              <EmployeeRow
                key={emp.id}
                emp={emp}
                onClick={() => navigate(`/hr/employees/${emp.id}`)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        {records.length > 0 && (
          <div className="border-t border-border/50 px-6 py-3">
            <p className="text-xs text-muted-foreground">
              Showing {records.length} of {data?.total ?? records.length} employees
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
