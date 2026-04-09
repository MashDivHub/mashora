import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, Skeleton } from '@mashora/design-system'
import { Tag } from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm border-b border-border/40 last:border-0">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BlogDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['blog-post', id],
    queryFn: async () => {
      const { data } = await erpClient.raw.get(`/website/blog/posts/${id}`)
      return data
    },
    enabled: !!id,
  })

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-64" />
        </div>
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <p className="text-sm font-medium text-muted-foreground">Blog post not found.</p>
      </div>
    )
  }

  const authorName   = Array.isArray(data.author_id) ? data.author_id[1] : '—'
  const categoryName = Array.isArray(data.blog_id)   ? data.blog_id[1]   : '—'
  const formattedDate = data.post_date
    ? new Date(data.post_date).toLocaleDateString(undefined, {
        year: 'month' in {} ? undefined : 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—'
  const hasTags = Array.isArray(data.tag_ids) && data.tag_ids.length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.name}
        subtitle="Blog"
        backTo="/website/blog"
      />

      {/* Info card — two columns */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
        <div className="grid gap-x-12 md:grid-cols-2">
          <div>
            <InfoRow label="Author">{authorName}</InfoRow>
            <InfoRow label="Category">{categoryName}</InfoRow>
            <InfoRow label="Date Published">{formattedDate}</InfoRow>
          </div>
          <div>
            <InfoRow label="Views">
              <span className="tabular-nums">{data.visits ?? 0}</span>
            </InfoRow>
            <InfoRow label="Status">
              {data.website_published ? (
                <Badge variant="success" className="rounded-full text-xs">Published</Badge>
              ) : (
                <Badge variant="secondary" className="rounded-full text-xs">Draft</Badge>
              )}
            </InfoRow>
          </div>
        </div>
      </div>

      {/* Content card */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
        <h2 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wide">Content</h2>
        <div
          className="prose dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: data.content || '' }}
        />
      </div>

      {/* Tags */}
      {hasTags && (
        <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Tags</h2>
          <div className="flex flex-wrap gap-2">
            {data.tag_ids.map((tag: any) => {
              const tagId   = Array.isArray(tag) ? tag[0] : tag
              const tagName = Array.isArray(tag) ? tag[1] : `Tag ${tag}`
              return (
                <Badge key={tagId} variant="secondary" className="rounded-full text-xs gap-1">
                  <Tag className="h-3 w-3" />
                  {tagName}
                </Badge>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
