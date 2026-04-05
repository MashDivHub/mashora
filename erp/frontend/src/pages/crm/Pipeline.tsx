import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  PageHeader, Button, Input, Badge, cn,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@mashora/design-system'
import { Plus, Search, Star, DollarSign, Trophy, User } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

interface Lead {
  id: number
  name: string
  partner_id: [number, string] | false
  contact_name: string | false
  expected_revenue: number
  probability: number
  priority: string
  tag_ids: number[]
  activity_date_deadline: string | false
  user_id: [number, string] | false
}

interface StageData {
  stage: { id: number; name: string; is_won: boolean; color: number; fold: boolean }
  leads: Lead[]
  count: number
  total_revenue: number
}

const priorityColors = ['', 'text-amber-400', 'text-orange-400', 'text-red-400']
const priorityLabels = ['', 'Medium', 'High', 'Very High']

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

function ProbabilityBar({ value }: { value: number }) {
  const color =
    value >= 75 ? 'bg-emerald-500' :
    value >= 50 ? 'bg-amber-400' :
    value >= 25 ? 'bg-orange-400' :
    'bg-red-400'

  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-muted/50">
      <div
        className={cn('h-full rounded-full transition-all', color)}
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

function OpportunityCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const priorityLevel = Number(lead.priority)
  const hasActivity = !!lead.activity_date_deadline

  const activityDate = lead.activity_date_deadline
    ? new Date(lead.activity_date_deadline as string)
    : null
  const isOverdue = activityDate ? activityDate < new Date() : false

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-2xl border border-border/70 bg-card/90 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-lg hover:shadow-black/10 dark:hover:shadow-black/30"
    >
      {/* Title row */}
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-foreground">
          {lead.name}
        </p>
        {priorityLevel > 0 && (
          <Star className={cn('mt-0.5 h-3.5 w-3.5 shrink-0 fill-current', priorityColors[priorityLevel])} />
        )}
      </div>

      {/* Company / contact */}
      {(lead.partner_id || lead.contact_name) && (
        <div className="mb-3 flex items-center gap-1.5">
          <User className="h-3 w-3 shrink-0 text-muted-foreground/60" />
          <p className="text-xs text-muted-foreground truncate">
            {lead.partner_id ? lead.partner_id[1] : lead.contact_name}
          </p>
        </div>
      )}

      {/* Revenue + probability */}
      <div className="mb-2 flex items-center justify-between gap-2">
        {lead.expected_revenue > 0 ? (
          <span className="flex items-center gap-1 text-xs font-semibold tabular-nums">
            <DollarSign className="h-3 w-3 text-muted-foreground" />
            {formatCurrency(lead.expected_revenue)}
          </span>
        ) : (
          <span />
        )}
        <span className="text-[10px] font-bold tabular-nums text-muted-foreground">
          {lead.probability}%
        </span>
      </div>

      {/* Probability bar */}
      <ProbabilityBar value={lead.probability} />

      {/* Activity deadline */}
      {hasActivity && (
        <p className={cn(
          'mt-2.5 text-[10px] font-medium',
          isOverdue ? 'text-red-400' : 'text-muted-foreground',
        )}>
          {isOverdue ? 'Overdue: ' : 'Activity: '}
          {lead.activity_date_deadline}
        </p>
      )}
    </div>
  )
}

export default function Pipeline() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['crm-pipeline'],
    queryFn: () => erpClient.raw.get('/crm/pipeline').then((r) => r.data),
  })

  const moveStageMutation = useMutation({
    mutationFn: ({ leadId, stageId }: { leadId: number; stageId: number }) =>
      erpClient.raw.post(`/crm/leads/${leadId}/move-stage?stage_id=${stageId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crm-pipeline'] }),
  })

  const pipeline: StageData[] = data?.pipeline ?? []

  const filteredPipeline = pipeline.map((stage) => ({
    ...stage,
    leads: search
      ? stage.leads.filter(
          (l) =>
            l.name.toLowerCase().includes(search.toLowerCase()) ||
            (l.partner_id && l.partner_id[1].toLowerCase().includes(search.toLowerCase())) ||
            (l.contact_name && l.contact_name.toLowerCase().includes(search.toLowerCase()))
        )
      : stage.leads,
  }))

  return (
    <div className="flex h-full flex-col gap-6">
      <PageHeader
        title="Pipeline"
        description="Opportunities across sales stages"
        actions={
          <Button onClick={() => navigate('/crm/leads/new')} className="rounded-2xl">
            <Plus className="h-4 w-4" />
            New Opportunity
          </Button>
        }
      />

      {/* Search bar */}
      <div className="flex items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search opportunities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-2xl pl-9 border-border/60 bg-card/80 focus:bg-background"
          />
        </div>
        {search && (
          <span className="text-xs text-muted-foreground">
            {filteredPipeline.reduce((n, s) => n + s.leads.length, 0)} result{filteredPipeline.reduce((n, s) => n + s.leads.length, 0) !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-6" style={{ minHeight: 0 }}>
          {filteredPipeline.map((stageData) => {
            const totalRevDisplay = stageData.total_revenue > 0
              ? `$${formatCurrency(stageData.total_revenue)}`
              : null

            return (
              <div
                key={stageData.stage.id}
                className="flex w-72 shrink-0 flex-col rounded-3xl border border-border/60 bg-card/50 shadow-[0_8px_40px_-20px_rgba(15,23,42,0.35)]"
              >
                {/* Stage header */}
                <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-3 rounded-t-3xl">
                  <div className="flex items-center gap-2 min-w-0">
                    {stageData.stage.is_won && (
                      <Trophy className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    )}
                    <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground truncate">
                      {stageData.stage.name}
                    </h3>
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-bold text-muted-foreground">
                      {stageData.count}
                    </span>
                  </div>
                  {totalRevDisplay && (
                    <span className="ml-2 shrink-0 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                      {totalRevDisplay}
                    </span>
                  )}
                </div>

                {/* Cards scroll area */}
                <div
                  className="flex flex-col gap-2 overflow-y-auto p-3"
                  style={{ maxHeight: 'calc(100vh - 300px)' }}
                >
                  {stageData.leads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <p className="text-xs text-muted-foreground/60">No opportunities</p>
                    </div>
                  ) : (
                    stageData.leads.map((lead) => (
                      <OpportunityCard
                        key={lead.id}
                        lead={lead}
                        onClick={() => navigate(`/crm/leads/${lead.id}`)}
                      />
                    ))
                  )}
                </div>

                {/* Column footer — add button */}
                <div className="border-t border-border/60 p-2 rounded-b-3xl">
                  <button
                    onClick={() => navigate('/crm/leads/new')}
                    className="flex w-full items-center justify-center gap-1.5 rounded-2xl py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
