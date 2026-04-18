import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge, type BadgeVariant } from '@mashora/design-system'
import { Layers } from 'lucide-react'
import { DataTable, PageHeader, SearchBar, type Column } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BomRecord {
  id: number
  code: string | false
  product_tmpl_id: [number, string]
  product_qty: number
  product_uom_id: [number, string]
  type: 'normal' | 'phantom'
  bom_line_ids: number[]
  company_id: [number, string]
}

interface BomListResponse {
  records: BomRecord[]
  total: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

type TypeFilter = 'all' | 'normal' | 'phantom'

const TYPE_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  normal:  { label: 'Manufacture', variant: 'default' },
  phantom: { label: 'Kit',         variant: 'info' },
}

const TYPE_FILTER_OPTIONS: { key: TypeFilter; label: string }[] = [
  { key: 'all',     label: 'All' },
  { key: 'normal',  label: 'Manufacture' },
  { key: 'phantom', label: 'Kit' },
]

// ─── Columns ──────────────────────────────────────────────────────────────────

const columns: Column<BomRecord>[] = [
  {
    key: 'code',
    label: 'Reference',
    render: (v) => (
      <span className="font-mono text-sm">
        {v || '—'}
      </span>
    ),
  },
  {
    key: 'product_tmpl_id',
    label: 'Product',
    format: (v) => (Array.isArray(v) ? v[1] : ''),
  },
  {
    key: 'product_qty',
    label: 'Quantity',
    align: 'right',
    format: (v) => String(v ?? ''),
  },
  {
    key: 'product_uom_id',
    label: 'UoM',
    format: (v) => (Array.isArray(v) ? v[1] : ''),
  },
  {
    key: 'type',
    label: 'Type',
    render: (v) => {
      const b = TYPE_BADGE[v] || { label: v, variant: 'secondary' as BadgeVariant }
      return (
        <Badge variant={b.variant} className="rounded-full text-xs">
          {b.label}
        </Badge>
      )
    },
  },
  {
    key: 'bom_line_ids',
    label: 'Components',
    align: 'right',
    render: (v) => (
      <span className="tabular-nums text-sm">
        {Array.isArray(v) ? v.length : 0}
      </span>
    ),
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function BomList() {
  const [search, setSearch]         = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [page, setPage]             = useState(0)
  const [sortField, setSortField]   = useState<string | null>(null)
  const [sortDir, setSortDir]       = useState<'asc' | 'desc'>('asc')
  const pageSize = 40

  const order = sortField ? `${sortField} ${sortDir}` : undefined

  const { data, isLoading } = useQuery<BomListResponse>({
    queryKey: ['boms', search, typeFilter, page, order],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/manufacturing/boms', {
        type:   typeFilter === 'all' ? undefined : typeFilter,
        search: search || undefined,
        offset: page * pageSize,
        limit:  pageSize,
        order,
      })
      return data
    },
  })

  return (
    <div className="space-y-4">
      <PageHeader title="Bills of Materials" subtitle="manufacturing" />

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <SearchBar
            placeholder="Search BOMs..."
            onSearch={(v) => { setSearch(v); setPage(0) }}
          />
        </div>

        {/* Type filter pills */}
        <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-muted/30 p-1 shrink-0">
          {TYPE_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => { setTypeFilter(opt.key); setPage(0) }}
              className={[
                'rounded-lg px-3 py-1 text-xs font-medium transition-colors',
                typeFilter === opt.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <DataTable<BomRecord>
        columns={columns}
        data={data?.records ?? []}
        total={data?.total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        sortField={sortField}
        sortDir={sortDir}
        onSort={(f, d) => { setSortField(f); setSortDir(d) }}
        loading={isLoading}
        rowLink={(row) => `/admin/manufacturing/bom/${row.id}`}
        emptyMessage="No bills of materials found"
        emptyIcon={<Layers className="h-10 w-10" />}
      />
    </div>
  )
}
