import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { PageHeader, KanbanBoard, toast } from '@/components/shared'
import type { KanbanCardData, KanbanColumn } from '@/components/shared/KanbanBoard'
import { Skeleton } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

interface Stage {
  id: number
  name: string
  sequence: number
  fold: boolean
  hired_stage: boolean
}

interface Applicant {
  id: number
  partner_name: string
  email_from: string | false
  job_id: [number, string] | false
  stage_id: [number, string] | false
  user_id: [number, string] | false
  salary_expected: number | false
  priority: string
}

export default function RecruitmentList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: stagesData, isLoading: stagesLoading } = useQuery({
    queryKey: ['recruitment-stages'],
    queryFn: () =>
      erpClient.raw
        .post('/model/hr.recruitment.stage', {
          fields: ['id', 'name', 'sequence', 'fold', 'hired_stage'],
          order: 'sequence asc, id asc',
          limit: 100,
        })
        .then((r) => r.data),
  })

  const { data: applicantsData, isLoading: applicantsLoading } = useQuery({
    queryKey: ['applicants'],
    queryFn: () =>
      erpClient.raw
        .post('/model/hr.applicant', {
          domain: [['active', '=', true]],
          fields: ['id', 'partner_name', 'email_from', 'job_id', 'stage_id', 'user_id', 'salary_expected', 'priority'],
          limit: 500,
          order: 'priority desc, id desc',
        })
        .then((r) => r.data),
  })

  const moveMut = useMutation({
    mutationFn: async ({ applicantId, stageId }: { applicantId: number; stageId: number }) => {
      const { data } = await erpClient.raw.put(`/model/hr.applicant/${applicantId}`, { vals: { stage_id: stageId } })
      return data
    },
    onSuccess: () => {
      toast.success('Moved', 'Applicant stage updated')
      queryClient.invalidateQueries({ queryKey: ['applicants'] })
    },
    onError: (e: unknown) => toast.error('Error', extractErrorMessage(e)),
  })

  const stages: Stage[] = stagesData?.records ?? []
  const applicants: Applicant[] = applicantsData?.records ?? []

  const columns: KanbanColumn[] = useMemo(
    () => stages.map((s) => ({ id: s.id, title: s.name, fold: s.fold })),
    [stages],
  )

  const cards: KanbanCardData[] = useMemo(
    () =>
      applicants.map((a) => {
        const stageId = Array.isArray(a.stage_id) ? a.stage_id[0] : (stages[0]?.id ?? 0)
        return {
          id: a.id,
          columnId: stageId,
          title: a.partner_name,
          subtitle: Array.isArray(a.job_id) ? a.job_id[1] : a.email_from || undefined,
          priority: parseInt(a.priority || '0') || 0,
          avatar: (a.partner_name || '?').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase(),
          badges: typeof a.salary_expected === 'number' ? [{ label: `$${a.salary_expected.toFixed(0)}`, variant: 'secondary' }] : [],
          onClick: () => navigate(`/admin/hr/recruitment/${a.id}`),
        }
      }),
    [applicants, stages, navigate],
  )

  if (stagesLoading || applicantsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-96 w-72 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recruitment"
        subtitle={`${applicants.length} active applicant${applicants.length !== 1 ? 's' : ''}`}
        onNew={() => navigate('/admin/hr/recruitment/new')}
      />

      <KanbanBoard
        columns={columns}
        cards={cards}
        onCardMove={(cardId, _from, to) => {
          moveMut.mutate({ applicantId: cardId, stageId: Number(to) })
        }}
        emptyState={
          <div className="text-center text-sm text-muted-foreground py-12">
            No applicants yet. Click <span className="font-medium">New</span> to create one.
          </div>
        }
      />
    </div>
  )
}
