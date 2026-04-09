import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import { LayoutTemplate } from 'lucide-react'
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
      />

      {records.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
          <LayoutTemplate className="h-10 w-10" />
          <p className="text-sm">No templates found</p>
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
                onClick={() => navigate(`/email-marketing/${tpl.id}`)}
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
