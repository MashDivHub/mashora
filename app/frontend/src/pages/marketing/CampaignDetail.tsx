import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge, Button, Skeleton, Input, Label, Textarea, cn,
  Tabs, TabsList, TabsTrigger, TabsContent,
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
  type BadgeVariant,
} from '@mashora/design-system'
import {
  Mail, Save, Pencil, X, Send, TestTube, Calendar, XCircle, Plus, AlertCircle,
} from 'lucide-react'
import { PageHeader, M2OInput, toast } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { sanitizedHtml } from '@/lib/sanitize'
import { extractErrorMessage } from '@/lib/errors'

type M2OTuple = [number, string]

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
  contact_list_ids?: Array<[number, string]>

  schedule_date?: string | false
  body_html?: string
  create_date: string
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

const STATE_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  draft:    { label: 'Draft',    variant: 'secondary' },
  in_queue: { label: 'Queued',   variant: 'info' },
  sending:  { label: 'Sending',  variant: 'warning' },
  done:     { label: 'Sent',     variant: 'success' },
  cancel:   { label: 'Cancelled',variant: 'destructive' },
}

function StatCard({ label, value, colorClass }: { label: string; value: React.ReactNode; colorClass?: string }) {
  return (
    <div className="rounded-2xl border border-border/30 bg-card/50 p-6 flex flex-col gap-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('text-2xl font-bold', colorClass ?? '')}>{value}</p>
    </div>
  )
}

function fmtDate(dt: string | undefined | false) {
  if (!dt) return '—'
  try { return new Date(dt).toLocaleString() } catch { return String(dt) }
}

function dateTimeLocal(v: string | undefined | false): string {
  if (!v) return ''
  // Convert ERP datetime "YYYY-MM-DD HH:MM:SS" → "YYYY-MM-DDTHH:MM"
  const s = String(v).replace(' ', 'T')
  return s.length >= 16 ? s.slice(0, 16) : s
}

// ─── Send Test Dialog ───────────────────────────────────────────────────────

