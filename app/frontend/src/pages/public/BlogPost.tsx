import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { erpClient } from '@/lib/erp-api'
import { ArrowLeft } from 'lucide-react'
import { sanitizedHtml } from '@/lib/sanitize'

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>()
  const id = Number(slug)

  const { data: post, isLoading } = useQuery({
    queryKey: ['website', 'blog', 'post', id],
    queryFn: async () => {
      const { data } = await erpClient.raw.get(`/website/blog/posts/${id}`)
      return data
    },
    enabled: !!id && !isNaN(id),
  })

  if (isLoading) return <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10 text-muted-foreground">Loading...</div>
  if (!post) return <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">Post not found.</div>

  return (
    <article className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
      <Link to="/blog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"><ArrowLeft className="size-4" /> Back to blog</Link>
      <div className="text-xs text-muted-foreground mb-3">{post.published_date || post.create_date || ''}</div>
      <h1 className="text-4xl font-semibold tracking-tight mb-8">{post.name}</h1>
      {post.content && <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={sanitizedHtml(post.content)} />}
    </article>
  )
}
