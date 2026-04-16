import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, Skeleton, cn } from '@mashora/design-system'
import { Mail } from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { sanitizedHtml } from '@/lib/sanitize'

interface MailingDetail {
  id: number
  subject: string
  name: string
  state: 'draft' | 'in_queue' | 'sending' | 'done' | 'cancel'
  email_from: string | false
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  mailing_model_id: [number, string] | false
  create_date: string
  body_html?: string
}

interface MailingStats {
  id: number
  subject: string
  state: string
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  open_rate?: number
  click_rate?: number
  bounce_rate?: number
}

const STATE_BADGE: Record<string, { label: string; variant: string }> = {
  draft:    { label: 'Draft',    variant: 'secondary' },
  in_queue: { label: 'Queued',   variant: 'info' },
  sending:  { label: 'Sending',  variant: 'warning' },
  done:     { label: 'Sent',     variant: 'success' },
  cancel:   { label: 'Cancelled',variant: 'destructive' },
}

function StatCard({
  label,
  value,
  colorClass,
}: {
  label: string
  value: React.ReactNode
  colorClass?: string
}) {
  return (
    <div className="rounded-2xl border border-border/30 bg-card/50 p-6 flex flex-col gap-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={cn('text-2xl font-bold', colorClass ?? '')}>{value}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-medium">{value || '—'}</p>
    </div>
  )
}

function fmtDate(dt: string | undefined) {
  if (!dt) return '—'
  try { return new Date(dt).toLocaleString() } catch { return dt }
}

function openRateColor(rate: number) {
  if (rate > 20) return 'text-emerald-400'
  if (rate > 10) return 'text-amber-400'
  return 'text-red-400'
}

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const recordId = parseInt(id || '0')

  const { data: mailing, isLoading: mailingLoading } = useQuery({
    queryKey: ['mailing', recordId],
    queryFn: async () => {
      const { data } = await erpClient.raw.get(`/mailing/campaigns/${recordId}`)
      return data as MailingDetail
    },
    enabled: !!recordId,
  })

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['mailing-stats', recordId],
    queryFn: async () => {
      const { data } = await erpClient.raw.get(`/mailing/campaigns/${recordId}/stats`)
      return data as MailingStats
    },
    enabled: !!recordId,
  })

  const isLoading = mailingLoading || statsLoading

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  }

  if (!mailing) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <Mail className="h-10 w-10" />
        <p>Campaign not found.</p>
      </div>
    )
  }

  const stateCfg = STATE_BADGE[mailing.state] ?? { label: mailing.state, variant: 'secondary' }

  // Compute rates from stats or raw numbers
  const sent       = Number(stats?.sent ?? mailing.sent ?? 0)
  const opened     = Number(stats?.opened ?? mailing.opened ?? 0)
  const clicked    = Number(stats?.clicked ?? mailing.clicked ?? 0)
  const bounced    = Number(stats?.bounced ?? mailing.bounced ?? 0)

  const openRate   = stats?.open_rate   != null ? stats.open_rate   : (sent > 0 ? (opened  / sent) * 100 : 0)
  const clickRate  = stats?.click_rate  != null ? stats.click_rate  : (sent > 0 ? (clicked / sent) * 100 : 0)
  const bounceRate = stats?.bounce_rate != null ? stats.bounce_rate : (sent > 0 ? (bounced / sent) * 100 : 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title={mailing.subject || mailing.name || 'Campaign'}
        backTo="/admin/email-marketing"
        actions={
          <Badge variant={stateCfg.variant as any}>{stateCfg.label}</Badge>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Sent" value={sent.toLocaleString()} />
        <StatCard
          label="Open Rate"
          value={`${openRate.toFixed(1)}%`}
          colorClass={openRateColor(openRate)}
        />
        <StatCard
          label="Click Rate"
          value={`${clickRate.toFixed(1)}%`}
        />
        <StatCard
          label="Bounce Rate"
          value={`${bounceRate.toFixed(1)}%`}
          colorClass={bounceRate > 5 ? 'text-red-400' : undefined}
        />
      </div>

      {/* Info card */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
        <h2 className="text-sm font-semibold mb-4">Campaign Info</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <InfoRow label="Subject" value={mailing.subject} />
            <InfoRow label="From" value={mailing.email_from || undefined} />
          </div>
          <div className="space-y-4">
            <InfoRow
              label="Model"
              value={
                Array.isArray(mailing.mailing_model_id)
                  ? mailing.mailing_model_id[1]
                  : undefined
              }
            />
            <InfoRow label="Created" value={fmtDate(mailing.create_date)} />
          </div>
        </div>
      </div>

      {/* Body preview */}
      {mailing.body_html && (
        <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
          <h2 className="text-sm font-semibold mb-4">Body Preview</h2>
          <div
            className="prose dark:prose-invert max-w-none text-sm"
            dangerouslySetInnerHTML={sanitizedHtml(mailing.body_html)}
          />
        </div>
      )}
    </div>
  )
}
