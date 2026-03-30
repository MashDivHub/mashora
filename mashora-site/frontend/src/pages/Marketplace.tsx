import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { browseAddons, AddonResponse } from '../api/addons'
import StarRating from '../components/StarRating'

const CATEGORIES = ['All', 'Accounting', 'CRM', 'Sales', 'HR', 'Website', 'Other']
const PER_PAGE = 12

function formatPrice(cents: number, currency: string): string {
  if (cents === 0) return 'Free'
  const amount = (cents / 100).toFixed(2)
  const symbol = currency.toUpperCase() === 'USD' ? '$' : currency + ' '
  return `${symbol}${amount}/mo`
}

function AddonCard({ addon, onClick }: { addon: AddonResponse; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        border: '1px solid #E5E7EB',
        borderRadius: '10px',
        padding: '20px',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(124,58,237,0.10)'
        ;(e.currentTarget as HTMLDivElement).style.borderColor = '#7C3AED'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
        ;(e.currentTarget as HTMLDivElement).style.borderColor = '#E5E7EB'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '8px',
            background: addon.icon_url ? undefined : '#EDE9FE',
            backgroundImage: addon.icon_url ? `url(${addon.icon_url})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            flexShrink: 0,
          }}
        >
          {!addon.icon_url && '🧩'}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {addon.display_name}
          </div>
          <div style={{ fontSize: '12px', color: '#6B7280' }}>{addon.category}</div>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: '13px', color: '#4B5563', lineHeight: 1.5, flexGrow: 1,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {addon.summary}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <StarRating rating={addon.rating_avg} readonly size={14} />
          <span style={{ fontSize: '12px', color: '#6B7280' }}>
            {addon.rating_avg.toFixed(1)} ({addon.rating_count})
          </span>
        </div>
        <div style={{ fontSize: '12px', color: '#6B7280' }}>
          &#8595; {addon.download_count.toLocaleString()}
        </div>
      </div>

      <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '10px' }}>
        <span
          style={{
            display: 'inline-block',
            padding: '3px 10px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 600,
            background: addon.price_cents === 0 ? '#D1FAE5' : '#EDE9FE',
            color: addon.price_cents === 0 ? '#065F46' : '#7C3AED',
          }}
        >
          {formatPrice(addon.price_cents, addon.currency)}
        </span>
      </div>
    </div>
  )
}

export default function Marketplace() {
  const navigate = useNavigate()
  const [addons, setAddons] = useState<AddonResponse[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState('All')
  const [query, setQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    browseAddons({
      q: query || undefined,
      category: category === 'All' ? undefined : category,
      page,
      per_page: PER_PAGE,
    })
      .then((data) => {
        setAddons(data.addons)
        setTotal(data.total)
      })
      .catch(() => setError('Failed to load addons.'))
      .finally(() => setLoading(false))
  }, [query, category, page])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setQuery(searchInput)
    setPage(1)
  }

  function handleCategoryChange(cat: string) {
    setCategory(cat)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  return (
    <div style={{ background: '#F3F4F6', minHeight: 'calc(100vh - 56px)', margin: '-32px -24px', padding: '32px 24px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: '28px', fontWeight: 700, color: '#1E293B' }}>
            Addon Marketplace
          </h1>
          <p style={{ margin: 0, fontSize: '15px', color: '#6B7280' }}>
            Extend Mashora with powerful community and official addons
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} style={{ marginBottom: '20px', display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search addons..."
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid #D1D5DB',
              fontSize: '14px',
              background: '#fff',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '10px 20px',
              background: '#7C3AED',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Search
          </button>
        </form>

        {/* Category filter */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: '1px solid',
                borderColor: category === cat ? '#7C3AED' : '#D1D5DB',
                background: category === cat ? '#7C3AED' : '#fff',
                color: category === cat ? '#fff' : '#374151',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#6B7280', fontSize: '15px' }}>
            Loading addons...
          </div>
        ) : addons.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#6B7280', fontSize: '15px' }}>
            No addons found. Try a different search or category.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '16px',
              marginBottom: '32px',
            }}
          >
            {addons.map((addon) => (
              <AddonCard
                key={addon.id}
                addon={addon}
                onClick={() => navigate(`/addons/${addon.technical_name}`)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: '1px solid #D1D5DB',
                background: page === 1 ? '#F9FAFB' : '#fff',
                color: page === 1 ? '#9CA3AF' : '#374151',
                fontSize: '13px',
                cursor: page === 1 ? 'default' : 'pointer',
              }}
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce<(number | string)[]>((acc, p, idx, arr) => {
                if (idx > 0 && (arr[idx - 1] as number) + 1 < p) acc.push('...')
                acc.push(p)
                return acc
              }, [])
              .map((p, idx) =>
                p === '...' ? (
                  <span key={`ellipsis-${idx}`} style={{ color: '#9CA3AF', fontSize: '13px' }}>...</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p as number)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: page === p ? '#7C3AED' : '#D1D5DB',
                      background: page === p ? '#7C3AED' : '#fff',
                      color: page === p ? '#fff' : '#374151',
                      fontSize: '13px',
                      fontWeight: page === p ? 600 : 400,
                      cursor: 'pointer',
                    }}
                  >
                    {p}
                  </button>
                )
              )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: '1px solid #D1D5DB',
                background: page === totalPages ? '#F9FAFB' : '#fff',
                color: page === totalPages ? '#9CA3AF' : '#374151',
                fontSize: '13px',
                cursor: page === totalPages ? 'default' : 'pointer',
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
