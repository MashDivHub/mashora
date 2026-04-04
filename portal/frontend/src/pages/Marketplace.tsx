import { useEffect, useState } from 'react'
import { ArrowRight, Download, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { browseAddons, type AddonResponse } from '../api/addons'
import StarRating from '../components/StarRating'
import { Notice } from '@/components/app/notice'
import { PageHeader } from '@/components/app/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const categories = ['All', 'Accounting', 'CRM', 'Sales', 'HR', 'Website', 'Other']
const perPage = 12

function formatPrice(cents: number, currency: string): string {
  if (cents === 0) return 'Free'
  const amount = (cents / 100).toFixed(2)
  const symbol = currency.toUpperCase() === 'USD' ? '$' : `${currency} `
  return `${symbol}${amount}/mo`
}

function AddonCard({ addon, onClick }: { addon: AddonResponse; onClick: () => void }) {
  return (
    <Card className="group h-full cursor-pointer overflow-hidden border-border/70 bg-card/90 transition-all duration-300 hover:-translate-y-1 hover:border-zinc-900/20 hover:shadow-xl dark:hover:border-zinc-100/20" onClick={onClick}>
      <CardContent className="flex h-full flex-col gap-5 p-6">
        <div className="flex items-start gap-4">
          <div
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-muted/60 text-xl"
            style={addon.icon_url ? { backgroundImage: `url(${addon.icon_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
          >
            {!addon.icon_url ? 'A' : null}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="truncate text-lg font-semibold">{addon.display_name}</div>
            <div className="text-sm text-muted-foreground">{addon.category}</div>
          </div>
          <Badge variant={addon.price_cents === 0 ? 'success' : 'outline'}>{formatPrice(addon.price_cents, addon.currency)}</Badge>
        </div>

        <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{addon.summary}</p>

        <div className="mt-auto space-y-4">
          <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <StarRating rating={addon.rating_avg} readonly size={15} />
              <span>{addon.rating_avg.toFixed(1)} ({addon.rating_count})</span>
            </div>
            <div className="flex items-center gap-1">
              <Download className="size-4" />
              <span>{addon.download_count.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">View addon</span>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </CardContent>
    </Card>
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
      per_page: perPage,
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

  function handleCategoryChange(nextCategory: string) {
    setCategory(nextCategory)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Marketplace"
        title="Discover business-ready addons"
        description="A zinc-themed marketplace shell with stronger search, cleaner hierarchy, and lighter per-route loading."
      />

      <Card className="border-border/70 bg-card/90">
        <CardContent className="space-y-5 p-6">
          <form onSubmit={handleSearch} className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search addons, categories, publishers..."
                className="pl-11"
              />
            </div>
            <Button type="submit" className="rounded-2xl">Search</Button>
          </form>

          <div className="flex flex-wrap gap-2">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => handleCategoryChange(item)}
                className={cn(
                  'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                  category === item
                    ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground'
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {loading ? (
        <div className="rounded-3xl border border-border/70 bg-card/90 p-10 text-center text-sm text-muted-foreground">
          Loading addons...
        </div>
      ) : addons.length === 0 ? (
        <div className="rounded-3xl border border-border/70 bg-card/90 p-10 text-center text-sm text-muted-foreground">
          No addons found. Try a different search or category.
        </div>
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {addons.map((addon) => (
              <AddonCard key={addon.id} addon={addon} onClick={() => navigate(`/addons/${addon.technical_name}`)} />
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="outline" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page === 1}>
                Previous
              </Button>
              {Array.from({ length: totalPages }, (_, index) => index + 1)
                .filter((item) => item === 1 || item === totalPages || Math.abs(item - page) <= 2)
                .reduce<(number | string)[]>((acc, item, index, arr) => {
                  if (index > 0 && (arr[index - 1] as number) + 1 < item) acc.push('ellipsis')
                  acc.push(item)
                  return acc
                }, [])
                .map((item, index) =>
                  item === 'ellipsis' ? (
                    <span key={`ellipsis-${index}`} className="px-2 text-sm text-muted-foreground">...</span>
                  ) : (
                    <Button
                      key={item}
                      variant={page === item ? 'subtle' : 'outline'}
                      onClick={() => setPage(item as number)}
                    >
                      {item}
                    </Button>
                  )
                )}
              <Button variant="outline" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page === totalPages}>
                Next
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
