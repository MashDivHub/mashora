import { useEffect, useState } from 'react'
import { ArrowLeft, CloudDownload, Package, Star as StarIcon } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getAddon,
  getAddonReviews,
  installAddon,
  reviewAddon,
  type AddonDetail as AddonDetailType,
  type AddonReviewResponse,
} from '../api/addons'
import { listTenants, type Tenant } from '../api/tenants'
import { useAuthStore } from '../store/authStore'
import StarRating from '../components/StarRating'
import { Notice } from '@/components/app/notice'
import { PageHeader } from '@/components/app/page-header'
import { StatusBadge } from '@/components/app/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

function formatPrice(cents: number, currency: string): string {
  if (cents === 0) return 'Free'
  const amount = (cents / 100).toFixed(2)
  const symbol = currency.toUpperCase() === 'USD' ? '$' : `${currency} `
  return `${symbol}${amount}/month`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type TabKey = 'description' | 'versions' | 'reviews'

export default function AddonDetail() {
  const { technicalName } = useParams<{ technicalName: string }>()
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const [addon, setAddon] = useState<AddonDetailType | null>(null)
  const [reviews, setReviews] = useState<AddonReviewResponse[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<TabKey>('description')
  const [selectedTenant, setSelectedTenant] = useState('')
  const [installing, setInstalling] = useState(false)
  const [installMsg, setInstallMsg] = useState('')
  const [installError, setInstallError] = useState('')
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewMsg, setReviewMsg] = useState('')
  const [reviewError, setReviewError] = useState('')

  useEffect(() => {
    if (!technicalName) return
    setLoading(true)
    Promise.all([getAddon(technicalName), getAddonReviews(technicalName)])
      .then(([addonData, reviewData]) => {
        setAddon(addonData)
        setReviews(reviewData)
      })
      .catch(() => setError('Failed to load addon details.'))
      .finally(() => setLoading(false))

    if (isAuthenticated) {
      listTenants().then(setTenants).catch(() => {
        // Non-critical.
      })
    }
  }, [technicalName, isAuthenticated])

  async function handleInstall() {
    if (!technicalName || !selectedTenant) return
    setInstalling(true)
    setInstallMsg('')
    setInstallError('')
    try {
      await installAddon(technicalName, selectedTenant)
      setInstallMsg('Addon installed successfully.')
    } catch {
      setInstallError('Installation failed. Please try again.')
    } finally {
      setInstalling(false)
    }
  }

  async function handleReview(e: React.FormEvent) {
    e.preventDefault()
    if (!technicalName || reviewRating === 0) return
    setSubmittingReview(true)
    setReviewMsg('')
    setReviewError('')
    try {
      const newReview = await reviewAddon(technicalName, reviewRating, reviewComment || undefined)
      setReviews((prev) => [newReview, ...prev])
      setReviewRating(0)
      setReviewComment('')
      setReviewMsg('Review submitted.')
    } catch {
      setReviewError('Failed to submit review.')
    } finally {
      setSubmittingReview(false)
    }
  }

  if (loading) {
    return <div className="rounded-3xl border border-border/70 bg-card/90 p-10 text-center text-sm text-muted-foreground">Loading addon...</div>
  }

  if (error || !addon) {
    return (
      <div className="space-y-4">
        <Notice tone="danger">{error || 'Addon not found.'}</Notice>
        <Button variant="outline" onClick={() => navigate('/addons')}>
          <ArrowLeft className="size-4" />
          Back to marketplace
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <Button variant="ghost" className="w-fit rounded-full px-0 hover:bg-transparent" onClick={() => navigate('/addons')}>
        <ArrowLeft className="size-4" />
        Back to marketplace
      </Button>

      <PageHeader
        eyebrow="Addon"
        title={addon.display_name}
        description={addon.summary}
        actions={<Badge variant={addon.price_cents === 0 ? 'success' : 'outline'}>{formatPrice(addon.price_cents, addon.currency)}</Badge>}
      />

      <Card className="overflow-hidden border-border/70 bg-card/90">
        <CardContent className="grid gap-8 p-6 lg:grid-cols-[1fr_320px] lg:p-8">
          <div className="space-y-6">
            <div className="flex flex-wrap items-start gap-5">
              <div
                className="flex size-20 items-center justify-center rounded-3xl border border-border/70 bg-muted/60 text-2xl"
                style={addon.icon_url ? { backgroundImage: `url(${addon.icon_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
              >
                {!addon.icon_url ? 'A' : null}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{addon.category}</Badge>
                  <Badge variant="secondary">v{addon.version}</Badge>
                  <Badge variant="outline">Requires Mashora {addon.mashora_version_min}+</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <StarRating rating={addon.rating_avg} readonly size={16} />
                    <span>{addon.rating_avg.toFixed(1)} ({addon.rating_count} reviews)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CloudDownload className="size-4" />
                    <span>{addon.download_count.toLocaleString()} downloads</span>
                  </div>
                  <div>by {addon.author_name || 'Unknown publisher'}</div>
                </div>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabKey)}>
              <TabsList>
                <TabsTrigger value="description">Description</TabsTrigger>
                <TabsTrigger value="versions">Versions ({addon.versions.length})</TabsTrigger>
                <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="description">
                <div className="rounded-3xl border border-border/70 bg-background/60 p-6 text-sm leading-7 text-muted-foreground whitespace-pre-wrap">
                  {addon.description || addon.summary}
                </div>
              </TabsContent>

              <TabsContent value="versions">
                <div className="space-y-4">
                  {addon.versions.length === 0 ? (
                    <div className="rounded-3xl border border-border/70 bg-background/60 p-6 text-sm text-muted-foreground">
                      No versions available.
                    </div>
                  ) : (
                    addon.versions.map((version, index) => (
                      <div key={version.id} className="rounded-3xl border border-border/70 bg-background/60 p-6">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="text-lg font-semibold">v{version.version}</div>
                          {index === 0 ? <Badge>Latest</Badge> : null}
                          <div className="text-sm text-muted-foreground">
                            {formatBytes(version.file_size)} • {new Date(version.published_at).toLocaleDateString()} • Compat {version.mashora_version_compat}
                          </div>
                        </div>
                        {version.changelog ? (
                          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{version.changelog}</p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="reviews">
                <div className="space-y-6">
                  {isAuthenticated ? (
                    <Card className="border-border/70 bg-background/60">
                      <CardContent className="space-y-4 p-6">
                        <div className="space-y-2">
                          <div className="text-lg font-semibold">Write a review</div>
                          <div className="text-sm text-muted-foreground">Rate the addon and share what worked well for your team.</div>
                        </div>
                        <form onSubmit={handleReview} className="space-y-4">
                          <div className="space-y-2">
                            <div className="text-sm font-medium">Your rating</div>
                            <StarRating rating={reviewRating} onChange={setReviewRating} size={24} />
                          </div>
                          <Textarea
                            value={reviewComment}
                            onChange={(e) => setReviewComment(e.target.value)}
                            placeholder="Share your experience with this addon..."
                            rows={4}
                          />
                          {reviewMsg ? <Notice tone="success">{reviewMsg}</Notice> : null}
                          {reviewError ? <Notice tone="danger">{reviewError}</Notice> : null}
                          <Button type="submit" disabled={reviewRating === 0 || submittingReview}>
                            {submittingReview ? 'Submitting...' : 'Submit review'}
                          </Button>
                        </form>
                      </CardContent>
                    </Card>
                  ) : (
                    <Notice tone="info">
                      Log in to review this addon and install it into one of your tenant workspaces.
                    </Notice>
                  )}

                  {reviews.length === 0 ? (
                    <div className="rounded-3xl border border-border/70 bg-background/60 p-6 text-sm text-muted-foreground">
                      No reviews yet. Be the first to rate it.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {reviews.map((review) => (
                        <div key={review.id} className="rounded-3xl border border-border/70 bg-background/60 p-6">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2">
                              <StarIcon className="size-4 fill-amber-400 text-amber-400" />
                              <span className="font-medium">{review.rating.toFixed(1)}</span>
                            </div>
                            <div className="text-sm font-medium">{review.user_email || 'Anonymous reviewer'}</div>
                            <div className="text-sm text-muted-foreground">{new Date(review.created_at).toLocaleDateString()}</div>
                          </div>
                          {review.comment ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{review.comment}</p> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <Card className="h-fit border-border/70 bg-background/60">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-border/70 bg-muted/60 p-3">
                  <Package className="size-5" />
                </div>
                <div>
                  <div className="font-semibold">Install addon</div>
                  <div className="text-sm text-muted-foreground">Choose a tenant and deploy.</div>
                </div>
              </div>

              {isAuthenticated ? (
                <div className="space-y-4">
                  <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tenant instance" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={String(tenant.id)}>
                          {tenant.db_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button className="w-full" disabled={!selectedTenant || installing} onClick={handleInstall}>
                    {installing ? 'Installing...' : 'Install addon'}
                  </Button>
                  {installMsg ? <Notice tone="success">{installMsg}</Notice> : null}
                  {installError ? <Notice tone="danger">{installError}</Notice> : null}
                </div>
              ) : (
                <Button className="w-full" onClick={() => navigate('/login')}>
                  Login to install
                </Button>
              )}

              <div className="space-y-3 rounded-3xl border border-border/70 bg-card/80 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Category</span>
                  <StatusBadge value={addon.category.toLowerCase()} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Price</span>
                  <span className="font-medium">{formatPrice(addon.price_cents, addon.currency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Downloads</span>
                  <span className="font-medium">{addon.download_count.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  )
}
