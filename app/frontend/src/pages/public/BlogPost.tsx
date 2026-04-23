import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Input, Skeleton } from '@mashora/design-system'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  Facebook,
  Link as LinkIcon,
  Linkedin,
  Mail,
  Twitter,
  User,
} from 'lucide-react'
import { erpClient } from '@/lib/erp-api'
import { sanitizedHtml } from '@/lib/sanitize'
import { LoadingState, toast } from '@/components/shared'
import { extractErrorMessage } from '@/lib/errors'

type BlogPost = {
  id: number
  name: string
  subtitle?: string | false
  teaser?: string | false
  content?: string | false
  published_date?: string | false
  create_date?: string | false
  author_id?: [number, string] | false
  cover_image?: string | false
  cover_image_url?: string
  category_id?: [number, string] | false
}

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
  return GRADIENT_PALETTE[Math.abs(hash) % GRADIENT_PALETTE.length]
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

function readTimeFromContent(content: string | false | undefined, fallback = '5 min read'): string {
  if (typeof content !== 'string' || !content) return fallback
  const plain = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const words = plain ? plain.split(' ').length : 0
  if (!words) return fallback
  const minutes = Math.max(2, Math.round(words / 220))
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

function categoryLabel(post: BlogPost): string | null {
  return Array.isArray(post.category_id) ? post.category_id[1] : null
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

function CoverImage({ post }: { post: BlogPost }) {
  const src = resolveCoverSrc(post)
  const [errored, setErrored] = useState(false)
  if (src && !errored) {
    return (
      <div className="rounded-3xl aspect-[16/9] overflow-hidden bg-muted">
        <img
          src={src}
          alt={post.name}
          className="h-full w-full object-cover"
          onError={() => setErrored(true)}
        />
      </div>
    )
  }
  const gradient = hashGradient(post.name || String(post.id))
  const initial = (categoryLabel(post) || post.name || 'M')[0].toUpperCase()
  return (
    <div className={`rounded-3xl aspect-[16/9] overflow-hidden bg-gradient-to-br ${gradient} flex items-center justify-center`}>
      <span className="text-[120px] font-semibold tracking-tight text-foreground/15 select-none">{initial}</span>
    </div>
  )
}

function useReadingProgress(ref: React.RefObject<HTMLElement | null>): number {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    function onScroll() {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const viewport = window.innerHeight
      const articleTop = rect.top + window.scrollY
      const articleHeight = el.offsetHeight
      const scrolled = window.scrollY - articleTop + viewport * 0.2
      const denominator = Math.max(1, articleHeight - viewport * 0.3)
      const raw = scrolled / denominator
      const clamped = Math.min(1, Math.max(0, raw))
      setProgress(clamped)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [ref])
  return progress
}

type ShareTarget = 'twitter' | 'linkedin' | 'facebook' | 'copy'

function useShare(title: string) {
  return (target: ShareTarget) => {
    if (typeof window === 'undefined') return
    const url = window.location.href
    const encUrl = encodeURIComponent(url)
    const encTitle = encodeURIComponent(title)
    if (target === 'copy') {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(
          () => toast.success('Link copied'),
          () => toast.error('Could not copy link'),
        )
      } else {
        toast.error('Clipboard unavailable')
      }
      return
    }
    const map: Record<Exclude<ShareTarget, 'copy'>, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encTitle}&url=${encUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encUrl}`,
    }
    window.open(map[target], '_blank', 'noopener,noreferrer')
  }
}

function ShareButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="size-10 rounded-full border border-border/60 bg-background/80 backdrop-blur flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/60 transition-colors"
    >
      {children}
    </button>
  )
}

function RelatedCard({ post }: { post: BlogPost }) {
  const gradient = hashGradient(post.name || String(post.id))
  const initial = (categoryLabel(post) || post.name || 'M')[0].toUpperCase()
  const src = resolveCoverSrc(post)
  const [errored, setErrored] = useState(false)
  const showImage = src && !errored
  return (
    <Link
      to={`/blog/${post.id}`}
      className="group rounded-2xl overflow-hidden border border-border/40 bg-card transition-all hover:-translate-y-1 hover:shadow-lg flex flex-col"
    >
      {showImage ? (
        <div className="aspect-video overflow-hidden bg-muted">
          <img
            src={src}
            alt={post.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            onError={() => setErrored(true)}
          />
        </div>
      ) : (
        <div className={`aspect-video bg-gradient-to-br ${gradient} flex items-center justify-center`}>
          <span className="text-6xl font-semibold text-foreground/20 select-none">{initial}</span>
        </div>
      )}
      <div className="p-6 flex flex-col flex-1">
        {categoryLabel(post) && (
          <span className="inline-flex w-fit items-center rounded-full border border-border/60 px-2.5 py-0.5 text-[11px] font-medium text-foreground/80">
            {categoryLabel(post)}
          </span>
        )}
        <h3 className="mt-3 text-lg font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {post.name}
        </h3>
        <div className="mt-4 text-xs text-muted-foreground inline-flex items-center gap-3">
          <span className="inline-flex items-center gap-1"><Calendar className="size-3" /> {formatDate(post.published_date || post.create_date)}</span>
        </div>
      </div>
    </Link>
  )
}

export default function BlogPost() {
  const params = useParams<{ slug?: string; id?: string }>()
  const navigate = useNavigate()
  const rawId = params.slug ?? params.id
  const id = Number(rawId)
  const validId = !!rawId && !Number.isNaN(id)

  const articleRef = useRef<HTMLElement | null>(null)
  const progress = useReadingProgress(articleRef)
  const [email, setEmail] = useState('')

  const { data: post, isLoading } = useQuery<BlogPost | null>({
    queryKey: ['website', 'blog', 'post', id],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.get(`/website/blog/posts/${id}`)
        return (data || null) as BlogPost | null
      } catch {
        return null
      }
    },
    enabled: validId,
  })

  const { data: related } = useQuery<BlogPost[]>({
    queryKey: ['website', 'blog', 'related', id],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.post('/website/blog/posts', {
          published: true,
          limit: 4,
          order: 'published_date desc',
        })
        return (data?.records || []) as BlogPost[]
      } catch {
        return []
      }
    },
    enabled: validId,
  })

  const share = useShare(post?.name || 'Mashora Blog')

  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' })
  }, [id])

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

  if (!validId) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold">Post not found</h1>
        <p className="mt-3 text-muted-foreground">That link doesn't look right.</p>
        <Button onClick={() => navigate('/blog')} className="mt-6 rounded-full">Back to blog</Button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
        <LoadingState label="Loading post..." />
        <div className="mt-10 space-y-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="aspect-[16/9] w-full rounded-3xl" />
        </div>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold">Story not found</h1>
        <p className="mt-3 text-muted-foreground">It may have been moved or unpublished.</p>
        <Button onClick={() => navigate('/blog')} className="mt-6 rounded-full">Back to blog</Button>
      </div>
    )
  }

  const readTime = readTimeFromContent(post.content)
  const progressPct = `${(progress * 100).toFixed(2)}%`
  const relatedFiltered = (related || []).filter(p => p.id !== post.id).slice(0, 3)

  return (
    <div className="relative">
      {/* Reading progress */}
      <div
        aria-hidden
        className="fixed top-0 left-0 z-50 h-0.5 bg-primary transition-[width] duration-150"
        style={{ width: progress > 0.005 ? progressPct : '0%', opacity: progress > 0.005 ? 1 : 0 }}
      />

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 pt-10 sm:pt-16">
        <Link
          to="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" /> Back to blog
        </Link>
        {categoryLabel(post) && (
          <div className="mt-8">
            <span className="inline-flex items-center rounded-full border border-border/60 px-3 py-1 text-xs font-medium text-foreground/80">
              {categoryLabel(post)}
            </span>
          </div>
        )}
        <h1 className="mt-6 text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05]">
          {post.name}
        </h1>
        {(post.subtitle || post.teaser) && (
          <p className="mt-5 text-xl text-muted-foreground leading-relaxed">
            {(typeof post.subtitle === 'string' && post.subtitle) ||
              (typeof post.teaser === 'string' && post.teaser) ||
              ''}
          </p>
        )}
        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-full bg-gradient-to-br from-primary/40 to-accent/40 flex items-center justify-center text-xs font-semibold text-foreground/80">
              {authorInitials(post)}
            </div>
            <span className="text-foreground font-medium">{authorName(post)}</span>
          </div>
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="size-3.5" /> {formatDate(post.published_date || post.create_date)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" /> {readTime}
          </span>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 sm:px-6 mt-12">
        <CoverImage post={post} />
      </section>

      {/* Floating share bar (desktop) */}
      <div className="fixed left-8 top-1/3 hidden lg:flex flex-col gap-2 z-40">
        <ShareButton label="Share on Twitter" onClick={() => share('twitter')}>
          <Twitter className="size-4" />
        </ShareButton>
        <ShareButton label="Share on LinkedIn" onClick={() => share('linkedin')}>
          <Linkedin className="size-4" />
        </ShareButton>
        <ShareButton label="Share on Facebook" onClick={() => share('facebook')}>
          <Facebook className="size-4" />
        </ShareButton>
        <ShareButton label="Copy link" onClick={() => share('copy')}>
          <LinkIcon className="size-4" />
        </ShareButton>
      </div>

      {/* Article */}
      <article
        ref={articleRef}
        className="mx-auto max-w-3xl px-4 sm:px-6 py-12"
      >
        {typeof post.content === 'string' && post.content ? (
          <div
            className="prose dark:prose-invert prose-lg max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-2xl prose-pre:rounded-2xl"
            dangerouslySetInnerHTML={sanitizedHtml(post.content)}
          />
        ) : (
          <p className="text-muted-foreground">This post has no content yet.</p>
        )}

        {/* Mobile share row */}
        <div className="mt-12 pt-8 border-t border-border/40 flex lg:hidden items-center justify-between">
          <span className="text-sm font-medium">Share this story</span>
          <div className="flex gap-2">
            <ShareButton label="Share on Twitter" onClick={() => share('twitter')}><Twitter className="size-4" /></ShareButton>
            <ShareButton label="Share on LinkedIn" onClick={() => share('linkedin')}><Linkedin className="size-4" /></ShareButton>
            <ShareButton label="Share on Facebook" onClick={() => share('facebook')}><Facebook className="size-4" /></ShareButton>
            <ShareButton label="Copy link" onClick={() => share('copy')}><LinkIcon className="size-4" /></ShareButton>
          </div>
        </div>
      </article>

      {/* Author card */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="rounded-2xl border border-border/40 bg-muted/20 p-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="size-16 rounded-full bg-gradient-to-br from-primary/50 to-accent/50 flex items-center justify-center text-lg font-semibold text-foreground/80 shrink-0">
            {authorInitials(post)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground inline-flex items-center gap-1.5">
              <User className="size-3.5" /> Written by
            </div>
            <div className="mt-1.5 text-lg font-semibold">{authorName(post)}</div>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              Part of the team building Mashora — the unified platform for operations, finance, and sales.
            </p>
          </div>
        </div>
      </section>

      {/* Related */}
      {relatedFiltered.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16 mt-16 border-t border-border/40">
          <div className="flex items-baseline justify-between mb-8">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">More stories</h2>
            <Link to="/blog" className="text-sm text-primary inline-flex items-center gap-1 hover:underline">
              View all <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {relatedFiltered.map(p => <RelatedCard key={p.id} post={p} />)}
          </div>
        </section>
      )}

      {/* Newsletter */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-20">
        <div className="rounded-3xl bg-gradient-to-br from-primary/10 to-accent/10 p-8 sm:p-12 border border-border/40 my-4">
          <div className="grid gap-8 md:grid-cols-2 items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <Mail className="size-3.5" /> Newsletter
              </div>
              <h2 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
                Enjoyed this read?
              </h2>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Get new stories delivered once a week. Thoughtful, concise, and never spammy.
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
