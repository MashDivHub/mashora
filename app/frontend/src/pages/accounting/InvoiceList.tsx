import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, cn, type BadgeVariant } from '@mashora/design-system'
import { FileText, CheckCircle2, XCircle, Mail, Printer, Clock, Plus } from 'lucide-react'
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
  'id', 'name', 'partner_id', 'move_type', 'state', 'date', 'invoice_date',
  'invoice_date_due', 'amount_total', 'amount_residual', 'currency_id',
  'payment_state', 'invoice_user_id', 'invoice_origin', 'ref',
]

const STATE_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  posted: { label: 'Posted', variant: 'success' },
  cancel: { label: 'Cancelled', variant: 'destructive' },
}

const PAYMENT_BADGE: Record<string, { label: string; color: string }> = {
  not_paid: { label: 'Not Paid', color: 'text-amber-400' },
  partial: { label: 'Partial', color: 'text-blue-400' },
  in_payment: { label: 'In Payment', color: 'text-blue-400' },
  paid: { label: 'Paid', color: 'text-emerald-400' },
  reversed: { label: 'Reversed', color: 'text-red-400' },
}

const FILTERS: FilterOption[] = [
  { key: 'invoices', label: 'Invoices', domain: [['move_type', '=', 'out_invoice']] },
  { key: 'credit_notes', label: 'Credit Notes', domain: [['move_type', '=', 'out_refund']] },
  { key: 'bills', label: 'Vendor Bills', domain: [['move_type', '=', 'in_invoice']] },
  { key: 'refunds', label: 'Vendor Refunds', domain: [['move_type', '=', 'in_refund']] },
  { key: 'draft', label: 'Draft', domain: [['state', '=', 'draft']] },
  { key: 'not_paid', label: 'Not Paid', domain: [['payment_state', '=', 'not_paid']] },
  { key: 'overdue', label: 'Overdue', domain: [['invoice_date_due', '<', new Date().toISOString().split('T')[0]], ['payment_state', '!=', 'paid']] },
]

