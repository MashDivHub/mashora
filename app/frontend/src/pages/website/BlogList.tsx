import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@mashora/design-system'
import { FileText } from 'lucide-react'
import { DataTable, PageHeader, SearchBar, type Column, type FilterOption } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

const FILTERS: FilterOption[] = [
  { key: 'published', label: 'Published', domain: [] },
  { key: 'draft',     label: 'Draft',     domain: [] },
]

// Maps filter key → `published` body param value
function publishedParam(activeFilters: string[]): boolean | undefined {
  if (activeFilters.includes('published')) return true
  if (activeFilters.includes('draft'))     return false
  return undefined
}

export default function BlogList() {
  const navigate = useNavigate()
  const [search,        setSearch]        = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [page,          setPage]          = useState(0)
  const PAGE_SIZE = 40

  const { data, isLoading } = useQuery({
    queryKey: ['blog-posts', search, activeFilters, page],
    queryFn: async () => {
      const body: Record<string, any> = {
        offset: page * PAGE_SIZE,
        limit:  PAGE_SIZE,
        search: search || undefined,
      }
      const pub = publishedParam(activeFilters)
      if (pub !== undefined) body.published = pub
      const { data } = await erpClient.raw.post('/website/blog/posts', body)
      return data as { records: Array<Record<string, unknown>>; total: number }
    },
  })

  const columns: Column[] = [
    {
      key: 'name',
      label: 'Title',
      render: (_v, row) => (
        <span className="text-sm font-semibold">{row.name}</span>
      ),
    },
    {
      key: 'author_id',
      label: 'Author',
      render: v => (
        <span className="text-sm text-muted-foreground">
          {Array.isArray(v) ? v[1] : '—'}
        </span>
      ),
    },
    {
      key: 'blog_id',
      label: 'Category',
      render: v => (
        <span className="text-sm text-muted-foreground">
          {Array.isArray(v) ? v[1] : '—'}
        </span>
      ),
    },
    {
      key: 'post_date',
      label: 'Date',
      format: v => v ? new Date(v).toLocaleDateString() : '—',
    },
    {
      key: 'visits',
      label: 'Views',
      render: v => (
        <span className="text-sm tabular-nums text-right block">{v ?? 0}</span>
      ),
    },
    {
      key: 'website_published',
      label: 'Status',
      render: v => v ? (
        <Badge variant="success" className="rounded-full text-xs">Published</Badge>
      ) : (
        <Badge variant="secondary" className="rounded-full text-xs">Draft</Badge>
      ),
    },
  ]

  const total = data?.total ?? 0

  return (
    <div className="space-y-4">
      <PageHeader
        title="Blog Posts"
        subtitle={total > 0 ? `${total} post${total === 1 ? '' : 's'}` : 'Blog'}
      />
      <SearchBar
        placeholder="Search posts…"
        onSearch={v => { setSearch(v); setPage(0) }}
        filters={FILTERS}
        activeFilters={activeFilters}
        onFilterToggle={k => {
          setActiveFilters(prev => {
            // Only one of published/draft can be active at a time
            if (prev.includes(k)) return prev.filter(x => x !== k)
            return [k]
          })
          setPage(0)
        }}
      />
      <DataTable
        columns={columns}
        data={data?.records ?? []}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        loading={isLoading}
        onRowClick={row => navigate(`/admin/website/blog/${row.id}`)}
        emptyMessage="No blog posts found"
        emptyIcon={<FileText className="h-10 w-10" />}
      />
    </div>
  )
}
