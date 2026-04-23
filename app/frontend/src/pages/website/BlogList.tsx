import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button } from '@mashora/design-system'
import { FileText, Plus } from 'lucide-react'
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
  const records = data?.records ?? []
  const hasFilters = search.length > 0 || activeFilters.length > 0
  const showEmptyCta = !isLoading && records.length === 0 && !hasFilters

  return (
    <div className="space-y-4">
      <PageHeader
        title="Blog Posts"
        subtitle={total > 0 ? `${total} post${total === 1 ? '' : 's'}` : 'Blog'}
        onNew={() => navigate('/admin/model/blog.post/new')}
        newLabel="New Post"
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
      {showEmptyCta ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-12 text-center space-y-4">
          <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-primary">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">No blog posts yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Publish your first blog post to engage visitors and boost SEO.
            </p>
          </div>
          <Button onClick={() => navigate('/admin/model/blog.post/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            New Blog Post
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={records}
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          loading={isLoading}
          onRowClick={row => navigate(`/admin/website/blog/${row.id}`)}
          emptyMessage="No blog posts found"
          emptyIcon={<FileText className="h-10 w-10" />}
        />
      )}
    </div>
  )
}
