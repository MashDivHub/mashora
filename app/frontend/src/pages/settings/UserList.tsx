import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button } from '@mashora/design-system'
import { Users, Shield, Plus } from 'lucide-react'
import { DataTable, PageHeader, SearchBar, type Column, type FilterOption } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

const LIST_FIELDS = ['id', 'name', 'login', 'email', 'image_128', 'active', 'company_id', 'share', 'lang', 'tz']

const FILTERS: FilterOption[] = [
  { key: 'internal', label: 'Internal Users', domain: [['share', '=', false]] },
  { key: 'portal', label: 'Portal Users', domain: [['share', '=', true]] },
  { key: 'archived', label: 'Archived', domain: [['active', '=', false]] },
]

export default function UserList() {
  useDocumentTitle('Users')
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const pageSize = 40

  const domain: unknown[] = []
  if (search) domain.push('|', '|', ['name', 'ilike', search], ['login', 'ilike', search], ['email', 'ilike', search])
  for (const key of activeFilters) {
    const f = FILTERS.find(fl => fl.key === key)
    if (f?.domain) domain.push(...f.domain)
  }

  const order = sortField ? `${sortField} ${sortDir}` : 'name asc'

  const { data, isLoading } = useQuery({
    queryKey: ['users', domain, page, order],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/res.users', {
        domain: domain.length ? domain : undefined,
        fields: LIST_FIELDS, offset: page * pageSize, limit: pageSize, order,
      })
      return data
    },
  })

  const columns: Column[] = [
    {
      key: 'name', label: 'User',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          {row.image_128 ? (
            <img src={`data:image/png;base64,${row.image_128}`} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
              {(row.name?.[0] || '?').toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{row.name}</p>
            <p className="text-xs text-muted-foreground truncate">{row.login}</p>
          </div>
        </div>
      ),
    },
    { key: 'email', label: 'Email', render: v => v ? <a href={`mailto:${v}`} className="text-sm text-primary hover:underline" onClick={e => e.stopPropagation()}>{v}</a> : '' },
    {
      key: 'share', label: 'Type',
      render: v => v ? <Badge variant="secondary" className="rounded-full text-xs">Portal</Badge> : <Badge variant="default" className="rounded-full text-xs gap-1"><Shield className="h-3 w-3" /> Internal</Badge>,
    },
    { key: 'company_id', label: 'Company', format: v => Array.isArray(v) ? v[1] : '' },
    { key: 'lang', label: 'Language' },
    {
      key: 'active', label: 'Status',
      render: v => v ? <Badge variant="default" className="rounded-full text-xs bg-emerald-600">Active</Badge> : <Badge variant="destructive" className="rounded-full text-xs">Archived</Badge>,
    },
  ]

  const records = data?.records || []
  const hasFilters = search.length > 0 || activeFilters.length > 0
  const showEmptyCta = !isLoading && records.length === 0 && !hasFilters

  return (
    <div className="space-y-4">
      <PageHeader title="Users" subtitle="settings" onNew={() => navigate('/admin/settings/users/new')} backTo="/admin/settings" />
      <SearchBar placeholder="Search users..." onSearch={v => { setSearch(v); setPage(0) }}
        filters={FILTERS} activeFilters={activeFilters}
        onFilterToggle={k => { setActiveFilters(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]); setPage(0) }} />
      {showEmptyCta ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-12 text-center space-y-4">
          <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-primary">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">No users yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Invite teammates to start collaborating inside your workspace.
            </p>
          </div>
          <Button onClick={() => navigate('/admin/settings/users/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Invite First User
          </Button>
        </div>
      ) : (
        <DataTable columns={columns} data={records} total={data?.total} page={page} pageSize={pageSize}
          onPageChange={setPage} sortField={sortField} sortDir={sortDir}
          onSort={(f, d) => { setSortField(f); setSortDir(d) }} loading={isLoading}
          rowLink={row => `/admin/settings/users/${row.id}`} emptyMessage="No users found" emptyIcon={<Users className="h-10 w-10" />} />
      )}
    </div>
  )
}
