import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, cn, type BadgeVariant } from '@mashora/design-system'
import { Truck, CheckCircle2, XCircle, ListChecks, X, Clock } from 'lucide-react'
import {
  DataTable, PageHeader, SearchBar, BulkActionBar,
  toast,
  type Column, type FilterOption, type BulkAction,
} from '@/components/shared'
import { useBulkSelect } from '@/hooks/useBulkSelect'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

const LIST_FIELDS = [
  'id', 'name', 'partner_id', 'state', 'picking_type_id', 'picking_type_code',
  'origin', 'scheduled_date', 'date_done', 'location_id', 'location_dest_id',
  'backorder_id', 'user_id',
]

const STATE_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  waiting: { label: 'Waiting', variant: 'warning' },
  confirmed: { label: 'Waiting', variant: 'warning' },
  assigned: { label: 'Ready', variant: 'info' },
  done: { label: 'Done', variant: 'success' },
  cancel: { label: 'Cancelled', variant: 'destructive' },
}

const FILTERS: FilterOption[] = [
  { key: 'receipts', label: 'Receipts', domain: [['picking_type_code', '=', 'incoming']] },
  { key: 'deliveries', label: 'Deliveries', domain: [['picking_type_code', '=', 'outgoing']] },
  { key: 'internal', label: 'Internal', domain: [['picking_type_code', '=', 'internal']] },
  { key: 'ready', label: 'Ready', domain: [['state', '=', 'assigned']] },
  { key: 'waiting', label: 'Waiting', domain: [['state', 'in', ['waiting', 'confirmed']]] },
  { key: 'late', label: 'Late', domain: [['scheduled_date', '<', new Date().toISOString()], ['state', 'not in', ['done', 'cancel']]] },
]

