import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { erpClient } from '@/lib/erp-api'
import { Button, Input, Skeleton } from '@mashora/design-system'
import {
  ArrowRight,
  Sparkles,
  Mail,
  Truck,
  TrendingUp,
  Layers,
  BookOpen,
} from 'lucide-react'
import { toast } from '@/components/shared'
import { sanitizedHtml } from '@/lib/sanitize'
import { extractErrorMessage } from '@/lib/errors'

// ---------- Types ----------
interface HomepageOverride {
  content?: string | null
}

interface WebsiteProduct {
  id: number
  name: string
  image_1920?: string | false | null
  list_price?: number | null
}

interface WebsiteCategory {
  id: number
  name: string
  parent_id?: number | [number, string] | false | null
}

interface WebsiteBlogPost {
  id: number
  name?: string
  title?: string
  subtitle?: string | null
  summary?: string | null
  teaser?: string | null
  published_date?: string | null
  create_date?: string | null
}

interface ProductsResponse {
  records?: WebsiteProduct[]
  total?: number
}
interface CategoriesResponse {
  records?: WebsiteCategory[]
  total?: number
}
interface BlogResponse {
  records?: WebsiteBlogPost[]
  total?: number
}

interface StatsCounts {
  products: number | null
  posts: number | null
  categories: number | null
}

// ---------- Utilities ----------
function formatPrice(n: number | null | undefined): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '$0.00'
  return `$${n.toFixed(2)}`
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function isTopLevel(cat: WebsiteCategory): boolean {
  const p = cat.parent_id
  if (!p) return true
  if (Array.isArray(p)) return false
  return false
}

