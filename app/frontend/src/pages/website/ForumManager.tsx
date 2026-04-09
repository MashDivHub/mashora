import { useQuery } from '@tanstack/react-query'
import { MessageSquare, Heart, FileText } from 'lucide-react'
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
      <PageHeader title="Forums" subtitle="website" />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/30 bg-card/50 p-5 h-32 animate-pulse" />
          ))}
        </div>
      ) : forums.length === 0 ? (
        <div className="rounded-2xl border border-border/30 bg-card/50 p-12 text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
          <p className="text-muted-foreground">No forums found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {forums.map((forum) => (
            <div
              key={forum.id}
              className="rounded-2xl border border-border/30 bg-card/50 p-5 hover:bg-card/80 transition-colors space-y-3"
            >
              <h3 className="font-semibold text-sm">{forum.name}</h3>

              {forum.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{forum.description}</p>
              )}

              <div className="flex items-center gap-4 pt-1">
                <StatPill icon={<FileText className="h-3.5 w-3.5" />} value={forum.total_posts ?? 0}     label="posts" />
                <StatPill icon={<Heart className="h-3.5 w-3.5" />}    value={forum.total_favorites ?? 0} label="favorites" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
