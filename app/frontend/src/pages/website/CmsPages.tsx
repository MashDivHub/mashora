import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge, cn } from '@mashora/design-system'
import { Globe, Eye, EyeOff } from 'lucide-react'
import { DataTable, PageHeader, SearchBar, type Column, type FilterOption } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

const FIELDS = ['id', 'name', 'url', 'website_id', 'website_published', 'date_publish', 'website_indexed']

const FILTERS: FilterOption[] = [
  { key: 'published', label: 'Published', domain: [['website_published', '=', true]] },
  { key: 'unpublished', label: 'Unpublished', domain: [['website_published', '=', false]] },
  { key: 'indexed', label: 'Indexed', domain: [['website_indexed', '=', true]] },
]

export default function CmsPages() {
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

  return (
    <div className="space-y-4">
      <PageHeader title="Website Pages" subtitle="website" />
      <SearchBar placeholder="Search pages..." onSearch={v => { setSearch(v); setPage(0) }}
        filters={FILTERS} activeFilters={activeFilters}
        onFilterToggle={k => { setActiveFilters(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]); setPage(0) }} />
      <DataTable columns={columns} data={data?.records || []} total={data?.total} page={page} pageSize={40}
        onPageChange={setPage} sortField={sortField} sortDir={sortDir}
        onSort={(f, d) => { setSortField(f); setSortDir(d) }} loading={isLoading}
        isError={isError} error={error} onRetry={() => refetch()}
        emptyMessage="No pages found" emptyIcon={<Globe className="h-10 w-10" />} />
    </div>
  )
}