// ---------- Page ----------
export default function Home() {
  const [email, setEmail] = useState('')

  const { data: homepage } = useQuery<HomepageOverride | null>({
    queryKey: ['website', 'homepage'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.get<HomepageOverride | null>('/website/homepage')
        return data ?? null
      } catch {
        return null
      }
    },
    retry: false,
  })

  const { data: products = [], isLoading: productsLoading } = useQuery<WebsiteProduct[]>({
    queryKey: ['website', 'home-featured'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.post<ProductsResponse>('/website/products', {
          limit: 8,
          order: 'id desc',
        })
        return data.records ?? []
      } catch {
        return []
      }
    },
  })

  const { data: categories = [] } = useQuery<WebsiteCategory[]>({
    queryKey: ['website', 'home-categories'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.post<CategoriesResponse>('/website/categories', {
          limit: 12,
        })
        return data.records ?? []
      } catch {
        return []
      }
    },
  })

  const { data: posts = [] } = useQuery<WebsiteBlogPost[]>({
    queryKey: ['website', 'home-blog'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.post<BlogResponse>('/website/blog/posts', {
          published: true,
          limit: 3,
          order: 'published_date desc',
        })
        return data.records ?? []
      } catch {
        return []
      }
    },
  })

  const { data: statsCounts } = useQuery<StatsCounts | null>({
    queryKey: ['website', 'home-stats-counts'],
    queryFn: async () => {
      try {
        const [productsRes, postsRes, categoriesRes] = await Promise.all([
          erpClient.raw.post<ProductsResponse>('/website/products', { limit: 1 }),
          erpClient.raw.post<BlogResponse>('/website/blog/posts', { published: true, limit: 1 }),
          erpClient.raw.post<CategoriesResponse>('/website/categories', { limit: 1 }),
        ])
        const products = typeof productsRes.data?.total === 'number' ? productsRes.data.total : null
        const blogPosts = typeof postsRes.data?.total === 'number' ? postsRes.data.total : null
        const cats = typeof categoriesRes.data?.total === 'number' ? categoriesRes.data.total : null
        return { products, posts: blogPosts, categories: cats }
      } catch {
        return null
      }
    },
    retry: false,
  })

  const topCategories = categories.filter(isTopLevel).slice(0, 6)

  const showStatsBand =
    !!statsCounts &&
    statsCounts.products !== null &&
    statsCounts.posts !== null &&
    statsCounts.categories !== null &&
    (statsCounts.products > 0 || statsCounts.posts > 0 || statsCounts.categories > 0)

  const statsItems = showStatsBand && statsCounts
    ? [
        {
          icon: TrendingUp,
          value: String(statsCounts.products ?? 0),
          label: (statsCounts.products ?? 0) === 1 ? 'product' : 'products',
        },
        {
          icon: BookOpen,
          value: String(statsCounts.posts ?? 0),
          label: (statsCounts.posts ?? 0) === 1 ? 'story' : 'stories',
        },
        {
          icon: Layers,
          value: String(statsCounts.categories ?? 0),
          label: (statsCounts.categories ?? 0) === 1 ? 'category' : 'categories',
        },
        { icon: Truck, value: 'Fast', label: 'shipping' },
      ]
    : []

  const [submitting, setSubmitting] = useState(false)

  const handleSubscribe = async (e: FormEvent<HTMLFormElement>) => {
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
    <div className="bg-background">
      {/* ===== Section 1: Hero ===== */}
      <section className="relative overflow-hidden min-h-[85vh] flex items-center border-b border-border/40">
        {/* Animated gradient background */}
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/20 via-background to-accent/10"
          aria-hidden
        />
        {/* Blurred blobs */}
        <div
          className="absolute -top-24 -left-24 size-96 rounded-full bg-primary/20 blur-3xl aspect-square"
          aria-hidden
        />
        <div
          className="absolute -bottom-32 -right-20 size-[28rem] rounded-full bg-accent/20 blur-3xl aspect-square"
          aria-hidden
        />
        <div
          className="absolute top-1/3 left-1/2 size-64 rounded-full bg-fuchsia-400/10 blur-3xl aspect-square"
          aria-hidden
        />
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 -z-10 opacity-[0.035] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:40px_40px]"
          aria-hidden
        />

        {homepage?.content ? (
          <div className="relative mx-auto max-w-4xl px-4 sm:px-6 py-24">
            <article
              className="prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={sanitizedHtml(homepage.content)}
            />
          </div>
        ) : (
          <div className="relative mx-auto max-w-3xl px-4 sm:px-6 py-24 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 backdrop-blur px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              <Sparkles className="size-3.5 text-primary" />
              <span>New collection — Spring 2026</span>
            </div>
            <h1 className="mt-6 text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.05]">
              Build your store.{' '}
              <span className="bg-gradient-to-br from-primary via-fuchsia-500 to-accent bg-clip-text text-transparent">
                Ship faster.
              </span>
            </h1>
            <p className="mt-6 mx-auto max-w-xl text-lg text-muted-foreground leading-relaxed">
              A modern commerce experience built for the brands of tomorrow.
              Beautifully designed, fully integrated, remarkably fast.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Button size="lg" asChild>
                <Link to="/shop">
                  Shop now <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="ghost" asChild>
                <Link to="/blog">Read stories</Link>
              </Button>
            </div>

            {/* Scroll hint */}
            <div className="mt-16 flex justify-center">
              <div className="size-8 rounded-full border border-border/60 flex items-center justify-center text-muted-foreground transition-transform hover:translate-y-1">
                <ArrowRight className="size-4 rotate-90" />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ===== Section 2: Categories ===== */}
      {topCategories.length > 0 && (
        <section className="py-24 mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Shop by category</h2>
              <p className="mt-2 text-muted-foreground">Curated selections across the store.</p>
            </div>
            <Link
              to="/shop"
              className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              Browse all <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {topCategories.map((cat, idx) => (
              <Link
                key={cat.id}
                to={`/shop?category=${cat.id}`}
                className="group relative overflow-hidden rounded-3xl aspect-[4/5] bg-gradient-to-br from-primary/10 to-muted border border-border/40 transition-all hover:-translate-y-1 hover:shadow-xl"
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${
                    [
                      'from-rose-200/50 to-fuchsia-300/50',
                      'from-sky-200/50 to-indigo-300/50',
                      'from-emerald-200/50 to-teal-300/50',
                      'from-amber-200/50 to-orange-300/50',
                      'from-violet-200/50 to-purple-300/50',
                      'from-cyan-200/50 to-blue-300/50',
                    ][idx % 6]
                  } transition-transform duration-500 group-hover:scale-105`}
                  aria-hidden
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" aria-hidden />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <div className="text-xl font-semibold text-white drop-shadow-sm">{cat.name}</div>
                  <div className="mt-1 text-xs text-white/80 flex items-center gap-1 transition-all group-hover:gap-2">
                    Shop collection <ArrowRight className="size-3.5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ===== Section 3: Featured products ===== */}
      <section className="py-24 mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Featured</h2>
            <p className="mt-2 text-muted-foreground">Hand-picked for you.</p>
          </div>
          <Link
            to="/shop"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            View all <ArrowRight className="size-4" />
          </Link>
        </div>

        {productsLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-square w-full rounded-2xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 py-16 text-center text-muted-foreground">
            No products available yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {products.map((p) => (
              <Link
                key={p.id}
                to={`/shop/${p.id}`}
                className="group relative rounded-2xl overflow-hidden border border-border/40 bg-card transition-all hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="relative aspect-square overflow-hidden bg-muted">
                  {p.image_1920 ? (
                    <img
                      src={`data:image/png;base64,${p.image_1920}`}
                      alt={p.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="h-full w-full bg-gradient-to-br from-primary/20 via-muted to-accent/20"
                      aria-hidden
                    />
                  )}
                  <div className="absolute bottom-2 right-2 opacity-0 translate-y-2 transition-all group-hover:opacity-100 group-hover:translate-y-0">
                    <span className="inline-flex items-center gap-1 rounded-full bg-background/90 backdrop-blur px-3 py-1 text-xs font-medium shadow-sm">
                      Quick view <ArrowRight className="size-3" />
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-sm font-medium line-clamp-1">{p.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {formatPrice(p.list_price)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ===== Section 4: Stats band (real counts from backend) ===== */}
      {showStatsBand && (
        <section className="bg-muted/40 border-y border-border/40">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {statsItems.map((s) => {
                const Icon = s.icon
                return (
                  <div key={s.label} className="flex flex-col items-center text-center">
                    <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-background border border-border/40 shadow-sm">
                      <Icon className="size-5 text-primary" />
                    </div>
                    <div className="text-3xl font-bold tracking-tight">{s.value}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ===== Section 5: Blog preview ===== */}
      {posts.length > 0 && (
        <section className="py-24 mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">From the blog</h2>
              <p className="mt-2 text-muted-foreground">
                Stories, updates, and ideas from our team.
              </p>
            </div>
            <Link
              to="/blog"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              View all posts <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {posts.slice(0, 3).map((post, idx) => {
              const title = post.title || post.name || 'Untitled'
              const excerpt = post.subtitle || post.summary || post.teaser || ''
              const date = formatDate(post.published_date || post.create_date)
              const grad = [
                'from-pink-300/60 to-indigo-300/60',
                'from-sky-300/60 to-emerald-300/60',
                'from-amber-300/60 to-rose-300/60',
              ][idx % 3]
              return (
                <Link
                  key={post.id}
                  to={`/blog/${post.id}`}
                  className="group rounded-2xl overflow-hidden border border-border/40 bg-card transition-all hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className={`aspect-video bg-gradient-to-br ${grad} relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.4),transparent_60%)]" />
                  </div>
                  <div className="p-6">
                    {date && (
                      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                        {date}
                      </div>
                    )}
                    <h3 className="text-lg font-semibold tracking-tight line-clamp-2 transition-colors group-hover:text-primary">
                      {title}
                    </h3>
                    {excerpt && (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{excerpt}</p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ===== Section 6: Newsletter ===== */}
      <section className="py-24 bg-gradient-to-br from-primary/5 via-background to-accent/5 border-y border-border/40">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 text-center">
          <div className="inline-flex items-center justify-center size-12 rounded-2xl bg-primary/10 mb-6">
            <Mail className="size-5 text-primary" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">Stay in the loop</h2>
          <p className="mt-3 text-muted-foreground">
            New drops, behind-the-scenes stories, and subscriber-only deals.
          </p>
          <form
            onSubmit={handleSubscribe}
            className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
          >
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
              aria-label="Email address"
              disabled={submitting}
            />
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Subscribing...' : 'Subscribe'}
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            We care about your data. Unsubscribe anytime.
          </p>
        </div>
      </section>

      {/* ===== Section 7: Final CTA ===== */}
      <section className="pb-24">
        <div className="relative mx-4 sm:mx-6 rounded-3xl overflow-hidden bg-zinc-900 text-white">
          <div
            className="absolute inset-0 bg-gradient-to-br from-primary/30 via-transparent to-fuchsia-500/20"
            aria-hidden
          />
          <div
            className="absolute -top-20 -right-20 size-80 rounded-full bg-primary/30 blur-3xl"
            aria-hidden
          />
          <div
            className="absolute -bottom-20 -left-20 size-80 rounded-full bg-fuchsia-500/20 blur-3xl"
            aria-hidden
          />
          <div className="relative mx-auto max-w-3xl px-6 sm:px-12 py-24 text-center">
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
              Ready to get started?
            </h2>
            <p className="mt-4 text-lg text-white/70 max-w-xl mx-auto">
              Join thousands of brands already shipping faster with Mashora.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Button size="lg" variant="secondary" asChild>
                <Link to="/shop">
                  Shop <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/contactus">Contact us</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
