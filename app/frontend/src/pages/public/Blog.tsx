import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Input, Skeleton } from '@mashora/design-system'
import { ArrowRight, Calendar, Clock, Mail, Search } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'
import { toast } from '@/components/shared'
import { extractErrorMessage } from '@/lib/errors'

type BlogPost = {
  id: number
  name: string
  subtitle?: string | false
  teaser?: string | false
  published_date?: string | false
  create_date?: string | false
  author_id?: [number, string] | false
  cover_image?: string | false
  cover_image_url?: string
  category_id?: [number, string] | false
}

type BlogCategory = {
  id: number
  name: string
}

const PAGE_SIZE = 9

const GRADIENT_PALETTE = [
  'from-primary/30 via-primary/10 to-accent/20',
  'from-accent/30 via-accent/10 to-primary/20',
  'from-emerald-500/30 via-emerald-500/10 to-teal-500/20',
  'from-rose-500/30 via-rose-500/10 to-amber-500/20',
  'from-sky-500/30 via-sky-500/10 to-indigo-500/20',
  'from-violet-500/30 via-violet-500/10 to-fuchsia-500/20',
  'from-amber-500/30 via-amber-500/10 to-rose-500/20',
  'from-cyan-500/30 via-cyan-500/10 to-blue-500/20',
]

function hashGradient(key: string): string {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0
  const idx = Math.abs(hash) % GRADIENT_PALETTE.length
  return GRADIENT_PALETTE[idx]
}

function formatDate(value?: string | false): string {
  if (!value) return ''
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return String(value)
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return String(value)
  }
}

function readTime(post: BlogPost): string {
  const text = (typeof post.teaser === 'string' ? post.teaser : '') +
    ' ' + (typeof post.subtitle === 'string' ? post.subtitle : '')
  const words = text.trim().split(/\s+/).filter(Boolean).length
  // Fallback: pseudo-random between 4 and 8 based on id
  const minutes = words > 0 ? Math.max(3, Math.round(words / 40)) : 4 + (post.id % 5)
  return `${minutes} min read`
}

