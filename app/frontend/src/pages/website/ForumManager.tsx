import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@mashora/design-system'
import { MessageSquare, Heart, FileText, Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface Forum {
  id: number
  name: string
  description: string | false
  total_posts: number
  total_favorites: number
  karma_count: number
}

interface ForumResponse {
  records: Forum[]
  total: number
}

function StatPill({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {icon}
      <span className="tabular-nums font-medium text-foreground">{value}</span>
      <span>{label}</span>
    </div>
  )
}

export default function ForumManager() {
  const navigate = useNavigate()
  const { data, isLoading, isError } = useQuery<ForumResponse>({
    queryKey: ['forum-list'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/forum.forum', {
        fields: ['id', 'name', 'description', 'total_posts', 'total_favorites', 'karma_count'],
        order: 'name asc',
        limit: 50,
      })
      return data
    },
  })

  if (isError) {
    return (
      <div className="space-y-4">
        <PageHeader title="Forums" subtitle="website" />
        <div className="rounded-2xl border border-border/30 bg-card/50 p-12 text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
          <p className="text-muted-foreground">Forum module not installed</p>
        </div>
      </div>
    )
  }

  const forums = data?.records ?? []

  return (
    <div className="space-y-4">
      <PageHeader
        title="Forums"
        subtitle="website"
        onNew={() => navigate('/admin/model/forum.forum/new')}
        newLabel="New Forum"
      />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/30 bg-card/50 p-5 h-32 animate-pulse" />
          ))}
        </div>
      ) : forums.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-12 text-center space-y-4">
          <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-primary">
            <MessageSquare className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">No forums yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Create your first forum to host community discussions and Q&amp;A.
            </p>
          </div>
          <Button onClick={() => navigate('/admin/model/forum.forum/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Create First Forum
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {forums.map((forum) => (
            <button
              type="button"
              key={forum.id}
              onClick={() => navigate(`/admin/model/forum.forum/${forum.id}`)}
              className="rounded-2xl border border-border/30 bg-card/50 p-5 hover:bg-card/80 hover:-translate-y-0.5 transition-all space-y-3 text-left w-full"
            >
              <h3 className="font-semibold text-sm">{forum.name}</h3>

              {forum.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{forum.description}</p>
              )}

              <div className="flex items-center gap-4 pt-1">
                <StatPill icon={<FileText className="h-3.5 w-3.5" />} value={forum.total_posts ?? 0}     label="posts" />
                <StatPill icon={<Heart className="h-3.5 w-3.5" />}    value={forum.total_favorites ?? 0} label="favorites" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
