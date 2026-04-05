import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader, Input, Badge, cn } from '@mashora/design-system'
import { Search, Check, X, Calendar, Clock, User } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeaveRequest {
  id: number
  employee_id: [number, string] | false
  department_id: [number, string] | false
  holiday_status_id: [number, string] | false
  state: string
  date_from: string | false
  date_to: string | false
  number_of_days: number
  duration_display: string | false
  name: string | false
  first_approver_id: [number, string] | false
  can_approve: boolean
  can_refuse: boolean
}

type TabFilter = 'all' | 'pending' | 'approved' | 'refused'

// ─── State config ─────────────────────────────────────────────────────────────

const stateConfig: Record<string, { label: string; className: string }> = {
  confirm: {
    label: 'To Approve',
    className:
      'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400',
  },
  validate1: {
    label: 'Second Approval',
    className:
      'bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400',
  },
  validate: {
    label: 'Approved',
    className:
      'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
  },
  refuse: {
    label: 'Refused',
    className:
      'bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400',
  },
  cancel: {
    label: 'Cancelled',
    className:
      'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
  },
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

const tabs: { id: TabFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'refused', label: 'Refused' },
]

// ─── Leave row card ───────────────────────────────────────────────────────────

interface LeaveRowProps {
  leave: LeaveRequest
  onApprove: () => void
  onRefuse: () => void
  approving: boolean
  refusing: boolean
}

function LeaveRow({ leave, onApprove, onRefuse, approving, refusing }: LeaveRowProps) {
  const cfg = stateConfig[leave.state] ?? stateConfig.cancel
  const employeeName = leave.employee_id ? leave.employee_id[1] : 'Unknown'
  const leaveType = leave.holiday_status_id ? leave.holiday_status_id[1] : '—'
  const dateFrom = leave.date_from ? leave.date_from.split(' ')[0] : '—'
  const dateTo = leave.date_to ? leave.date_to.split(' ')[0] : '—'
  const duration = leave.duration_display || `${leave.number_of_days} day${leave.number_of_days !== 1 ? 's' : ''}`
  const isPending = leave.state === 'confirm'

  const initials = employeeName
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')

  return (
    <div className="group flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/60 p-5 transition-all duration-200 hover:border-border/80 hover:bg-card sm:flex-row sm:items-start">
      {/* Employee avatar */}
      <div className="shrink-0">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-muted text-sm font-semibold">
          {initials}
        </div>
      </div>

      {/* Main info */}
      <div className="min-w-0 flex-1 space-y-2.5">
        {/* Top row: name + type + status */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{employeeName}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-sm text-muted-foreground">{leaveType}</span>
          <span
            className={cn(
              'ml-auto rounded-full border px-2.5 py-0.5 text-xs font-semibold',
              cfg.className,
            )}
          >
            {cfg.label}
          </span>
        </div>

        {/* Date range + duration */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="size-3.5" />
            {dateFrom} → {dateTo}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5" />
            {duration}
          </span>
          {leave.department_id && (
            <span className="flex items-center gap-1.5">
              <User className="size-3.5" />
              {leave.department_id[1]}
            </span>
          )}
        </div>

        {/* Description */}
        {leave.name && (
          <p className="text-xs text-muted-foreground italic">"{leave.name}"</p>
        )}
      </div>

      {/* Actions — only for pending */}
      {isPending && (leave.can_approve || leave.can_refuse) && (
        <div className="flex shrink-0 items-center gap-2">
          {leave.can_approve && (
            <button
              onClick={(e) => { e.stopPropagation(); onApprove() }}
              disabled={approving}
              aria-label="Approve leave request"
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 transition-all duration-150 hover:bg-emerald-500/20 hover:shadow-sm disabled:opacity-50 dark:text-emerald-400"
            >
              <Check className="size-3.5" />
              {approving ? 'Approving…' : 'Approve'}
            </button>
          )}
          {leave.can_refuse && (
            <button
              onClick={(e) => { e.stopPropagation(); onRefuse() }}
              disabled={refusing}
              aria-label="Refuse leave request"
              className="flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 transition-all duration-150 hover:bg-red-500/20 hover:shadow-sm disabled:opacity-50 dark:text-red-400"
            >
              <X className="size-3.5" />
              {refusing ? 'Refusing…' : 'Refuse'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeaveRequests() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<TabFilter>('all')
  const [search, setSearch] = useState('')

  const params: Record<string, any> = { limit: 50, search: search || undefined }
  if (tab === 'pending') params.state = ['confirm', 'validate1']
  else if (tab === 'approved') params.state = ['validate']
  else if (tab === 'refused') params.state = ['refuse']

  const { data, isLoading } = useQuery({
    queryKey: ['leaves', tab, search],
    queryFn: () => erpClient.raw.post('/hr/leaves', params).then((r) => r.data),
  })

  const approveMut = useMutation({
    mutationFn: (id: number) => erpClient.raw.post(`/hr/leaves/${id}/approve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leaves'] }),
  })

  const refuseMut = useMutation({
    mutationFn: (id: number) => erpClient.raw.post(`/hr/leaves/${id}/refuse`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leaves'] }),
  })

  const records: LeaveRequest[] = data?.records ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Human Resources"
        title="Time Off"
        description={isLoading ? 'Loading…' : `${data?.total ?? 0} leave requests`}
      />

      {/* Search + Tabs bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search requests…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-2xl pl-10"
          />
        </div>

        {/* Custom pill tabs */}
        <div className="flex items-center gap-1 rounded-2xl border border-border/70 bg-muted/40 p-1">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'rounded-xl px-4 py-1.5 text-sm font-medium transition-all duration-150',
                tab === id
                  ? 'bg-zinc-900 text-white shadow-sm dark:border dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* List container */}
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)]">
        {/* Header */}
        <div className="border-b border-border/70 bg-muted/20 px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            {tabs.find((t) => t.id === tab)?.label ?? 'All'} Requests
          </p>
        </div>

        <div className="space-y-2 p-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-start gap-4 rounded-2xl border border-border/40 bg-muted/20 p-5 animate-pulse"
              >
                <div className="size-10 shrink-0 rounded-2xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 rounded-full bg-muted" />
                  <div className="h-3 w-64 rounded-full bg-muted" />
                  <div className="h-3 w-32 rounded-full bg-muted" />
                </div>
              </div>
            ))
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <div className="rounded-2xl border border-border/70 bg-muted/60 p-4 text-muted-foreground">
                <Calendar className="size-6" />
              </div>
              <p className="text-sm font-medium">No leave requests found</p>
              <p className="text-xs text-muted-foreground">
                {tab !== 'all'
                  ? `No ${tab} requests at this time`
                  : 'Try adjusting your search query'}
              </p>
            </div>
          ) : (
            records.map((leave) => (
              <LeaveRow
                key={leave.id}
                leave={leave}
                onApprove={() => approveMut.mutate(leave.id)}
                onRefuse={() => refuseMut.mutate(leave.id)}
                approving={approveMut.isPending && approveMut.variables === leave.id}
                refusing={refuseMut.isPending && refuseMut.variables === leave.id}
              />
            ))
          )}
        </div>

        {/* Footer count */}
        {records.length > 0 && (
          <div className="border-t border-border/50 px-6 py-3">
            <p className="text-xs text-muted-foreground">
              Showing {records.length} of {data?.total ?? records.length} requests
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