function authorInitials(post: BlogPost): string {
  const name = Array.isArray(post.author_id) ? post.author_id[1] : 'Mashora'
  const parts = name.split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? 'M'
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

function authorName(post: BlogPost): string {
  return Array.isArray(post.author_id) ? post.author_id[1] : 'Mashora Team'
}

function categoryLabel(post: BlogPost): string {
  return Array.isArray(post.category_id) ? post.category_id[1] : 'General'
}

function CoverPlaceholder({ post, className = '' }: { post: BlogPost; className?: string }) {
  const gradient = hashGradient(post.name || String(post.id))
  const initial = (categoryLabel(post)[0] || 'M').toUpperCase()
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br ${gradient} ${className}`}>
      <span className="text-6xl font-semibold tracking-tight text-foreground/20 select-none">{initial}</span>
    </div>
  )
}

function resolveCoverSrc(post: BlogPost): string | null {
  if (typeof post.cover_image === 'string' && post.cover_image) {
    return post.cover_image.startsWith('data:') || post.cover_image.startsWith('http')
      ? post.cover_image
      : `data:image/png;base64,${post.cover_image}`
  }
  if (post.cover_image_url) return post.cover_image_url
  return null
}

function PostCover({ post, className = '', imgClass = '' }: { post: BlogPost; className?: string; imgClass?: string }) {
  const src = resolveCoverSrc(post)
  const [errored, setErrored] = useState(false)
  if (src && !errored) {
    return (
      <div className={`overflow-hidden bg-muted ${className}`}>
        <img
          src={src}
          alt={post.name}
          className={`h-full w-full object-cover ${imgClass}`}
          onError={() => setErrored(true)}
        />
      </div>
    )
  }
  return <CoverPlaceholder post={post} className={className} />
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden border border-border/40 bg-card">
      <Skeleton className="aspect-video w-full" />
      <div className="p-6 space-y-3">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  )
}

export default function Blog() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [email, setEmail] = useState('')

  const activeCategory = searchParams.get('category')
  const activeCategoryId = activeCategory ? Number(activeCategory) : null

  const { data: categories } = useQuery<BlogCategory[]>({
    queryKey: ['website', 'blog', 'categories'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.get('/website/blog/categories')
        return (data?.records || data || []) as BlogCategory[]
      } catch {
        return []
      }
    },
  })

  const { data, isLoading } = useQuery<BlogPost[]>({
    queryKey: ['website', 'blog', 'posts', activeCategoryId],
    queryFn: async () => {
      try {
        const payload: Record<string, unknown> = {
          published: true,
          limit: 60,
          offset: 0,
          order: 'published_date desc',
        }
        if (activeCategoryId) payload.category_id = activeCategoryId
        const { data } = await erpClient.raw.post('/website/blog/posts', payload)
        return (data?.records || []) as BlogPost[]
      } catch {
        return []
      }
    },
  })

  const posts = data || []

  const filteredPosts = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return posts
    return posts.filter(p => {
      const name = p.name?.toLowerCase() || ''
      const subtitle = typeof p.subtitle === 'string' ? p.subtitle.toLowerCase() : ''
      const teaser = typeof p.teaser === 'string' ? p.teaser.toLowerCase() : ''
      return name.includes(term) || subtitle.includes(term) || teaser.includes(term)
    })
  }, [posts, query])

  const featured = filteredPosts[0]
  const rest = filteredPosts.slice(1)
  const paginated = rest.slice(0, visible)
  const hasMore = paginated.length < rest.length

  function handleCategory(id: number | null) {
    const next = new URLSearchParams(searchParams)
    if (id === null) next.delete('category')
    else next.set('category', String(id))
    setSearchParams(next, { replace: true })
    setVisible(PAGE_SIZE)
  }

  const [submitting, setSubmitting] = useState(false)

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault()
    const clean = email.trim()
    if (!clean || !clean.includes('@')) {
      toast.error('Enter a valid email')
      return
    }
    setSubmitting(true)
    try {
      await erpClient.raw.post('/website/newsletter/subscribe', { email: clean })
      toast.success('Subscribed!', 'Thanks for joining our newsletter.')
      setEmail('')
    } catch (err) {
      toast.error('Subscription failed', extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center rounded-full border border-border/50 bg-background/60 backdrop-blur px-3 py-1 text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            The Journal
          </div>
          <h1 className="mt-5 text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
            Stories, insights, and updates
          </h1>
          <p className="mt-5 max-w-2xl mx-auto text-lg text-muted-foreground leading-relaxed">
            Deep dives on product, engineering, and the craft of running a modern business — from the people building Mashora.
          </p>
          <form
            onSubmit={e => { e.preventDefault() }}
            className="mt-8 max-w-xl mx-auto relative"
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search stories..."
              className="h-12 pl-11 rounded-full bg-background/70 backdrop-blur border-border/50 text-base"
            />
          </form>
        </div>
      </section>

      {/* Category chips */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pt-10">
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
          <button
            type="button"
            onClick={() => handleCategory(null)}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors ${
              activeCategoryId === null
                ? 'border-foreground bg-foreground text-background'
                : 'border-border/60 bg-background hover:border-foreground/50'
            }`}
          >
            All
          </button>
          {(categories || []).map(cat => {
            const active = activeCategoryId === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategory(cat.id)}
                className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors ${
                  active
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border/60 bg-background hover:border-foreground/50'
                }`}
              >
                {cat.name}
              </button>
            )
          })}
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pt-10">
        {isLoading ? (
          <div className="rounded-3xl overflow-hidden border border-border/40 bg-card grid md:grid-cols-2">
            <Skeleton className="aspect-[16/10] md:aspect-auto md:h-full w-full" />
            <div className="p-10 space-y-4">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-10 w-5/6" />
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          </div>
        ) : featured ? (
          <Link
            to={`/blog/${featured.id}`}
            className="group block rounded-3xl overflow-hidden bg-card border border-border/40 transition-all hover:shadow-xl hover:border-border"
          >
            <div className="grid md:grid-cols-2">
              <PostCover post={featured} className="aspect-[16/10] md:aspect-auto md:h-full" imgClass="transition-transform duration-500 group-hover:scale-[1.02]" />
              <div className="p-8 sm:p-10 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <span className="inline-flex items-center rounded-full border border-border/60 px-3 py-1 text-[11px] text-foreground/80">
                    {categoryLabel(featured)}
                  </span>
                  <span className="text-[11px] tracking-[0.18em]">Featured</span>
                </div>
                <h2 className="mt-5 text-3xl sm:text-4xl font-semibold tracking-tight leading-tight group-hover:text-primary transition-colors">
                  {featured.name}
                </h2>
                {(featured.subtitle || featured.teaser) && (
                  <p className="mt-4 text-lg text-muted-foreground leading-relaxed line-clamp-3">
                    {(typeof featured.subtitle === 'string' && featured.subtitle) ||
                      (typeof featured.teaser === 'string' && featured.teaser) ||
                      ''}
                  </p>
                )}
                <div className="mt-6 flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-full bg-gradient-to-br from-primary/40 to-accent/40 flex items-center justify-center text-[11px] font-semibold text-foreground/80">
                      {authorInitials(featured)}
                    </div>
                    <span className="text-foreground font-medium">{authorName(featured)}</span>
                  </div>
                  <span className="inline-flex items-center gap-1"><Calendar className="size-3.5" /> {formatDate(featured.published_date || featured.create_date)}</span>
                  <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> {readTime(featured)}</span>
                </div>
                <span className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                  Read the story <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </div>
          </Link>
        ) : null}
      </section>

      {/* Posts grid */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : paginated.length > 0 ? (
          <>
            <div className="flex items-baseline justify-between mb-8">
              <h2 className="text-2xl font-semibold tracking-tight">Latest stories</h2>
              <span className="text-sm text-muted-foreground">{rest.length} {rest.length === 1 ? 'story' : 'stories'}</span>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {paginated.map(post => (
                <Link
                  key={post.id}
                  to={`/blog/${post.id}`}
                  className="group rounded-2xl overflow-hidden border border-border/40 bg-card transition-all hover:-translate-y-1 hover:shadow-lg cursor-pointer flex flex-col"
                >
                  <PostCover post={post} className="aspect-video" imgClass="transition-transform duration-500 group-hover:scale-[1.03]" />
                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-flex items-center rounded-full border border-border/60 px-2.5 py-0.5 text-[11px] font-medium text-foreground/80">
                        {categoryLabel(post)}
                      </span>
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <Clock className="size-3" /> {readTime(post)}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {post.name}
                    </h3>
                    {(post.subtitle || post.teaser) && (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                        {(typeof post.subtitle === 'string' && post.subtitle) ||
                          (typeof post.teaser === 'string' && post.teaser) ||
                          ''}
                      </p>
                    )}
                    <div className="mt-6 pt-5 border-t border-border/40 flex items-center gap-3">
                      <div className="size-8 rounded-full bg-gradient-to-br from-primary/40 to-accent/40 flex items-center justify-center text-[11px] font-semibold text-foreground/80">
                        {authorInitials(post)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{authorName(post)}</div>
                        <div className="text-[11px] text-muted-foreground">{formatDate(post.published_date || post.create_date)}</div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {hasMore && (
              <div className="mt-12 flex justify-center">
                <Button variant="outline" onClick={() => setVisible(v => v + PAGE_SIZE)} className="rounded-full px-6">
                  Load more stories
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-3xl border border-dashed border-border/50 py-20 flex flex-col items-center justify-center text-center">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Search className="size-5 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No stories found</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              {query ? 'Try a different search term or clear the filters.' : 'Check back soon — we are working on something great.'}
            </p>
            {(query || activeCategoryId) && (
              <Button
                variant="outline"
                className="mt-6 rounded-full"
                onClick={() => { setQuery(''); handleCategory(null) }}
              >
                Clear filters
              </Button>
            )}
          </div>
        )}
      </section>

      {/* Newsletter */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-20">
        <div className="rounded-3xl bg-gradient-to-br from-primary/10 to-accent/10 p-8 sm:p-12 border border-border/40 my-4">
          <div className="grid gap-8 md:grid-cols-2 items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <Mail className="size-3.5" /> Newsletter
              </div>
              <h2 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
                New stories, straight to your inbox.
              </h2>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Join thousands of founders and operators. One email, once a week. Unsubscribe anytime.
              </p>
            </div>
            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3">
              <Input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="h-12 rounded-full flex-1 bg-background/80 backdrop-blur px-5"
                disabled={submitting}
              />
              <Button type="submit" className="h-12 rounded-full px-6" disabled={submitting}>
                {submitting ? 'Subscribing...' : (<>Subscribe <ArrowRight className="ml-1 size-4" /></>)}
              </Button>
            </form>
          </div>
        </div>
      </section>
    </div>
  )
}
