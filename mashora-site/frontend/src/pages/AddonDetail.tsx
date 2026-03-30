import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getAddon,
  getAddonReviews,
  installAddon,
  reviewAddon,
  AddonDetail as AddonDetailType,
  AddonReviewResponse,
} from '../api/addons'
import { listTenants, Tenant } from '../api/tenants'
import { useAuthStore } from '../store/authStore'
import StarRating from '../components/StarRating'

function formatPrice(cents: number, currency: string): string {
  if (cents === 0) return 'Free'
  const amount = (cents / 100).toFixed(2)
  const symbol = currency.toUpperCase() === 'USD' ? '$' : currency + ' '
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

  // Install state
  const [selectedTenant, setSelectedTenant] = useState('')
  const [installing, setInstalling] = useState(false)
  const [installMsg, setInstallMsg] = useState('')
  const [installError, setInstallError] = useState('')

  // Review state
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewMsg, setReviewMsg] = useState('')
  const [reviewError, setReviewError] = useState('')

  useEffect(() => {
    if (!technicalName) return
    setLoading(true)
    Promise.all([
      getAddon(technicalName),
      getAddonReviews(technicalName),
    ])
      .then(([addonData, reviewData]) => {
        setAddon(addonData)
        setReviews(reviewData)
      })
      .catch(() => setError('Failed to load addon details.'))
      .finally(() => setLoading(false))

    if (isAuthenticated) {
      listTenants()
        .then(setTenants)
        .catch(() => {})
    }
  }, [technicalName, isAuthenticated])

  async function handleInstall() {
    if (!technicalName || !selectedTenant) return
    setInstalling(true)
    setInstallMsg('')
    setInstallError('')
    try {
      await installAddon(technicalName, selectedTenant)
      setInstallMsg('Addon installed successfully!')
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
      setReviewMsg('Review submitted!')
    } catch {
      setReviewError('Failed to submit review.')
    } finally {
      setSubmittingReview(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px', color: '#6B7280' }}>
        Loading addon...
      </div>
    )
  }

  if (error || !addon) {
    return (
      <div style={{ textAlign: 'center', padding: '80px' }}>
        <div style={{ color: '#B91C1C', marginBottom: '16px' }}>{error || 'Addon not found.'}</div>
        <button
          onClick={() => navigate('/addons')}
          style={{ padding: '8px 16px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          Back to Marketplace
        </button>
      </div>
    )
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'description', label: 'Description' },
    { key: 'versions', label: `Versions (${addon.versions.length})` },
    { key: 'reviews', label: `Reviews (${reviews.length})` },
  ]

  return (
    <div style={{ background: '#F3F4F6', minHeight: 'calc(100vh - 56px)', margin: '-32px -24px', padding: '32px 24px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Back link */}
        <button
          onClick={() => navigate('/addons')}
          style={{ background: 'none', border: 'none', color: '#7C3AED', fontSize: '14px', cursor: 'pointer', padding: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          &#8592; Back to Marketplace
        </button>

        {/* Header card */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '28px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '12px',
                background: addon.icon_url ? undefined : '#EDE9FE',
                backgroundImage: addon.icon_url ? `url(${addon.icon_url})` : undefined,
                backgroundSize: 'cover',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '36px',
                flexShrink: 0,
              }}
            >
              {!addon.icon_url && '🧩'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#1E293B' }}>
                  {addon.display_name}
                </h1>
                <span style={{
                  padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                  background: addon.price_cents === 0 ? '#D1FAE5' : '#EDE9FE',
                  color: addon.price_cents === 0 ? '#065F46' : '#7C3AED',
                }}>
                  {formatPrice(addon.price_cents, addon.currency)}
                </span>
              </div>
              <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '8px' }}>
                by {addon.author_name || 'Unknown'} &bull; {addon.category} &bull; v{addon.version}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <StarRating rating={addon.rating_avg} readonly size={16} />
                  <span style={{ fontSize: '13px', color: '#6B7280' }}>
                    {addon.rating_avg.toFixed(1)} ({addon.rating_count} reviews)
                  </span>
                </div>
                <span style={{ fontSize: '13px', color: '#6B7280' }}>
                  &#8595; {addon.download_count.toLocaleString()} downloads
                </span>
                <span style={{ fontSize: '13px', color: '#6B7280' }}>
                  Requires Mashora {addon.mashora_version_min}+
                </span>
              </div>
              <p style={{ margin: '12px 0 0', fontSize: '14px', color: '#4B5563' }}>{addon.summary}</p>
            </div>

            {/* Install panel */}
            <div style={{ minWidth: '200px', flexShrink: 0 }}>
              {isAuthenticated ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <select
                    value={selectedTenant}
                    onChange={(e) => setSelectedTenant(e.target.value)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #D1D5DB',
                      fontSize: '13px',
                      background: '#fff',
                    }}
                  >
                    <option value="">Select instance...</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={String(t.id)}>{t.db_name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleInstall}
                    disabled={!selectedTenant || installing}
                    style={{
                      padding: '9px 16px',
                      background: !selectedTenant || installing ? '#C4B5FD' : '#7C3AED',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: !selectedTenant || installing ? 'default' : 'pointer',
                    }}
                  >
                    {installing ? 'Installing...' : 'Install Addon'}
                  </button>
                  {installMsg && <div style={{ fontSize: '12px', color: '#065F46' }}>{installMsg}</div>}
                  {installError && <div style={{ fontSize: '12px', color: '#B91C1C' }}>{installError}</div>}
                </div>
              ) : (
                <button
                  onClick={() => navigate('/login')}
                  style={{
                    width: '100%',
                    padding: '9px 16px',
                    background: '#7C3AED',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Login to Install
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB' }}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '14px 20px',
                  border: 'none',
                  borderBottom: activeTab === tab.key ? '2px solid #7C3AED' : '2px solid transparent',
                  background: 'none',
                  color: activeTab === tab.key ? '#7C3AED' : '#6B7280',
                  fontSize: '14px',
                  fontWeight: activeTab === tab.key ? 600 : 400,
                  cursor: 'pointer',
                  marginBottom: '-1px',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ padding: '24px' }}>
            {/* Description tab */}
            {activeTab === 'description' && (
              <div style={{ fontSize: '14px', color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {addon.description || addon.summary}
              </div>
            )}

            {/* Versions tab */}
            {activeTab === 'versions' && (
              <div>
                {addon.versions.length === 0 ? (
                  <div style={{ color: '#6B7280', textAlign: 'center', padding: '24px' }}>No versions available.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {addon.versions.map((v, idx) => (
                      <div key={v.id} style={{ border: '1px solid #E5E7EB', borderRadius: '8px', padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                          <span style={{ fontWeight: 700, fontSize: '14px', color: '#1E293B' }}>v{v.version}</span>
                          {idx === 0 && (
                            <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: '#EDE9FE', color: '#7C3AED' }}>
                              Latest
                            </span>
                          )}
                          <span style={{ fontSize: '12px', color: '#6B7280', marginLeft: 'auto' }}>
                            {formatBytes(v.file_size)} &bull; {new Date(v.published_at).toLocaleDateString()} &bull; Compat: {v.mashora_version_compat}
                          </span>
                        </div>
                        {v.changelog && (
                          <p style={{ margin: 0, fontSize: '13px', color: '#4B5563', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                            {v.changelog}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Reviews tab */}
            {activeTab === 'reviews' && (
              <div>
                {/* Write review form */}
                {isAuthenticated ? (
                  <form
                    onSubmit={handleReview}
                    style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}
                  >
                    <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 600, color: '#1E293B' }}>
                      Write a Review
                    </h3>
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>Your rating</div>
                      <StarRating rating={reviewRating} onChange={setReviewRating} size={24} />
                    </div>
                    <textarea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Share your experience with this addon (optional)..."
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #D1D5DB',
                        fontSize: '13px',
                        resize: 'vertical',
                        boxSizing: 'border-box',
                        fontFamily: 'inherit',
                        marginBottom: '10px',
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        type="submit"
                        disabled={reviewRating === 0 || submittingReview}
                        style={{
                          padding: '7px 16px',
                          background: reviewRating === 0 || submittingReview ? '#C4B5FD' : '#7C3AED',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: reviewRating === 0 || submittingReview ? 'default' : 'pointer',
                        }}
                      >
                        {submittingReview ? 'Submitting...' : 'Submit Review'}
                      </button>
                      {reviewMsg && <span style={{ fontSize: '13px', color: '#065F46' }}>{reviewMsg}</span>}
                      {reviewError && <span style={{ fontSize: '13px', color: '#B91C1C' }}>{reviewError}</span>}
                    </div>
                  </form>
                ) : (
                  <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '16px', marginBottom: '24px', fontSize: '14px', color: '#6B7280' }}>
                    <button onClick={() => navigate('/login')} style={{ color: '#7C3AED', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
                      Log in
                    </button>{' '}
                    to write a review.
                  </div>
                )}

                {/* Reviews list */}
                {reviews.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#6B7280', padding: '24px' }}>
                    No reviews yet. Be the first!
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {reviews.map((r) => (
                      <div key={r.id} style={{ border: '1px solid #E5E7EB', borderRadius: '8px', padding: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <StarRating rating={r.rating} readonly size={14} />
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>
                            {r.user_email || 'Anonymous'}
                          </span>
                          <span style={{ fontSize: '12px', color: '#9CA3AF', marginLeft: 'auto' }}>
                            {new Date(r.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {r.comment && (
                          <p style={{ margin: 0, fontSize: '13px', color: '#4B5563', lineHeight: 1.5 }}>
                            {r.comment}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