export default function InvoiceList() {
  useDocumentTitle('Invoices')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const initialFilter = searchParams.get('filter')
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>(initialFilter ? [initialFilter] : ['invoices'])
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>('invoice_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const pageSize = 40
  const { selected, clear, setSelected } = useBulkSelect()

  const domain: unknown[] = []
  if (search) domain.push('|', ['name', 'ilike', search], ['partner_id', 'ilike', search])
  for (const key of activeFilters) {
    const f = FILTERS.find(fl => fl.key === key)
    if (f?.domain) domain.push(...f.domain)
  }

  const order = sortField ? `${sortField} ${sortDir}` : 'invoice_date desc, id desc'

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['invoices', domain, page, order],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/account.move', {
        domain: domain.length ? domain : [['move_type', 'in', ['out_invoice', 'out_refund', 'in_invoice', 'in_refund']]],
        fields: LIST_FIELDS, offset: page * pageSize, limit: pageSize, order,
      })
      return data
    },
  })

  const title = activeFilters.includes('bills') ? 'Vendor Bills' :
    activeFilters.includes('credit_notes') ? 'Credit Notes' :
    activeFilters.includes('refunds') ? 'Vendor Refunds' : 'Invoices'

  async function bulkAction(ids: number[], action: (id: number) => Promise<unknown>, successMsg: string) {
    try {
      await Promise.all(ids.map(action))
      toast.success(`${successMsg} (${ids.length})`)
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      clear()
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, 'Action failed'))
    }
  }

  const bulkActions: BulkAction[] = [
    {
      key: 'post',
      label: 'Post',
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      confirm: 'Post {count} invoice(s)?',
      onClick: ids => bulkAction(ids, id => erpClient.raw.post(`/accounting/invoices/${id}/post`), 'Invoices posted'),
    },
    {
      key: 'cancel',
      label: 'Cancel',
      icon: <XCircle className="h-3.5 w-3.5" />,
      variant: 'destructive',
      confirm: 'Cancel {count} invoice(s)?',
      onClick: ids => bulkAction(ids, id => erpClient.raw.post(`/accounting/invoices/${id}/cancel`), 'Invoices cancelled'),
    },
    {
      key: 'send',
      label: 'Send by Email',
      icon: <Mail className="h-3.5 w-3.5" />,
      onClick: ids => bulkAction(
        ids,
        id => erpClient.raw.post('/model/account.move/call', { method: 'action_invoice_sent', ids: [id] }),
        'Sent emails',
      ),
    },
    {
      key: 'print',
      label: 'Print',
      icon: <Printer className="h-3.5 w-3.5" />,
      onClick: () => { toast.info('Use individual print for now') },
    },
  ]

  const columns: Column[] = [
    { key: 'name', label: 'Number', render: (_, row) => <span className="font-mono text-sm">{row.name || 'Draft'}</span> },
    { key: 'partner_id', label: 'Partner', format: v => Array.isArray(v) ? v[1] : '' },
    { key: 'invoice_date', label: 'Invoice Date', format: v => v ? new Date(v).toLocaleDateString() : '' },
    { key: 'invoice_date_due', label: 'Due Date', render: (v, row) => {
      if (!v) return ''
      const overdue = row.payment_state !== 'paid' && new Date(v) < new Date()
      return (
        <span
          className={cn('text-sm inline-flex items-center gap-1', overdue && 'text-red-400 font-medium')}
          aria-label={overdue ? `overdue ${new Date(v).toLocaleDateString()}` : undefined}
        >
          {overdue && <Clock className="h-3 w-3" aria-hidden="true" />}
          {new Date(v).toLocaleDateString()}
        </span>
      )
    }},
    { key: 'state', label: 'Status', render: v => {
      const s = STATE_BADGE[v] || { label: v, variant: 'secondary' as BadgeVariant }
      return <Badge variant={s.variant} className="rounded-full text-xs">{s.label}</Badge>
    }},
    { key: 'payment_state', label: 'Payment', render: v => {
      if (!v || v === 'invoicing_legacy') return ''
      const p = PAYMENT_BADGE[v] || { label: v, color: '' }
      return <span className={cn('text-xs font-medium', p.color)}>{p.label}</span>
    }},
    { key: 'amount_total', label: 'Total', align: 'right' as const, format: v => v ? `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '' },
    { key: 'amount_residual', label: 'Due', align: 'right' as const, render: v => {
      if (!v || v === 0) return <span className="text-emerald-400 text-sm">Paid</span>
      return <span className="font-mono text-sm font-medium">${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
    }},
    { key: 'invoice_origin', label: 'Source' },
  ]

  const records = data?.records || []
  const selectedSet = new Set(selected)
  const hasFilters = !!search || activeFilters.length > 0
  const showEmptyCta = !isLoading && !isError && records.length === 0 && page === 0 && !hasFilters

  return (
    <div className="space-y-4">
      <PageHeader title={title} subtitle="invoicing" onNew={() => navigate('/admin/invoicing/invoices/new')} />
      <SearchBar placeholder="Search invoices..." onSearch={v => { setSearch(v); setPage(0) }}
        filters={FILTERS} activeFilters={activeFilters}
        onFilterToggle={k => { setActiveFilters(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]); setPage(0) }} />
      <BulkActionBar selected={selected} onClear={clear} actions={bulkActions} />
      {showEmptyCta ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-12 text-center space-y-4">
          <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-primary">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">No invoices yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create your first invoice to start billing customers.
            </p>
          </div>
          <Button onClick={() => navigate('/admin/invoicing/invoices/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Create First Invoice
          </Button>
        </div>
      ) : (
        <DataTable columns={columns} data={records} total={data?.total} page={page} pageSize={pageSize}
          onPageChange={setPage} sortField={sortField} sortDir={sortDir}
          onSort={(f, d) => { setSortField(f); setSortDir(d) }} loading={isLoading}
          isError={isError} error={error} onRetry={() => refetch()}
          rowLink={row => `/admin/invoicing/invoices/${row.id}`}
          selectable
          selectedIds={selectedSet}
          onSelectionChange={(ids) => setSelected(Array.from(ids) as number[])}
          emptyMessage="No invoices found" emptyIcon={<FileText className="h-10 w-10" />} />
      )}
    </div>
  )
}
