import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  PageHeader, Button, Input, Badge, Tabs, TabsList, TabsTrigger,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Skeleton, cn,
} from '@mashora/design-system'
import { Plus, Search, FileText, ChevronRight } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

interface Invoice {
  id: number
  name: string | false
  ref: string | false
  move_type: string
  state: string
  payment_state: string
  partner_id: [number, string] | false
  invoice_date: string | false
  invoice_date_due: string | false
  amount_untaxed: number
  amount_tax: number
  amount_total: number
  amount_residual: number
  currency_id: [number, string] | false
}

const stateVariants: Record<string, 'secondary' | 'default' | 'destructive'> = {
  draft: 'secondary',
  posted: 'default',
  cancel: 'destructive',
}

const stateLabels: Record<string, string> = {
  draft: 'Draft',
  posted: 'Posted',
  cancel: 'Cancelled',
}

const paymentStateVariants: Record<string, 'warning' | 'info' | 'success' | 'destructive'> = {
  not_paid: 'warning',
  partial: 'info',
  paid: 'success',
  in_payment: 'info',
  reversed: 'destructive',
}

const paymentStateLabels: Record<string, string> = {
  not_paid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
  in_payment: 'In Payment',
  reversed: 'Reversed',
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

type TabFilter = 'all' | 'draft' | 'posted' | 'paid' | 'overdue'

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i} className="hover:bg-transparent">
          {Array.from({ length: cols }).map((__, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full max-w-[120px]" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

export default function InvoiceList() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabFilter>('all')
  const [search, setSearch] = useState('')
  const [moveType, setMoveType] = useState<string>('out_invoice')

  const params: Record<string, any> = {
    move_type: [moveType],
    search: search || undefined,
    limit: 50,
  }

  if (tab === 'draft') params.state = ['draft']
  else if (tab === 'posted') {
    params.state = ['posted']
    params.payment_state = ['not_paid', 'partial', 'in_payment']
  } else if (tab === 'paid') {
    params.state = ['posted']
    params.payment_state = ['paid']
  } else if (tab === 'overdue') {
    params.state = ['posted']
    params.payment_state = ['not_paid', 'partial']
  }

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', tab, search, moveType],
    queryFn: () => erpClient.raw.post('/accounting/invoices', params).then((r) => r.data),
  })

  const typeLabel = moveType.includes('in_') ? 'Bills' : 'Invoices'
  const records: Invoice[] = data?.records ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title={typeLabel}
        description={isLoading ? 'Loading...' : `${data?.total ?? 0} ${typeLabel.toLowerCase()} found`}
        actions={
          <Button onClick={() => navigate(`/accounting/invoices/new?type=${moveType}`)}>
            <Plus className="h-4 w-4" />
            New {moveType.includes('in_') ? 'Bill' : 'Invoice'}
          </Button>
        }
      />

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={moveType} onValueChange={(v) => { setMoveType(v); setTab('all') }}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="out_invoice">Customer Invoices</SelectItem>
            <SelectItem value="out_refund">Credit Notes</SelectItem>
            <SelectItem value="in_invoice">Vendor Bills</SelectItem>
            <SelectItem value="in_refund">Vendor Refunds</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={`Search ${typeLabel.toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Status tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabFilter)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="posted">Unpaid</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Table card */}
      <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/70 bg-muted/20 hover:bg-muted/20">
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Number</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Partner</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Date</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Due Date</TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Total</TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Due</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Status</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton cols={8} />
            ) : records.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">No {typeLabel.toLowerCase()} found.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              records.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer border-border/40 hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/accounting/invoices/${row.id}`)}
                >
                  <TableCell>
                    <span className="font-mono font-medium text-sm">
                      {row.name || 'Draft'}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.partner_id ? row.partner_id[1] : '—'}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.invoice_date || '—'}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.invoice_date_due || '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-mono text-sm">{formatCurrency(row.amount_total)}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn(
                      'font-mono text-sm font-medium',
                      row.amount_residual > 0 ? 'text-warning' : 'text-muted-foreground'
                    )}>
                      {formatCurrency(row.amount_residual)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={stateVariants[row.state] ?? 'secondary'}>
                        {stateLabels[row.state] ?? row.state}
                      </Badge>
                      {row.state === 'posted' && row.payment_state && (
                        <Badge variant={paymentStateVariants[row.payment_state] ?? 'secondary'}>
                          {paymentStateLabels[row.payment_state] ?? row.payment_state.replace('_', ' ')}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