export default function TransferList() {
  useDocumentTitle('Transfers')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialFilter = searchParams.get('filter')
  const productTmplId = searchParams.get('product_tmpl_id')
  const productName = searchParams.get('product_name') || ''
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>(initialFilter ? [initialFilter] : [])
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>('scheduled_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const pageSize = 40
  const { selected, clear, setSelected } = useBulkSelect()

  const domain: unknown[] = []
  if (productTmplId) domain.push(['move_lines.product.product_tmpl_id', '=', parseInt(productTmplId)])
  if (search) domain.push('|', ['name', 'ilike', search], ['origin', 'ilike', search])
  for (const key of activeFilters) {
    const f = FILTERS.find(fl => fl.key === key)
    if (f?.domain) domain.push(...f.domain)
  }

  const clearProductFilter = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('product_tmpl_id')
    next.delete('product_name')
    setSearchParams(next)
  }

  const order = sortField ? `${sortField} ${sortDir}` : 'scheduled_date desc'

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['transfers', domain, page, order],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/stock.picking', {
        domain: domain.length ? domain : undefined,
        fields: LIST_FIELDS, offset: page * pageSize, limit: pageSize, order,
      })
      return data
    },
  })

  const title = activeFilters.includes('receipts') ? 'Receipts' :
    activeFilters.includes('deliveries') ? 'Deliveries' :
    activeFilters.includes('internal') ? 'Internal Transfers' : 'Transfers'

  const TYPE_ICON: Record<string, string> = { incoming: 'text-emerald-400', outgoing: 'text-blue-400', internal: 'text-violet-400' }

  async function bulkAction(ids: number[], action: (id: number) => Promise<unknown>, successMsg: string) {
    try {
      await Promise.all(ids.map(action))
      toast.success(`${successMsg} (${ids.length})`)
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
      clear()
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, 'Action failed'))
    }
  }

  const bulkActions: BulkAction[] = [
    {
      key: 'validate',
      label: 'Validate',
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      confirm: 'Validate {count} transfer(s)?',
      onClick: ids => bulkAction(
        ids,
        id => erpClient.raw.post('/model/stock.picking/call', { method: 'button_validate', ids: [id] }),
        'Transfers validated',
      ),
    },
    {
      key: 'todo',
      label: 'Mark as Todo',
      icon: <ListChecks className="h-3.5 w-3.5" />,
      onClick: ids => bulkAction(
        ids,
        id => erpClient.raw.post('/model/stock.picking/call', { method: 'action_assign', ids: [id] }),
        'Transfers marked as todo',
      ),
    },
    {
      key: 'cancel',
      label: 'Cancel',
      icon: <XCircle className="h-3.5 w-3.5" />,
      variant: 'destructive',
      confirm: 'Cancel {count} transfer(s)?',
      onClick: ids => bulkAction(
        ids,
        id => erpClient.raw.post('/model/stock.picking/call', { method: 'action_cancel', ids: [id] }),
        'Transfers cancelled',
      ),
    },
  ]

  const columns: Column[] = [
    { key: 'name', label: 'Reference', render: (_, row) => <span className="font-mono text-sm">{row.name}</span> },
    { key: 'partner_id', label: 'Contact', format: v => Array.isArray(v) ? v[1] : '' },
    { key: 'picking_type_id', label: 'Operation', render: (v, row) => (
      <span className={cn('text-sm font-medium', TYPE_ICON[row.picking_type_code] || '')}>
        {Array.isArray(v) ? v[1] : ''}
      </span>
    )},
    { key: 'origin', label: 'Source' },
    { key: 'scheduled_date', label: 'Scheduled', render: (v, row) => {
      if (!v) return ''
      const late = row.state !== 'done' && row.state !== 'cancel' && new Date(v) < new Date()
      return (
        <span
          className={cn('text-sm inline-flex items-center gap-1', late && 'text-red-400 font-medium')}
          aria-label={late ? `late ${new Date(v).toLocaleDateString()}` : undefined}
        >
          {late && <Clock className="h-3 w-3" aria-hidden="true" />}
          {new Date(v).toLocaleDateString()}
        </span>
      )
    }},
    { key: 'date_done', label: 'Done', format: v => v ? new Date(v).toLocaleDateString() : '' },
    { key: 'state', label: 'Status', render: v => {
      const s = STATE_BADGE[v] || { label: v, variant: 'secondary' as BadgeVariant }
      return <Badge variant={s.variant} className="rounded-full text-xs">{s.label}</Badge>
    }},
    { key: 'backorder_id', label: 'Back Order', format: v => Array.isArray(v) ? v[1] : '' },
  ]

  const records = data?.records || []
  const selectedSet = new Set(selected)

  return (
    <div className="space-y-4">
      <PageHeader title={title} subtitle="inventory" onNew={() => navigate('/admin/inventory/transfers/new')} />
      {productTmplId && (
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs">
          <span>Product: <strong>{productName || `#${productTmplId}`}</strong></span>
          <button type="button" onClick={clearProductFilter} className="hover:text-destructive" title="Clear product filter" aria-label="Clear product filter">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <SearchBar placeholder="Search transfers..." onSearch={v => { setSearch(v); setPage(0) }}
        filters={FILTERS} activeFilters={activeFilters}
        onFilterToggle={k => { setActiveFilters(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]); setPage(0) }} />
      <BulkActionBar selected={selected} onClear={clear} actions={bulkActions} />
      <DataTable columns={columns} data={records} total={data?.total} page={page} pageSize={pageSize}
        onPageChange={setPage} sortField={sortField} sortDir={sortDir}
        onSort={(f, d) => { setSortField(f); setSortDir(d) }} loading={isLoading}
        isError={isError} error={error} onRetry={() => refetch()}
        rowLink={row => `/admin/inventory/transfers/${row.id}`}
        selectable
        selectedIds={selectedSet}
        onSelectionChange={(ids) => setSelected(Array.from(ids) as number[])}
        emptyMessage="No transfers yet. Create a receipt, delivery, or internal move to get started." emptyIcon={<Truck className="h-10 w-10" />} />
    </div>
  )
}
