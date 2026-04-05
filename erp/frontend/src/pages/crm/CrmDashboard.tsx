import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  PageHeader, Card, CardContent, Button, Separator,
} from '@mashora/design-system'
import { Target, Trophy, X, DollarSign, Users, AlertTriangle, ArrowRight, TrendingUp, Zap } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`
  return `$${amount.toFixed(0)}`
}

interface StatCardPremiumProps {
  title: string
  value: string | number
  icon: React.ElementType
  description: string
  accent?: 'default' | 'success' | 'warning' | 'destructive'
}

function StatCardPremium({ title, value, icon: Icon, description, accent = 'default' }: StatCardPremiumProps) {
  const accentMap = {
    default: '',
    success: 'group-hover:bg-emerald-950 group-hover:text-emerald-300 dark:group-hover:bg-emerald-950 dark:group-hover:border-emerald-800 dark:group-hover:text-emerald-300',
    warning: 'group-hover:bg-amber-950 group-hover:text-amber-300 dark:group-hover:bg-amber-950 dark:group-hover:border-amber-800 dark:group-hover:text-amber-300',
    destructive: 'group-hover:bg-red-950 group-hover:text-red-300 dark:group-hover:bg-red-950 dark:group-hover:border-red-800 dark:group-hover:text-red-300',
  }

  return (
    <div className="group rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_80px_-40px_rgba(15,23,42,0.55)]">
      <div className="mb-5 flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">{title}</p>
          <div className="text-3xl font-semibold tracking-tight">{value}</div>
        </div>
        <div className={`rounded-2xl border border-border/70 bg-muted/60 p-3 text-muted-foreground transition-all duration-200 group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:border-zinc-700 dark:group-hover:bg-zinc-800 dark:group-hover:text-zinc-50 ${accentMap[accent]}`}>
          <Icon className="size-5" />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

const quickActions = [
  {
    to: '/crm/leads/new',
    label: 'New Opportunity',
    description: 'Add a prospect to the pipeline and start tracking their journey.',
    icon: Target,
  },
  {
    to: '/crm/pipeline',
    label: 'Pipeline View',
    description: 'Visual kanban board — move deals across stages at a glance.',
    icon: TrendingUp,
  },
  {
    to: '/crm/leads?tab=leads',
    label: 'Unqualified Leads',
    description: 'Review raw inbound leads before converting to opportunities.',
    icon: Zap,
  },
]

export default function CrmDashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['crm-dashboard'],
    queryFn: () => erpClient.raw.get('/crm/dashboard').then((r) => r.data),
  })

  const opps = data?.opportunities ?? {}
  const leads = data?.leads ?? {}

  return (
    <div className="space-y-8">
      <PageHeader
        title="CRM"
        description="Sales pipeline and lead management"
      />

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCardPremium
          title="Open Opportunities"
          value={isLoading ? '—' : opps.open ?? 0}
          icon={Target}
          description="Active in pipeline"
        />
        <StatCardPremium
          title="Won This Month"
          value={isLoading ? '—' : opps.won_this_month ?? 0}
          icon={Trophy}
          description="Closed won"
          accent="success"
        />
        <StatCardPremium
          title="Expected Revenue"
          value={isLoading ? '—' : formatCurrency(opps.total_expected_revenue ?? 0)}
          icon={DollarSign}
          description="Open pipeline value"
        />
        <StatCardPremium
          title="Overdue Activities"
          value={isLoading ? '—' : data?.overdue_activities ?? 0}
          icon={AlertTriangle}
          description="Past deadline"
          accent="warning"
        />
      </div>

      {/* Summary cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Pipeline summary */}
        <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
          <div className="border-b border-border/60 bg-muted/20 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Pipeline</p>
          </div>
          <div className="p-6 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Open Opportunities</span>
              <span className="font-semibold tabular-nums">{opps.open ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Won This Month</span>
              <span className="font-semibold tabular-nums text-emerald-500">{opps.won_this_month ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Lost This Month</span>
              <span className="font-semibold tabular-nums text-red-500">{opps.lost_this_month ?? 0}</span>
            </div>
            <Separator className="opacity-50" />
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">Prorated Revenue</span>
              <span className="font-mono font-semibold">{formatCurrency(opps.total_prorated_revenue ?? 0)}</span>
            </div>
            <button
              onClick={() => navigate('/crm/pipeline')}
              className="group mt-2 flex w-full items-center justify-between rounded-2xl border border-border/70 bg-muted/40 px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 hover:bg-muted/70 hover:shadow-md"
            >
              View Pipeline
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>

        {/* Leads summary */}
        <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
          <div className="border-b border-border/60 bg-muted/20 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Leads</p>
          </div>
          <div className="p-6 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">New This Month</span>
              <span className="font-semibold tabular-nums">{leads.new_this_month ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Unassigned</span>
              <span className="font-semibold tabular-nums text-amber-500">{leads.unassigned ?? 0}</span>
            </div>
            <Separator className="opacity-50" />
            <button
              onClick={() => navigate('/crm/leads')}
              className="group flex w-full items-center justify-between rounded-2xl border border-border/70 bg-muted/40 px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 hover:bg-muted/70 hover:shadow-md"
            >
              View All Leads
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick action cards */}
      <div>
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Quick Actions</p>
        <div className="grid gap-4 md:grid-cols-3">
          {quickActions.map(({ to, label, description, icon: Icon }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="group rounded-3xl border border-border/70 bg-card/85 p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-zinc-900/20 hover:shadow-xl dark:hover:border-zinc-100/20"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-2xl border border-border/70 bg-muted/60 p-3 text-zinc-900 dark:text-zinc-100 transition-colors group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:bg-zinc-800 dark:group-hover:border-zinc-700 dark:group-hover:text-zinc-50">
                  <Icon className="size-5" />
                </div>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-semibold">{label}</h3>
                <p className="text-sm leading-6 text-muted-foreground">{description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
