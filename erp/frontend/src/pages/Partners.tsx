import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  PageHeader, Button, DataTable, Input, Badge, Tabs, TabsList, TabsTrigger,
} from '@mashora/design-system'
import { Plus, Search, Building2, User } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'
import { useState } from 'react'

interface Partner {
  id: number
  name: string
  email: string | false
  phone: string | false
  city: string | false
  country_id: [number, string] | false
  is_company: boolean
  active: boolean
}

interface Column<T> {
  key: string
  header: string
  cell?: (row: T) => React.ReactNode
  className?: string
}

type TabFilter = 'all' | 'companies' | 'individuals'

const columns: Column<Partner>[] = [
  {
    key: 'name',
    header: 'Name',
    cell: (row) => (
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/40">
          {row.is_company
            ? <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            : <User className="h-3.5 w-3.5 text-muted-foreground" />
          }
        </div>
        <span className="font-medium">{row.name}</span>
      </div>
    ),
  },
  {
    key: 'email',
    header: 'Email',
    cell: (row) => row.email
      ? <span className="text-sm text-muted-foreground">{row.email}</span>
      : <span className="text-muted-foreground/40">—</span>,
  },
  {
    key: 'phone',
    header: 'Phone',
    cell: (row) => row.phone
      ? <span className="font-mono text-sm">{row.phone}</span>
      : <span className="text-muted-foreground/40">—</span>,
  },
  {
    key: 'city',
    header: 'City',
    cell: (row) => row.city || <span className="text-muted-foreground/40">—</span>,
  },
  {
    key: 'is_company',
    header: 'Type',
    cell: (row) => (
      <Badge
        variant={row.is_company ? 'default' : 'secondary'}
        className="rounded-full px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
      >
        {row.is_company ? 'Company' : 'Individual'}
      </Badge>
    ),
  },
  {
    key: 'active',
    header: 'Status',
    cell: (row) => (
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${row.active ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
        <span className="text-xs text-muted-foreground">{row.active ? 'Active' : 'Archived'}</span>
      </div>
    ),
  },
]

export default function Partners() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<TabFilter>('all')

  const domain: any[] = []
  if (search) domain.push(['name', 'ilike', search])
  if (tab === 'companies') domain.push(['is_company', '=', true])
  if (tab === 'individuals') domain.push(['is_company', '=', false])

  const { data, isLoading } = useQuery({
    queryKey: ['partners', search, tab],
    queryFn: () =>
      erpClient.list<Partner>('res.partner', {
        domain,
        fields: ['name', 'email', 'phone', 'city', 'country_id', 'is_company', 'active'],
        limit: 50,
        order: 'name asc',
      }),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Directory"
        title="Contacts"
        description={`${data?.total ?? '—'} contacts in the system`}
        actions={
          <Button className="rounded-2xl">
            <Plus className="h-4 w-4" />
            New Contact
          </Button>
        }
      />

      {/* Search + tabs bar */}
      <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-2xl pl-9 border-border/60 bg-muted/30 focus:bg-background"
            />
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabFilter)}>
            <TabsList className="rounded-2xl">
              <TabsTrigger value="all" className="rounded-xl">All</TabsTrigger>
              <TabsTrigger value="companies" className="rounded-xl">Companies</TabsTrigger>
              <TabsTrigger value="individuals" className="rounded-xl">Individuals</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
        <DataTable
          columns={columns}
          data={data?.records ?? []}
          loading={isLoading}
          emptyMessage="No contacts found."
          onRowClick={(row) => navigate(`/partners/${row.id}`)}
        />
      </div>
    </div>
  )
}
