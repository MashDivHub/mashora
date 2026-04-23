import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge, Button, Skeleton, Input, Label,
  Tabs, TabsList, TabsTrigger, TabsContent,
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@mashora/design-system'
import {
  ClipboardList, BarChart2, Plus, Trash2, GripVertical,
  Pencil, Check, X, PlayCircle, StopCircle, Layers, FileText,
} from 'lucide-react'
import { PageHeader, toast, LoadingState } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

interface SurveyDetailData {
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
  description?: string
  questions_layout?: string
}

interface Question {
  id: number
  survey_id: [number, string] | false | number
  title: string
  sequence: number
  question_type: string
  is_page: boolean
}

interface QuestionAnswer {
  id: number
  question_id: [number, string] | false | number
  value: string
  sequence: number
}

const QUESTION_TYPES = [
  { value: 'char_box', label: 'Single Line Text' },
  { value: 'text_box', label: 'Multi-line Text' },
  { value: 'numerical_box', label: 'Numerical' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date & Time' },
  { value: 'simple_choice', label: 'Single Choice' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'matrix', label: 'Matrix' },
]

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

const QUESTION_FIELDS = ['id', 'survey_id', 'title', 'sequence', 'question_type', 'is_page']
const ANSWER_FIELDS = ['id', 'question_id', 'value', 'sequence']

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

function isChoice(qType: string) {
  return qType === 'simple_choice' || qType === 'multiple_choice'
}

// ─── Add Question Dialog ────────────────────────────────────────────────────

function AddQuestionDialog({
  open, onOpenChange, surveyId, nextSequence, onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  surveyId: number
  nextSequence: number
  onCreated: () => void
}) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState('char_box')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) { setTitle(''); setType('char_box') }
  }, [open])

  async function handleCreate() {
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }
    setBusy(true)
    try {
      await erpClient.raw.post('/model/survey.question/create', {
        vals: {
          survey_id: surveyId,
          title: title.trim(),
          question_type: type,
          sequence: nextSequence,
          is_page: false,
        },
      })
      toast.success('Question added')
      onOpenChange(false)
      onCreated()
    } catch (e: unknown) {
      toast.error('Failed to add question', extractErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Question</DialogTitle>
          <DialogDescription>Create a new question in this survey.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="q-title">Question Title</Label>
            <Input
              id="q-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What would you like to ask?"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="q-type">Question Type</Label>
            <select
              id="q-type"
              value={type}
              onChange={e => setType(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {QUESTION_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleCreate} disabled={busy}>{busy ? 'Adding...' : 'Add Question'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Question Row (with inline editor) ──────────────────────────────────────

function QuestionRow({ q, onChanged }: { q: Question; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(q.title)
  const [type, setType] = useState(q.question_type)
  const [seq, setSeq] = useState(q.sequence)
  const [busy, setBusy] = useState(false)
  const [showAnswers, setShowAnswers] = useState(false)

  useEffect(() => {
    setTitle(q.title)
    setType(q.question_type)
    setSeq(q.sequence)
  }, [q])

  async function handleSave() {
    setBusy(true)
    try {
      await erpClient.raw.put(`/model/survey.question/${q.id}`, {
        vals: { title: title.trim(), question_type: type, sequence: seq },
      })
      toast.success('Question updated')
      setEditing(false)
      onChanged()
    } catch (e: unknown) {
      toast.error('Update failed', extractErrorMessage(e))
    } finally { setBusy(false) }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${q.title}"?`)) return
    setBusy(true)
    try {
      await erpClient.raw.delete(`/model/survey.question/${q.id}`)
      toast.success('Question deleted')
      onChanged()
    } catch (e: unknown) {
      toast.error('Delete failed', extractErrorMessage(e))
    } finally { setBusy(false) }
  }

  if (q.is_page) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 group">
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
        <Layers className="h-4 w-4 text-primary" />
        {editing ? (
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="rounded-xl h-9 flex-1 max-w-md font-semibold"
            autoFocus
          />
        ) : (
          <span className="font-semibold text-sm flex-1">{q.title}</span>
        )}
        <Badge variant="secondary" className="text-[10px]">SECTION</Badge>
        <span className="text-xs text-muted-foreground font-mono">#{q.sequence}</span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {editing ? (
            <>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" onClick={() => setEditing(false)}><X className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" onClick={handleSave} disabled={busy}><Check className="h-4 w-4" /></Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg text-destructive" onClick={handleDelete} disabled={busy}><Trash2 className="h-3.5 w-3.5" /></Button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border/30 bg-card/40 hover:bg-card/60 transition-colors group">
      <div className="flex items-center gap-3 px-4 py-3">
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
        <FileText className="h-4 w-4 text-muted-foreground" />
        {editing ? (
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="rounded-xl h-9 flex-1 max-w-md"
            autoFocus
          />
        ) : (
          <span className="text-sm flex-1">{q.title}</span>
        )}
        {editing ? (
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            className="h-9 rounded-xl border border-input bg-background px-2 text-xs"
          >
            {QUESTION_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <Badge variant="secondary" className="text-[10px]">
            {QUESTION_TYPES.find(o => o.value === q.question_type)?.label ?? q.question_type}
          </Badge>
        )}
        {editing ? (
          <Input
            type="number"
            value={seq}
            onChange={e => setSeq(Number(e.target.value))}
            className="rounded-xl h-9 w-16 font-mono"
          />
        ) : (
          <span className="text-xs text-muted-foreground font-mono">#{q.sequence}</span>
        )}
        <div className="flex items-center gap-1">
          {isChoice(q.question_type) && !editing && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 rounded-lg text-xs"
              onClick={() => setShowAnswers(s => !s)}
            >
              {showAnswers ? 'Hide' : 'Choices'}
            </Button>
          )}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            {editing ? (
              <>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" onClick={() => setEditing(false)}><X className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" onClick={handleSave} disabled={busy}><Check className="h-4 w-4" /></Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg text-destructive" onClick={handleDelete} disabled={busy}><Trash2 className="h-3.5 w-3.5" /></Button>
              </>
            )}
          </div>
        </div>
      </div>
      {showAnswers && isChoice(q.question_type) && (
        <ChoiceEditor questionId={q.id} />
      )}
    </div>
  )
}

// ─── Choice Editor (for simple_choice / multiple_choice) ────────────────────

function ChoiceEditor({ questionId }: { questionId: number }) {
  const queryClient = useQueryClient()
  const [newValue, setNewValue] = useState('')
  const [busy, setBusy] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['survey-answers', questionId],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/survey.question.answer', {
        domain: [['question_id', '=', questionId]],
        fields: ANSWER_FIELDS,
        order: 'sequence asc, id asc',
        limit: 100,
      })
      return data as { records: QuestionAnswer[] }
    },
  })

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['survey-answers', questionId] })
  }

  async function addAnswer() {
    if (!newValue.trim()) return
    setBusy(true)
    try {
      const nextSeq = (data?.records?.length ?? 0) + 1
      await erpClient.raw.post('/model/survey.question.answer/create', {
        vals: {
          question_id: questionId,
          value: newValue.trim(),
          sequence: nextSeq * 10,
        },
      })
      setNewValue('')
      refresh()
    } catch (e: unknown) {
      toast.error('Failed to add choice', extractErrorMessage(e))
    } finally { setBusy(false) }
  }

  async function deleteAnswer(id: number) {
    setBusy(true)
    try {
      await erpClient.raw.delete(`/model/survey.question.answer/${id}`)
      refresh()
    } catch (e: unknown) {
      toast.error('Delete failed', extractErrorMessage(e))
    } finally { setBusy(false) }
  }

  return (
    <div className="border-t border-border/30 px-4 py-3 space-y-2 bg-muted/20">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Choices</p>
      {isLoading ? (
        <LoadingState label="Loading choices..." className="py-4" />
      ) : (
        <div className="space-y-1.5">
          {(data?.records || []).map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 px-2 py-1 rounded-lg bg-background border border-border/40">{a.value}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 rounded-lg text-destructive"
                onClick={() => {
                  if (!window.confirm(`Delete "${a.value}"? This action cannot be undone.`)) return
                  deleteAnswer(a.id)
                }}
                disabled={busy}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 pt-1">
        <Input
          value={newValue}
          onChange={e => setNewValue(e.target.value)}
          placeholder="Add a choice..."
          aria-label="New answer choice"
          className="rounded-xl h-8 text-sm flex-1"
          disabled={busy}
          onKeyDown={e => { if (e.key === 'Enter' && !busy) addAnswer() }}
        />
        <Button size="sm" variant="outline" className="rounded-xl h-8 gap-1.5" onClick={addAnswer} disabled={busy || !newValue.trim()}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
    </div>
  )
}

// ─── Designer Tab ───────────────────────────────────────────────────────────

function DesignerTab({ surveyId }: { surveyId: number }) {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['survey-questions', surveyId],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/survey.question', {
        domain: [['survey_id', '=', surveyId]],
        fields: QUESTION_FIELDS,
        order: 'sequence asc, id asc',
        limit: 500,
      })
      return data as { records: Question[] }
    },
  })

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['survey-questions', surveyId] })
  }

  const questions = data?.records || []
  const nextSequence = (questions.reduce((max, q) => Math.max(max, q.sequence), 0) || 0) + 10

  async function addSection() {
    const title = prompt('Section title:')
    if (!title?.trim()) return
    try {
      await erpClient.raw.post('/model/survey.question/create', {
        vals: {
          survey_id: surveyId,
          title: title.trim(),
          is_page: true,
          question_type: 'char_box',
          sequence: nextSequence,
        },
      })
      toast.success('Section added')
      refresh()
    } catch (e: unknown) {
      toast.error('Failed to add section', extractErrorMessage(e))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Questions</h2>
          <Badge variant="secondary" className="text-xs">{questions.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={addSection}>
            <Layers className="h-3.5 w-3.5" /> Add Section
          </Button>
          <Button size="sm" className="rounded-xl gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Question
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : questions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/40 px-6 py-12 text-center">
          <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground mb-4">No questions yet. Start building your survey.</p>
          <Button size="sm" className="rounded-xl gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add First Question
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map(q => <QuestionRow key={q.id} q={q} onChanged={refresh} />)}
        </div>
      )}

      <AddQuestionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        surveyId={surveyId}
        nextSequence={nextSequence}
        onCreated={refresh}
      />
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function SurveyDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const surveyId = parseInt(id || '0')
  const [tab, setTab] = useState('overview')

  const { data: survey, isLoading } = useQuery({
    queryKey: ['survey', id],
    queryFn: async () => {
      const { data } = await erpClient.raw.get(`/surveys/${id}`)
      return data as SurveyDetailData
    },
    enabled: !!id,
  })

  const callAction = useCallback(async (action: 'start' | 'close') => {
    try {
      await erpClient.raw.post(`/surveys/${surveyId}/${action}`)
      toast.success(`Survey ${action === 'start' ? 'opened' : 'closed'}`)
      queryClient.invalidateQueries({ queryKey: ['survey', id] })
    } catch (e: unknown) {
      toast.error('Action failed', extractErrorMessage(e))
    }
  }, [surveyId, id, queryClient])

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
        backTo="/admin/surveys"
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={STATE_VARIANT[survey.state] ?? 'secondary'} className="rounded-full px-3 text-sm">
              {STATE_LABEL[survey.state] ?? survey.state}
            </Badge>
            {survey.state === 'draft' && (
              <Button size="sm" className="rounded-xl gap-1.5" onClick={() => callAction('start')}>
                <PlayCircle className="h-3.5 w-3.5" /> Start
              </Button>
            )}
            {survey.state === 'open' && (
              <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={() => callAction('close')}>
                <StopCircle className="h-3.5 w-3.5" /> Close
              </Button>
            )}
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="designer">Designer</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-6">
          <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
            <div className="grid md:grid-cols-2 gap-x-12 gap-y-5">
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
              onClick={() => navigate(`/admin/surveys/${id}/responses`)}
            >
              <BarChart2 className="h-3.5 w-3.5" />
              View Responses
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="designer" className="mt-4">
          <DesignerTab surveyId={surveyId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
