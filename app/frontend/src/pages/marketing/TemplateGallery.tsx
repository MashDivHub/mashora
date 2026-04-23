import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Skeleton } from '@mashora/design-system'
import { LayoutTemplate, Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface MailingTemplate {
  id: number
  subject: string
  body_arch?: string
  preview?: string
  create_date: string
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

function fmtDate(dt: string | undefined) {
  if (!dt) return '—'
  try { return new Date(dt).toLocaleDateString() } catch { return dt }
}

export default function TemplateGallery() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['mailing-templates'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/mailing.mailing', {
        domain: [['state', '=', 'draft'], ['is_template', '=', true]],
        fields: ['id', 'subject', 'body_arch', 'create_date', 'preview'],
        order: 'create_date desc',
        limit: 50,
      })
      return data as { records: MailingTemplate[]; total: number }
    },
  })

  const records = data?.records ?? []
  const total   = data?.total ?? 0

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="grid md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email Templates"
        subtitle={total > 0 ? `${total} template${total !== 1 ? 's' : ''}` : undefined}
        onNew={() => navigate('/admin/model/mailing.mailing/new')}
        newLabel="New Template"
      />

      {records.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-12 text-center space-y-4">
          <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-primary">
            <LayoutTemplate className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">No email templates yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Create a reusable template so you can reuse the same design across campaigns.
            </p>
          </div>
          <Button onClick={() => navigate('/admin/model/mailing.mailing/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Create First Template
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {records.map(tpl => {
            const snippet = (() => {
              if (tpl.preview) return tpl.preview.slice(0, 100)
              if (tpl.body_arch) return stripHtml(tpl.body_arch).slice(0, 100)
              return ''
            })()

            return (
              <button
                key={tpl.id}
                onClick={() => navigate(`/admin/email-marketing/${tpl.id}`)}
                className="rounded-2xl border border-border/30 bg-card/50 p-5 hover:bg-muted/20 transition-all text-left space-y-2 w-full"
              >
                <p className="font-bold text-sm leading-snug">
                  {tpl.subject || '(No subject)'}
                </p>
                {snippet && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {snippet}
                    {snippet.length >= 100 ? '…' : ''}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground/60 pt-1">
                  Created {fmtDate(tpl.create_date)}
                </p>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
