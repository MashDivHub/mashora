import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, cn } from '@mashora/design-system'
import { FileText } from 'lucide-react'
import { DataTable, PageHeader, SearchBar, type Column, type FilterOption } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

const LIST_FIELDS = [
  'id', 'name', 'partner_id', 'move_type', 'state', 'date', 'invoice_date',
  'invoice_date_due', 'amount_total', 'amount_residual', 'currency_id',
  'payment_state', 'invoice_user_id', 'invoice_origin', 'ref',
]

const STATE_BADGE: Record<string, { label: string; variant: string }> = {
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

const TYPE_LABELS: Record<string, string> = {
  out_invoice: 'Invoice', out_refund: 'Credit Note',
  in_invoice: 'Bill', in_refund: 'Refund',
  entry: 'Entry', out_receipt: 'Receipt', in_receipt: 'Receipt',
}

export default function InvoiceList() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialFilter = searchParams.get('filter')
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>(initialFilter ? [initialFilter] : ['invoices'])
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>('invoice_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const pageSize = 40

  const domain: any[] = []
  if (search) domain.push('|', ['name', 'ilike', search], ['partner_id', 'ilike', search])
  for (const key of activeFilters) {
    const f = FILTERS.find(fl => fl.key === key)
    if (f?.domain) domain.push(...f.domain)
  }

  const order = sortField ? `${sortField} ${sortDir}` : 'invoice_date desc, id desc'

  const { data, isLoading } = useQuery({
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

  const columns: Column[] = [
    { key: 'name', label: 'Number', render: (_, row) => <span className="font-mono text-sm">{row.name || 'Draft'}</span> },
    { key: 'partner_id', label: 'Partner', format: v => Array.isArray(v) ? v[1] : '' },
    { key: 'invoice_date', label: 'Invoice Date', format: v => v ? new Date(v).toLocaleDateString() : '' },
    { key: 'invoice_date_due', label: 'Due Date', render: (v, row) => {
      if (!v) return ''
      const overdue = row.payment_state !== 'paid' && new Date(v) < new Date()
      return <span className={cn('text-sm', overdue && 'text-red-400 font-medium')}>{new Date(v).toLocaleDateString()}</span>
    }},
    { key: 'state', label: 'Status', render: v => {
      const s = STATE_BADGE[v] || { label: v, variant: 'secondary' }
      return <Badge variant={s.variant as any} className="rounded-full text-xs">{s.label}</Badge>
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

  return (
    <div className="space-y-4">
      <PageHeader title={title} subtitle="invoicing" onNew={() => navigate('/invoicing/invoices/new')} />
      <SearchBar placeholder="Search invoices..." onSearch={v => { setSearch(v); setPage(0) }}
        filters={FILTERS} activeFilters={activeFilters}
        onFilterToggle={k => { setActiveFilters(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]); setPage(0) }} />
      <DataTable columns={columns} data={data?.records || []} total={data?.total} page={page} pageSize={pageSize}
        onPageChange={setPage} sortField={sortField} sortDir={sortDir}
        onSort={(f, d) => { setSortField(f); setSortDir(d) }} loading={isLoading}
        rowLink={row => `/invoicing/invoices/${row.id}`} emptyMessage="No invoices found" emptyIcon={<FileText className="h-10 w-10" />} />
    </div>
  )
}
