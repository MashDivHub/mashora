import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button, Skeleton } from '@mashora/design-system'
import { ClipboardList, BarChart2 } from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface SurveyDetail {
  id: number
  title: string
  state: 'draft' | 'open' | 'closed'
  scoring_type: string
  certification: boolean
  access_mode: string
  question_count: number
  answer_count: number
  time_limit: boolean
  time_limit_seconds?: number
}

const SCORING_LABELS: Record<string, string> = {
  no_scoring: 'None',
  scoring_with_answers: 'With Answers',
  scoring_without_answers: 'Without Answers',
}

const STATE_VARIANT: Record<string, 'secondary' | 'success' | 'default'> = {
  draft: 'secondary',
  open: 'success',
  closed: 'default',
}

const STATE_LABEL: Record<string, string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  )
}

function formatTimeLimit(seconds: number): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

export default function SurveyDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: survey, isLoading } = useQuery({
    queryKey: ['survey', id],
    queryFn: async () => {
      const { data } = await erpClient.raw.get(`/surveys/${id}`)
      return data as SurveyDetail
    },
    enabled: !!id,
  })

  if (isLoading || !survey) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={survey.title}
        backTo="/surveys"
        actions={
          <Badge variant={STATE_VARIANT[survey.state] ?? 'secondary'} className="rounded-full px-3 text-sm">
            {STATE_LABEL[survey.state] ?? survey.state}
          </Badge>
        }
      />

      <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
        <div className="grid md:grid-cols-2 gap-x-12 gap-y-5">
          {/* Left column */}
          <div className="space-y-5">
            <InfoRow label="Title" value={survey.title} />
            <InfoRow
              label="State"
              value={
                <Badge variant={STATE_VARIANT[survey.state] ?? 'secondary'}>
                  {STATE_LABEL[survey.state] ?? survey.state}
                </Badge>
              }
            />
            <InfoRow
              label="Scoring Type"
              value={SCORING_LABELS[survey.scoring_type] ?? survey.scoring_type ?? '—'}
            />
            <InfoRow
              label="Certification"
              value={
                survey.certification ? (
                  <Badge variant="default" className="rounded-full text-xs">Yes</Badge>
                ) : (
                  'No'
                )
              }
            />
            <InfoRow label="Access Mode" value={survey.access_mode ?? '—'} />
          </div>

          {/* Right column */}
          <div className="space-y-5">
            <InfoRow label="Questions" value={String(survey.question_count ?? 0)} />
            <InfoRow label="Responses" value={String(survey.answer_count ?? 0)} />
            {survey.time_limit && (
              <InfoRow
                label="Time Limit"
                value={formatTimeLimit(survey.time_limit_seconds ?? 0)}
              />
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          className="rounded-xl gap-1.5"
          onClick={() => navigate(`/surveys/${id}/responses`)}
        >
          <BarChart2 className="h-3.5 w-3.5" />
          View Responses
        </Button>
      </div>
    </div>
  )
}