function SendTestDialog({
  open, onOpenChange, mailingId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  mailingId: number
}) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (open) setEmail('') }, [open])

  async function handleSend() {
    if (!email.trim()) { toast.error('Email required'); return }
    setBusy(true)
    try {
      await erpClient.raw.post(`/mailing/campaigns/${mailingId}/test`, { email_to: email.trim() })
      toast.success('Test sent', `Test email sent to ${email}`)
      onOpenChange(false)
    } catch (e: unknown) {
      toast.error('Send failed', extractErrorMessage(e))
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Test Email</DialogTitle>
          <DialogDescription>Send a preview of this campaign to a single email address.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="test-email">Email Address</Label>
          <Input
            id="test-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="test@example.com"
            autoFocus
            disabled={busy}
            onKeyDown={e => { if (e.key === 'Enter' && !busy) handleSend() }}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleSend} disabled={busy}>{busy ? 'Sending...' : 'Send Test'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Recipients Tags ────────────────────────────────────────────────────────

function RecipientsEditor({
  value, onChange, editing,
}: {
  value: Array<[number, string]>
  onChange: (v: Array<[number, string]>) => void
  editing: boolean
}) {
  const [picker, setPicker] = useState<M2OTuple | false>(false)

  function addList(v: unknown) {
    if (!Array.isArray(v) || v.length < 2 || typeof v[0] !== 'number' || typeof v[1] !== 'string') return
    const tuple: [number, string] = [v[0], v[1]]
    if (value.some(t => t[0] === tuple[0])) return
    onChange([...value, tuple])
    setPicker(false)
  }

  function removeList(id: number) {
    onChange(value.filter(t => Array.isArray(t) && t[0] !== id))
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Recipients (Mailing Lists)</p>
      <div className="flex flex-wrap items-center gap-2">
        {value.length === 0 && !editing && <span className="text-sm text-muted-foreground">No recipients</span>}
        {value.map((t) => Array.isArray(t) && (
          <Badge key={t[0]} variant="secondary" className="rounded-full px-3 py-1 gap-1.5">
            <span className="text-xs">{t[1]}</span>
            {editing && (
              <button
                onClick={() => removeList(t[0])}
                className="hover:text-destructive transition-colors"
                aria-label="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
      </div>
      {editing && (
        <div className="max-w-xs">
          <M2OInput
            value={picker}
            model="mailing.list"
            onChange={addList}
            placeholder="+ Add mailing list..."
          />
        </div>
      )}
    </div>
  )
}

// ─── Main ───────────────────────────────────────────────────────────────────

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const recordId = parseInt(id || '0')

  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [testOpen, setTestOpen] = useState(false)
  const [form, setForm] = useState({
    name: '',
    subject: '',
    email_from: '',
    body_html: '',
    schedule_date: '',
    contact_list_ids: [] as Array<[number, string]>,
  })

  const { data: mailing, isLoading: mailingLoading } = useQuery({
    queryKey: ['mailing', recordId],
    queryFn: async () => {
      const { data } = await erpClient.raw.get(`/mailing/campaigns/${recordId}`)
      return data as MailingDetail
    },
    enabled: !!recordId,
  })

  const { data: stats } = useQuery({
    queryKey: ['mailing-stats', recordId],
    queryFn: async () => {
      const { data } = await erpClient.raw.get(`/mailing/campaigns/${recordId}/stats`)
      return data as MailingStats
    },
    enabled: !!recordId,
  })

  useEffect(() => {
    if (mailing) {
      setForm({
        name: mailing.name || '',
        subject: mailing.subject || '',
        email_from: typeof mailing.email_from === 'string' ? mailing.email_from : '',
        body_html: mailing.body_html || '',
        schedule_date: dateTimeLocal(mailing.schedule_date),
        contact_list_ids: Array.isArray(mailing.contact_list_ids) ? mailing.contact_list_ids : [],
      })
    }
  }, [mailing])

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['mailing', recordId] })
    queryClient.invalidateQueries({ queryKey: ['mailing-stats', recordId] })
  }, [queryClient, recordId])

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    setBusy(true)
    try {
      const vals: Record<string, unknown> = {
        name: form.name.trim(),
        subject: form.subject.trim() || false,
        email_from: form.email_from.trim() || false,
        body_html: form.body_html || false,
        schedule_date: form.schedule_date ? form.schedule_date.replace('T', ' ') + ':00' : false,
      }
      // M2M: send list of ids
      vals.contact_list_ids = [[6, 0, form.contact_list_ids.map((t: unknown) => Array.isArray(t) ? t[0] : t).filter(Boolean)]]
      await erpClient.raw.put(`/mailing/campaigns/${recordId}`, vals)
      toast.success('Saved', 'Campaign updated')
      setEditing(false)
      refresh()
    } catch (e: unknown) {
      toast.error('Save failed', extractErrorMessage(e))
    } finally { setBusy(false) }
  }

  async function handleAction(action: 'schedule' | 'send' | 'cancel') {
    if (action === 'send' && !confirm('Send this campaign now to all recipients?')) return
    if (action === 'cancel' && !confirm('Cancel this scheduled campaign?')) return
    setBusy(true)
    try {
      await erpClient.raw.post(`/mailing/campaigns/${recordId}/${action}`)
      toast.success(action === 'send' ? 'Sending campaign' : action === 'schedule' ? 'Scheduled' : 'Cancelled')
      refresh()
    } catch (e: unknown) {
      toast.error('Action failed', extractErrorMessage(e))
    } finally { setBusy(false) }
  }

  if (mailingLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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

  const stateCfg = STATE_BADGE[mailing.state] ?? { label: mailing.state, variant: 'secondary' as BadgeVariant }
  const isDraft = mailing.state === 'draft'
  const isSent = mailing.state === 'done' || mailing.state === 'sending'
  const isScheduled = mailing.state === 'in_queue'

  // Stats numbers
  const sent       = Number(stats?.sent ?? mailing.sent ?? 0)
  const delivered  = Number(stats?.delivered ?? mailing.delivered ?? 0)
  const opened     = Number(stats?.opened ?? mailing.opened ?? 0)
  const bounced    = Number(stats?.bounced ?? mailing.bounced ?? 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title={form.name || mailing.name || 'Campaign'}
        backTo="/admin/email-marketing"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={stateCfg.variant}>{stateCfg.label}</Badge>
            {isDraft && (
              <>
                {editing ? (
                  <>
                    <Button size="sm" variant="ghost" className="rounded-xl gap-1.5" onClick={() => { setEditing(false); /* reset */ if (mailing) setForm({
                      name: mailing.name || '', subject: mailing.subject || '',
                      email_from: typeof mailing.email_from === 'string' ? mailing.email_from : '',
                      body_html: mailing.body_html || '',
                      schedule_date: dateTimeLocal(mailing.schedule_date),
                      contact_list_ids: Array.isArray(mailing.contact_list_ids) ? mailing.contact_list_ids : [],
                    }) }} disabled={busy}>
                      <X className="h-3.5 w-3.5" /> Discard
                    </Button>
                    <Button size="sm" className="rounded-xl gap-1.5" onClick={handleSave} disabled={busy}>
                      <Save className="h-3.5 w-3.5" /> {busy ? 'Saving...' : 'Save'}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="ghost" className="rounded-xl gap-1.5" onClick={() => setEditing(true)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={() => setTestOpen(true)}>
                      <TestTube className="h-3.5 w-3.5" /> Send Test
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={() => handleAction('schedule')} disabled={busy || !form.schedule_date}>
                      <Calendar className="h-3.5 w-3.5" /> Schedule
                    </Button>
                    <Button size="sm" className="rounded-xl gap-1.5" onClick={() => handleAction('send')} disabled={busy}>
                      <Send className="h-3.5 w-3.5" /> Send Now
                    </Button>
                  </>
                )}
              </>
            )}
            {isScheduled && (
              <Button size="sm" variant="ghost" className="rounded-xl gap-1.5 text-destructive" onClick={() => handleAction('cancel')} disabled={busy}>
                <XCircle className="h-3.5 w-3.5" /> Cancel
              </Button>
            )}
          </div>
        }
      />

      {/* Stats — only when sent / sending */}
      {(isSent || mailing.sent > 0) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Sent" value={sent.toLocaleString()} />
          <StatCard label="Delivered" value={delivered.toLocaleString()} />
          <StatCard label="Opened" value={opened.toLocaleString()} colorClass="text-emerald-400" />
          <StatCard
            label="Bounced"
            value={
              <span className="inline-flex items-center gap-2">
                {bounced > 5 && <AlertCircle className="h-5 w-5" aria-hidden="true" />}
                {bounced.toLocaleString()}
              </span>
            }
            colorClass={bounced > 5 ? 'text-red-400' : undefined}
          />
        </div>
      )}

      {/* Editor / Read-only form */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-5">
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-5">
          <Field label="Name" required>
            {editing ? (
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="rounded-xl h-9" />
            ) : (
              <span className="text-sm font-medium">{form.name || '—'}</span>
            )}
          </Field>
          <Field label="Subject (visible in inbox)">
            {editing ? (
              <Input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} className="rounded-xl h-9" />
            ) : (
              <span className="text-sm">{form.subject || '—'}</span>
            )}
          </Field>
          <Field label="From">
            {editing ? (
              <Input
                type="email"
                value={form.email_from}
                onChange={e => setForm(p => ({ ...p, email_from: e.target.value }))}
                className="rounded-xl h-9"
                placeholder="sender@example.com"
              />
            ) : (
              <span className="text-sm">{form.email_from || '—'}</span>
            )}
          </Field>
          <Field label="Schedule Date">
            {editing ? (
              <Input
                type="datetime-local"
                value={form.schedule_date}
                onChange={e => setForm(p => ({ ...p, schedule_date: e.target.value }))}
                className="rounded-xl h-9"
              />
            ) : (
              <span className="text-sm">{form.schedule_date ? fmtDate(form.schedule_date) : '—'}</span>
            )}
          </Field>
        </div>

        <div className="pt-3 border-t border-border/30">
          <RecipientsEditor
            value={form.contact_list_ids}
            onChange={v => setForm(p => ({ ...p, contact_list_ids: v }))}
            editing={editing}
          />
        </div>
      </div>

      {/* Body editor with side-by-side preview */}
      <div className="rounded-2xl border border-border/30 bg-card/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-border/30 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Email Body</h2>
          <span className="text-xs text-muted-foreground">{editing ? 'Edit HTML on the left, preview on the right' : 'Preview'}</span>
        </div>
        {editing ? (
          <div className="grid lg:grid-cols-2 gap-0">
            <div className="p-6 border-r border-border/30">
              <Label htmlFor="body-html" className="text-xs">HTML Source</Label>
              <Textarea
                id="body-html"
                value={form.body_html}
                onChange={e => setForm(p => ({ ...p, body_html: e.target.value }))}
                className="rounded-xl min-h-[400px] font-mono text-xs mt-2"
                placeholder="<p>Hello!</p>"
              />
            </div>
            <div className="p-6">
              <p className="text-xs text-muted-foreground mb-2">Preview</p>
              <div className="rounded-xl border border-border/40 bg-background p-4 min-h-[400px] overflow-auto">
                <div
                  className="prose dark:prose-invert max-w-none text-sm"
                  dangerouslySetInnerHTML={sanitizedHtml(form.body_html)}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6">
            {form.body_html ? (
              <div
                className="prose dark:prose-invert max-w-none text-sm"
                dangerouslySetInnerHTML={sanitizedHtml(form.body_html)}
              />
            ) : (
              <p className="text-sm text-muted-foreground italic">No content</p>
            )}
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6 grid md:grid-cols-2 gap-6 text-sm">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">Model</p>
          <p>{Array.isArray(mailing.mailing_model_id) ? mailing.mailing_model_id[1] : '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">Created</p>
          <p>{fmtDate(mailing.create_date)}</p>
        </div>
      </div>

      <SendTestDialog open={testOpen} onOpenChange={setTestOpen} mailingId={recordId} />
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </p>
      <div>{children}</div>
    </div>
  )
}
