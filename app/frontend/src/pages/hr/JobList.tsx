import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared'
import { Badge } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { Briefcase } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface JobRecord {
  id: number
  name: string
  department_id: [number, string] | false
  no_of_employee: number
  no_of_recruitment: number
  expected_employees: number
  description: string | false
}

// ─── Stat cell ────────────────────────────────────────────────────────────────

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-lg font-bold tabular-nums leading-none">{value}</span>
      <span className="text-[11px] text-muted-foreground leading-none">{label}</span>
    </div>
  )
}

// ─── Job card ─────────────────────────────────────────────────────────────────

function JobCard({ job }: { job: JobRecord }) {
  const isHiring = job.no_of_recruitment > 0

  // Strip HTML tags from Odoo description field
  const plainDescription = job.description
    ? job.description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    : ''

  return (
    <div className="rounded-2xl border border-border/30 bg-card/50 p-5 flex flex-col gap-4 transition-all duration-150 hover:border-border/60 hover:bg-card/70">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Briefcase className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold leading-snug truncate">{job.name}</h3>
            {job.department_id && (
              <Badge variant="secondary" className="mt-1 text-xs">
                {job.department_id[1]}
              </Badge>
            )}
          </div>
        </div>
        {isHiring && (
          <Badge variant="success" className="shrink-0 text-xs">
            Hiring
          </Badge>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-around rounded-xl border border-border/20 bg-muted/30 py-3 px-2">
        <Stat value={job.no_of_employee} label="Current" />
        <div className="h-8 w-px bg-border/40" />
        <Stat value={job.expected_employees} label="Expected" />
        <div className="h-8 w-px bg-border/40" />
        <Stat value={job.no_of_recruitment} label="Open Positions" />
      </div>

      {/* Description snippet */}
      {plainDescription && (
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {plainDescription}
        </p>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JobList() {
  const { data, isLoading } = useQuery({
    queryKey: ['job-list'],
    queryFn: () => erpClient.raw.get('/hr/jobs').then(r => r.data),
  })

  const records: JobRecord[] = data?.records ?? []
  const total: number = data?.total ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job Positions"
        subtitle={isLoading ? undefined : `${total} position${total !== 1 ? 's' : ''}`}
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-4 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-muted shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-40 rounded-full bg-muted" />
                  <div className="h-3 w-24 rounded-full bg-muted" />
                </div>
              </div>
              <div className="h-16 rounded-xl bg-muted" />
              <div className="h-3 w-full rounded-full bg-muted" />
              <div className="h-3 w-3/4 rounded-full bg-muted" />
            </div>
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <div className="rounded-2xl border border-border/70 bg-muted/60 p-4 text-muted-foreground">
            <Briefcase className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium">No job positions found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {records.map(job => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  )
}
