import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button } from '@mashora/design-system'
import { Globe, Eye, EyeOff, Plus } from 'lucide-react'
import { DataTable, PageHeader, SearchBar, type Column, type FilterOption } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

const FIELDS = ['id', 'name', 'url', 'website_id', 'website_published', 'date_publish', 'website_indexed']

const FILTERS: FilterOption[] = [
  { key: 'published', label: 'Published', domain: [['website_published', '=', true]] },
  { key: 'unpublished', label: 'Unpublished', domain: [['website_published', '=', false]] },
  { key: 'indexed', label: 'Indexed', domain: [['website_indexed', '=', true]] },
]

export default function CmsPages() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const domain: unknown[] = []
  if (search) domain.push('|', ['name', 'ilike', search], ['url', 'ilike', search])
  for (const key of activeFilters) {
    const f = FILTERS.find(fl => fl.key === key)
    if (f?.domain) domain.push(...f.domain)
  }

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['website-pages', domain, page],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/website.page', {
        domain: domain.length ? domain : undefined,
        fields: FIELDS, offset: page * 40, limit: 40,
        order: sortField ? `${sortField} ${sortDir}` : 'name asc',
      })
      return data
    },
  })

  const columns: Column[] = [
    {
      key: 'name', label: 'Page Name',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium">{row.name}</span>
        </div>
      ),
    },
    { key: 'url', label: 'URL', render: v => <span className="text-sm font-mono text-muted-foreground">{v}</span> },
    {
      key: 'website_published', label: 'Status',
      render: v => v ? (
        <Badge variant="default" className="rounded-full text-xs gap-1 bg-emerald-600"><Eye className="h-3 w-3" /> Published</Badge>
      ) : (
        <Badge variant="secondary" className="rounded-full text-xs gap-1"><EyeOff className="h-3 w-3" /> Draft</Badge>
      ),
    },
    { key: 'website_indexed', label: 'Indexed', render: v => v ? 'Yes' : 'No' },
    { key: 'date_publish', label: 'Published On', format: v => v ? new Date(v).toLocaleDateString() : '' },
    { key: 'website_id', label: 'Website', format: v => Array.isArray(v) ? v[1] : '' },
  ]

  const records = data?.records || []
  const hasFilters = search.length > 0 || activeFilters.length > 0
  const showEmptyCta = !isLoading && !isError && records.length === 0 && !hasFilters

  return (
    <div className="space-y-4">
      <PageHeader
        title="Website Pages"
        subtitle="website"
        onNew={() => navigate('/admin/model/website.page/new')}
        newLabel="New Page"
      />
      <SearchBar placeholder="Search pages..." onSearch={v => { setSearch(v); setPage(0) }}
        filters={FILTERS} activeFilters={activeFilters}
        onFilterToggle={k => { setActiveFilters(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]); setPage(0) }} />
      {showEmptyCta ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-12 text-center space-y-4">
          <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-primary">
            <Globe className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">No website pages yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Create your first CMS page to start building out your website content.
            </p>
          </div>
          <Button onClick={() => navigate('/admin/model/website.page/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Create First Page
          </Button>
        </div>
      ) : (
        <DataTable columns={columns} data={records} total={data?.total} page={page} pageSize={40}
          onPageChange={setPage} sortField={sortField} sortDir={sortDir}
          onSort={(f, d) => { setSortField(f); setSortDir(d) }} loading={isLoading}
          isError={isError} error={error} onRetry={() => refetch()}
          rowLink={row => `/admin/model/website.page/${row.id}`}
          emptyMessage="No pages found" emptyIcon={<Globe className="h-10 w-10" />} />
      )}
    </div>
  )
}
