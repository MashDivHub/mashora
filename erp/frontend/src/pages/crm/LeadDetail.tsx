import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PageHeader, Button, Badge, Skeleton, cn,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Input, Label, Textarea, Separator,
} from '@mashora/design-system'
import {
  ArrowLeft, Trophy, X, RotateCcw, FileText, UserPlus,
  Mail, Phone, Globe, MapPin, Star, DollarSign, Calendar,
  TrendingUp, Users,
} from 'lucide-react'
import { erpClient } from '@/lib/erp-api'
import { useState } from 'react'

const wonStatusVariants: Record<string, string> = {
  pending: 'secondary',
  won: 'success',
  lost: 'destructive',
}

const priorityLabels = ['Normal', 'Medium', 'High', 'Very High']
const priorityColors = ['', 'text-amber-400', 'text-orange-400', 'text-red-400']

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

function InfoRow({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="leading-relaxed">{children}</span>
    </div>
  )
}

function MetricRow({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: 'success' | 'muted' }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn(
        'font-mono font-medium tabular-nums',
        highlight === 'success' && 'text-emerald-500',
        highlight === 'muted' && 'text-muted-foreground',
      )}>
        {value}
      </span>
    </div>
  )
}

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showLostDialog, setShowLostDialog] = useState(false)
  const [lostReasonId, setLostReasonId] = useState<string>('')
  const [lostFeedback, setLostFeedback] = useState('')

  const { data: lead, isLoading } = useQuery({
    queryKey: ['crm-lead', id],
    queryFn: () => erpClient.raw.get(`/crm/leads/${id}`).then((r) => r.data),
    enabled: !!id,
  })

  const { data: lostReasons } = useQuery({
    queryKey: ['lost-reasons'],
    queryFn: () => erpClient.raw.get('/crm/lost-reasons').then((r) => r.data),
  })

  const wonMutation = useMutation({
    mutationFn: () => erpClient.raw.post(`/crm/leads/${id}/won`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crm-lead', id] }),
  })

  const lostMutation = useMutation({
    mutationFn: (data: { lost_reason_id: number; lost_feedback?: string }) =>
      erpClient.raw.post(`/crm/leads/${id}/lost`, data),
    onSuccess: () => {
      setShowLostDialog(false)
      queryClient.invalidateQueries({ queryKey: ['crm-lead', id] })
    },
  })

  const restoreMutation = useMutation({
    mutationFn: () => erpClient.raw.post(`/crm/leads/${id}/restore`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crm-lead', id] }),
  })

  const quotationMutation = useMutation({
    mutationFn: () => erpClient.raw.post(`/crm/leads/${id}/new-quotation`),
    onSuccess: (res) => {
      if (res.data?.id) navigate(`/sales/orders/${res.data.id}`)
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64 rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    )
  }
  if (!lead) return <div className="text-muted-foreground">Lead not found.</div>

  const isPending = lead.won_status === 'pending'
  const isWon = lead.won_status === 'won'
  const isLost = lead.won_status === 'lost'
  const isOpportunity = lead.type === 'opportunity'

  return (
    <div className="space-y-6">
      <PageHeader
        title={lead.name}
        eyebrow={isOpportunity ? 'Opportunity' : 'Lead'}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isPending && isOpportunity && (
              <>
                <Button variant="success" onClick={() => wonMutation.mutate()} disabled={wonMutation.isPending} className="rounded-2xl">
                  <Trophy className="h-4 w-4" />
                  Won
                </Button>
                <Button variant="destructive" onClick={() => setShowLostDialog(true)} className="rounded-2xl">
                  <X className="h-4 w-4" />
                  Lost
                </Button>
              </>
            )}
            {isPending && isOpportunity && (
              <Button variant="outline" onClick={() => quotationMutation.mutate()} disabled={quotationMutation.isPending} className="rounded-2xl">
                <FileText className="h-4 w-4" />
                New Quotation
              </Button>
            )}
            {isPending && !isOpportunity && (
              <Button
                className="rounded-2xl"
                onClick={() => erpClient.raw.post(`/crm/leads/${id}/convert`).then(() => queryClient.invalidateQueries({ queryKey: ['crm-lead', id] }))}
              >
                <UserPlus className="h-4 w-4" />
                Convert to Opportunity
              </Button>
            )}
            {isLost && (
              <Button variant="outline" onClick={() => restoreMutation.mutate()} disabled={restoreMutation.isPending} className="rounded-2xl">
                <RotateCcw className="h-4 w-4" />
                Restore
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate('/crm/pipeline')} className="rounded-2xl">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
        }
      />

      {/* Status strip */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={(wonStatusVariants[lead.won_status] as any) || 'secondary'}
          className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide"
        >
          {lead.won_status === 'won' ? 'Won' : lead.won_status === 'lost' ? 'Lost' : 'In Progress'}
        </Badge>
        {lead.stage_id && (
          <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] font-medium">
            {lead.stage_id[1]}
          </Badge>
        )}
        {Number(lead.priority) > 0 && (
          <span className={cn('flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-[11px] font-semibold', priorityColors[Number(lead.priority)])}>
            <Star className="h-3 w-3 fill-current" />
            {priorityLabels[Number(lead.priority)]}
          </span>
        )}
        {lead.tag_ids?.length > 0 && lead.tag_ids.map((tag: any) => (
          <Badge key={typeof tag === 'number' ? tag : tag[0]} variant="secondary" className="rounded-full px-3 py-1 text-[11px]">
            {typeof tag === 'number' ? `Tag ${tag}` : tag[1]}
          </Badge>
        ))}
      </div>

      {/* Two-column detail */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Contact card */}
        <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
          <div className="border-b border-border/60 bg-muted/20 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Contact</p>
          </div>
          <div className="p-6 space-y-4">
            {lead.partner_id && (
              <InfoRow icon={Users}>
                <span className="font-semibold">{lead.partner_id[1]}</span>
              </InfoRow>
            )}
            {lead.contact_name && (
              <InfoRow icon={UserPlus}>
                <span>
                  {lead.contact_name}
                  {lead.function && <span className="text-muted-foreground"> — {lead.function}</span>}
                </span>
              </InfoRow>
            )}
            {lead.email_from && (
              <InfoRow icon={Mail}>
                <a href={`mailto:${lead.email_from}`} className="hover:underline underline-offset-4">
                  {lead.email_from}
                </a>
              </InfoRow>
            )}
            {lead.phone && (
              <InfoRow icon={Phone}>
                <a href={`tel:${lead.phone}`} className="hover:underline underline-offset-4">
                  {lead.phone}
                </a>
              </InfoRow>
            )}
            {lead.website && (
              <InfoRow icon={Globe}>
                <a href={lead.website} target="_blank" rel="noopener noreferrer" className="hover:underline underline-offset-4">
                  {lead.website}
                </a>
              </InfoRow>
            )}
            {(lead.city || lead.country_id) && (
              <InfoRow icon={MapPin}>
                {[lead.street, lead.city, lead.country_id?.[1]].filter(Boolean).join(', ')}
              </InfoRow>
            )}
            {!lead.partner_id && !lead.contact_name && !lead.email_from && !lead.phone && (
              <p className="text-sm text-muted-foreground italic">No contact details recorded.</p>
            )}
          </div>
        </div>

        {/* Revenue & Pipeline card */}
        <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
          <div className="border-b border-border/60 bg-muted/20 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Revenue & Pipeline</p>
          </div>
          <div className="p-6 space-y-3">
            <MetricRow label="Expected Revenue" value={`$${formatCurrency(lead.expected_revenue)}`} />
            <MetricRow label="Probability" value={`${lead.probability}%`} />
            <MetricRow label="Prorated Revenue" value={`$${formatCurrency(lead.prorated_revenue)}`} highlight="success" />
            {lead.recurring_revenue > 0 && (
              <>
                <Separator className="opacity-50" />
                <MetricRow label="Recurring Revenue" value={`$${formatCurrency(lead.recurring_revenue)}`} />
                <MetricRow label="Monthly (MRR)" value={`$${formatCurrency(lead.recurring_revenue_monthly)}`} />
              </>
            )}
            <Separator className="opacity-50" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Salesperson</span>
              <span className="font-medium">{lead.user_id ? lead.user_id[1] : '—'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Team</span>
              <span className="font-medium">{lead.team_id ? lead.team_id[1] : '—'}</span>
            </div>
            {lead.date_deadline && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Expected Closing</span>
                <span className="font-medium tabular-nums">{lead.date_deadline}</span>
              </div>
            )}
            {lead.date_closed && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Closed On</span>
                <span className="font-medium tabular-nums">{lead.date_closed}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Internal Notes */}
      {lead.description && (
        <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
          <div className="border-b border-border/60 bg-muted/20 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Internal Notes</p>
          </div>
          <div className="p-6">
            <div
              className="prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed"
              dangerouslySetInnerHTML={{ __html: lead.description }}
            />
          </div>
        </div>
      )}

      {/* Lost reason */}
      {isLost && lead.lost_reason_id && (
        <div className="rounded-3xl border border-red-500/20 bg-red-500/5 shadow-[0_20px_80px_-48px_rgba(239,68,68,0.15)] overflow-hidden">
          <div className="border-b border-red-500/20 bg-red-500/10 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-red-400">Lost Reason</p>
          </div>
          <div className="p-6">
            <Badge variant="destructive" className="rounded-full px-4 py-1.5 text-sm font-semibold">
              {lead.lost_reason_id[1]}
            </Badge>
            {lead.lost_feedback && (
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{lead.lost_feedback}</p>
            )}
          </div>
        </div>
      )}

      {/* Lost Dialog */}
      <Dialog open={showLostDialog} onOpenChange={setShowLostDialog}>
        <DialogContent className="rounded-3xl border border-border/60 shadow-[0_40px_120px_-40px_rgba(15,23,42,0.6)] sm:max-w-md">
          <DialogHeader className="border-b border-border/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-2.5">
                <X className="h-4 w-4 text-red-400" />
              </div>
              <DialogTitle className="text-lg font-semibold">Mark as Lost</DialogTitle>
            </div>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Reason</Label>
              <Select value={lostReasonId} onValueChange={setLostReasonId}>
                <SelectTrigger className="rounded-2xl border-border/60 bg-muted/30">
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {(lostReasons?.records ?? []).map((r: any) => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Feedback <span className="normal-case tracking-normal text-muted-foreground/60">(optional)</span>
              </Label>
              <Textarea
                value={lostFeedback}
                onChange={(e) => setLostFeedback(e.target.value)}
                placeholder="Additional context or notes..."
                className="rounded-2xl border-border/60 bg-muted/30 resize-none"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="border-t border-border/60 pt-4 gap-2">
            <Button variant="outline" onClick={() => setShowLostDialog(false)} className="rounded-2xl">
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!lostReasonId || lostMutation.isPending}
              className="rounded-2xl"
              onClick={() => lostMutation.mutate({
                lost_reason_id: Number(lostReasonId),
                lost_feedback: lostFeedback || undefined,
              })}
            >
              {lostMutation.isPending ? 'Saving...' : 'Mark as Lost'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
