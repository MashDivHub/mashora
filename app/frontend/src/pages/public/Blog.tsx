import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { erpClient } from '@/lib/erp-api'
import { Card, CardContent } from '@mashora/design-system'

export default function Blog() {
  const { data } = useQuery({
    queryKey: ['website', 'blog', 'posts'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.post('/website/blog/posts', { published: true, limit: 30, order: 'published_date desc' })
        return data.records || []
      } catch { return [] }
    },
  })

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-4xl font-semibold tracking-tight mb-10">Blog</h1>
      <div className="space-y-6">
        {(data || []).map((post: any) => (
          <Link key={post.id} to={`/blog/${post.id}`}>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="text-xs text-muted-foreground mb-2">{post.published_date || post.create_date || ''}</div>
                <h2 className="text-xl font-semibold mb-2">{post.name}</h2>
                <p className="text-muted-foreground line-clamp-2">{post.subtitle || post.teaser || ''}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
        {(!data || data.length === 0) && <div className="text-muted-foreground text-center py-12">No posts yet.</div>}
      </div>
    </div>
  )
}
