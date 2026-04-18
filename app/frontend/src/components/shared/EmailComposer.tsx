import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Input, Label, Textarea, Badge, cn,
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@mashora/design-system'
import { Send, Paperclip, X, Eye, Code } from 'lucide-react'
import { toast } from './Toast'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'
import { sanitizedHtml } from '@/lib/sanitize'

export interface EmailComposerProps {
  open: boolean
  onClose: () => void
  /** Source model — used for template filtering and attachment linkage. */
  resModel?: string
  /** Source record id. */
  resId?: number
  defaultSubject?: string
  defaultBody?: string
  defaultTo?: string[]
  /** Backend endpoint to POST to. Defaults to `/email/send`. */
  endpoint?: string
  onSent?: () => void
}

type Recipients = { to: string[]; cc: string[]; bcc: string[] }

type RecipientTab = keyof Recipients

const TABS: { key: RecipientTab; label: string }[] = [
  { key: 'to', label: 'To' },
  { key: 'cc', label: 'Cc' },
  { key: 'bcc', label: 'Bcc' },
]

export default function EmailComposer({
  open, onClose, resModel, resId,
  defaultSubject = '', defaultBody = '', defaultTo = [],
  endpoint = '/email/send',
  onSent,
}: EmailComposerProps) {
  const [activeTab, setActiveTab] = useState<RecipientTab>('to')
  const [recipients, setRecipients] = useState<Recipients>({ to: [], cc: [], bcc: [] })
  const [tagDraft, setTagDraft] = useState<Record<RecipientTab, string>>({ to: '', cc: '', bcc: '' })
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [templateId, setTemplateId] = useState<string>('')
  const [sending, setSending] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset on open
  useEffect(() => {
    if (!open) return
    setRecipients({ to: [...(defaultTo || [])], cc: [], bcc: [] })
    setSubject(defaultSubject || '')
    setBody(defaultBody || '')
    setTagDraft({ to: '', cc: '', bcc: '' })
    setFiles([])
    setTemplateId('')
    setShowPreview(false)
    setActiveTab('to')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Templates for this model.
  const { data: templates = [] } = useQuery({
    queryKey: ['mail-templates', resModel],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.post('/model/mail.template', {
          domain: resModel ? [['model', '=', resModel]] : [],
          fields: ['id', 'name', 'subject', 'body_html', 'model'],
          limit: 50,
          order: 'name asc',
        })
        return (data?.records || []) as Array<{ id: number; name: string; subject?: string; body_html?: string }>
      } catch {
        return []
      }
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })

  const applyTemplate = useCallback((id: string) => {
    setTemplateId(id)
    if (!id) return
    const tpl = templates.find(t => String(t.id) === id)
    if (!tpl) return
    if (tpl.subject) setSubject(tpl.subject)
    if (tpl.body_html) setBody(tpl.body_html)
  }, [templates])

  // ── Recipient chip helpers ───────────────────────────────────────────
  const commitTag = useCallback((tab: RecipientTab) => {
    const raw = tagDraft[tab].trim().replace(/[,;]+$/, '').trim()
    if (!raw) return
    // Allow comma/semicolon separated
    const tokens = raw.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean)
    setRecipients(prev => {
      const next = new Set([...prev[tab], ...tokens])
      return { ...prev, [tab]: Array.from(next) }
    })
    setTagDraft(prev => ({ ...prev, [tab]: '' }))
  }, [tagDraft])

  const removeTag = useCallback((tab: RecipientTab, addr: string) => {
    setRecipients(prev => ({ ...prev, [tab]: prev[tab].filter(a => a !== addr) }))
  }, [])

  const onTagKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, tab: RecipientTab) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';' || e.key === 'Tab') {
      if (tagDraft[tab].trim()) {
        e.preventDefault()
        commitTag(tab)
      }
    } else if (e.key === 'Backspace' && !tagDraft[tab]) {
      // Pop last chip
      setRecipients(prev => {
        if (prev[tab].length === 0) return prev
        const copy = [...prev[tab]]
        copy.pop()
        return { ...prev, [tab]: copy }
      })
    }
  }, [tagDraft, commitTag])

  // ── Attachments ───────────────────────────────────────────────────────
  const onPickFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files
    if (!list) return
    const arr = Array.from(list)
    setFiles(prev => [...prev, ...arr])
    e.target.value = ''
  }, [])

  const removeFile = useCallback((i: number) => {
    setFiles(prev => prev.filter((_, idx) => idx !== i))
  }, [])

  // ── Send ──────────────────────────────────────────────────────────────
  const totalRecipients = useMemo(
    () => recipients.to.length + recipients.cc.length + recipients.bcc.length,
    [recipients],
  )

  const handleSend = async () => {
    // Commit any pending tag drafts first.
    for (const tab of ['to', 'cc', 'bcc'] as RecipientTab[]) {
      if (tagDraft[tab].trim()) commitTag(tab)
    }
    // After commits, recompute from local state — but state updates are async,
    // so resolve from latest input values inline:
    const finalRecipients: Recipients = {
      to: [...recipients.to, ...(tagDraft.to.trim() ? tagDraft.to.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean) : [])],
      cc: [...recipients.cc, ...(tagDraft.cc.trim() ? tagDraft.cc.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean) : [])],
      bcc: [...recipients.bcc, ...(tagDraft.bcc.trim() ? tagDraft.bcc.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean) : [])],
    }

    if (finalRecipients.to.length === 0) {
      toast.error('Validation', 'At least one "To" recipient is required.')
      return
    }
    if (!subject.trim()) {
      toast.error('Validation', 'Subject is required.')
      return
    }

    setSending(true)
    try {
      // Upload attachments first to get ir.attachment IDs.
      const attachmentIds: number[] = []
      for (const file of files) {
        const fd = new FormData()
        fd.append('file', file)
        if (resModel) fd.append('res_model', resModel)
        if (resId) fd.append('res_id', String(resId))
        try {
          const { data } = await erpClient.raw.post('/attachments/upload', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          if (data?.id) attachmentIds.push(data.id)
        } catch {
          toast.error('Upload Failed', `Could not upload ${file.name}`)
          setSending(false)
          return
        }
      }

      const payload: Record<string, any> = {
        to: finalRecipients.to,
        cc: finalRecipients.cc.length ? finalRecipients.cc : undefined,
        bcc: finalRecipients.bcc.length ? finalRecipients.bcc : undefined,
        subject,
        body_html: body,
        model: resModel,
        res_id: resId,
        attachment_ids: attachmentIds.length ? attachmentIds : undefined,
      }

      await erpClient.raw.post(endpoint, payload)
      toast.success('Email Sent', `Sent to ${finalRecipients.to.length} recipient(s)`)
      onSent?.()
      onClose()
    } catch (e: unknown) {
      toast.error('Send Failed', extractErrorMessage(e, 'Unknown error'))
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && !sending && onClose()}>
      <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" /> Compose Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Template selector */}
          {templates.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">Template</Label>
              <Select value={templateId} onValueChange={applyTemplate}>
                <SelectTrigger className="rounded-xl h-9 mt-1">
                  <SelectValue placeholder="Choose a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Recipients tabs */}
          <div>
            <div className="flex items-center gap-1 mb-1.5">
              {TABS.map(t => {
                const count = recipients[t.key].length
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setActiveTab(t.key)}
                    className={cn(
                      'rounded-lg px-2.5 py-0.5 text-xs font-medium transition-colors',
                      activeTab === t.key
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {t.label}{count > 0 && <span className="ml-1 opacity-70">({count})</span>}
                  </button>
                )
              })}
            </div>
            <div className="rounded-xl border border-input bg-background p-2 flex flex-wrap items-center gap-1.5 min-h-[40px]">
              {recipients[activeTab].map(addr => (
                <Badge key={addr} variant="secondary" className="rounded-full text-xs gap-1 pl-2 pr-1">
                  {addr}
                  <button
                    type="button"
                    onClick={() => removeTag(activeTab, addr)}
                    className="ml-0.5 rounded-full hover:bg-background/40 p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <input
                value={tagDraft[activeTab]}
                onChange={e => setTagDraft(prev => ({ ...prev, [activeTab]: e.target.value }))}
                onKeyDown={e => onTagKeyDown(e, activeTab)}
                onBlur={() => tagDraft[activeTab].trim() && commitTag(activeTab)}
                placeholder={recipients[activeTab].length === 0 ? 'Type email and press Enter...' : ''}
                className="flex-1 min-w-[140px] bg-transparent text-sm outline-none px-1"
              />
            </div>
          </div>

          {/* Subject */}
          <div>
            <Label htmlFor="ec-subject" className="text-xs text-muted-foreground">Subject</Label>
            <Input
              id="ec-subject"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="rounded-xl h-9 mt-1"
              placeholder="Email subject"
            />
          </div>

          {/* Body editor / preview */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs text-muted-foreground">Message</Label>
              <button
                type="button"
                onClick={() => setShowPreview(p => !p)}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                {showPreview ? <><Code className="h-3 w-3" /> Edit</> : <><Eye className="h-3 w-3" /> Preview</>}
              </button>
            </div>
            {showPreview ? (
              <div
                className="rounded-xl border border-input bg-background min-h-[180px] p-3 text-sm prose prose-sm dark:prose-invert max-w-none overflow-auto"
                dangerouslySetInnerHTML={sanitizedHtml(body || '<p class="text-muted-foreground">No content</p>')}
              />
            ) : (
              <Textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={8}
                className="rounded-xl resize-y font-mono text-xs"
                placeholder="<p>Your message here...</p>"
              />
            )}
          </div>

          {/* Attachments */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs text-muted-foreground">Attachments {files.length > 0 && `(${files.length})`}</Label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <Paperclip className="h-3 w-3" /> Attach files
              </button>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onPickFiles} />
            </div>
            {files.length > 0 && (
              <div className="space-y-1">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/30 px-2.5 py-1.5 text-xs">
                    <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1" title={f.name}>{f.name}</span>
                    <span className="text-muted-foreground tabular-nums shrink-0">{(f.size / 1024).toFixed(1)} KB</span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} className="rounded-xl" disabled={sending}>Cancel</Button>
          <Button
            onClick={handleSend}
            className="rounded-xl gap-1.5"
            disabled={sending || totalRecipients === 0 && !tagDraft.to.trim()}
          >
            <Send className="h-3.5 w-3.5" /> {sending ? 'Sending...' : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
