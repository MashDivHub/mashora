import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  PageHeader, Input, Badge, Tabs, TabsList, TabsTrigger,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Skeleton, CardTitle, cn,
} from '@mashora/design-system'
import { Search, ArrowDownLeft, ArrowUpRight, CreditCard, CheckCircle2, Circle } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

interface Payment {
  id: number
  name: string | false
  state: string
  payment_type: string
  partner_id: [number, string] | false
  amount: number
  date: string
  journal_id: [number, string] | false
  is_reconciled: boolean
}

const stateVariants: Record<string, 'secondary' | 'info' | 'success' | 'destructive'> = {
  draft: 'secondary',
  in_process: 'info',
  paid: 'success',
  canceled: 'destructive',
  rejected: 'destructive',
}

const stateLabels: Record<string, string> = {
  draft: 'Draft',
  in_process: 'In Process',
  paid: 'Paid',
  canceled: 'Cancelled',
  rejected: 'Rejected',
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 7 }).map((_, i) => (
        <TableRow key={i} className="hover:bg-transparent border-border/40">
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-5 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-36" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-5 w-16 rounded-md" /></TableCell>
          <TableCell><Skeleton className="h-5 w-12 rounded-md" /></TableCell>
        </TableRow>
      ))}
    </>
  )
}

export default function Payments() {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')

  const params: Record<string, any> = { limit: 50 }
  if (search) params.search = search
  if (tab === 'inbound') params.payment_type = 'inbound'
  if (tab === 'outbound') params.payment_type = 'outbound'

  const { data, isLoading } = useQuery({
    queryKey: ['payments', search, tab],
    queryFn: () => erpClient.raw.post('/accounting/payments', params).then((r) => r.data),
  })

  const records: Payment[] = data?.records ?? []

  // Derive summary totals from visible records
  const totalInbound = records
    .filter((p) => p.payment_type === 'inbound')
    .reduce((sum, p) => sum + p.amount, 0)
  const totalOutbound = records
    .filter((p) => p.payment_type === 'outbound')
    .reduce((sum, p) => sum + p.amount, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description={isLoading ? 'Loading...' : `${data?.total ?? 0} payments`}
      />

      {/* Summary stat strip */}
      {!isLoading && records.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="group rounded-3xl border border-border/60 bg-card/90 p-5 shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-border/70 bg-muted/60 p-2.5 transition-all duration-300 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-transparent">
                <ArrowDownLeft className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Total Received
                </p>
                <p className="font-mono text-xl font-semibold tracking-tight">
                  {formatCurrency(totalInbound)}
                </p>
              </div>
            </div>
          </div>
          <div className="group rounded-3xl border border-border/60 bg-card/90 p-5 shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-border/70 bg-muted/60 p-2.5 transition-all duration-300 group-hover:bg-destructive group-hover:text-destructive-foreground group-hover:border-transparent">
                <ArrowUpRight className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Total Sent
                </p>
                <p className="font-mono text-xl font-semibold tracking-tight">
                  {formatCurrency(totalOutbound)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search payments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Direction tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="inbound">Received</TabsTrigger>
          <TabsTrigger value="outbound">Sent</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Payments table card */}
      <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/70 bg-muted/20 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl border border-border/70 bg-muted/60 p-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-sm font-semibold">Payments</CardTitle>
          </div>
          {!isLoading && (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {records.length}
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 bg-muted/10 hover:bg-muted/10">
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Number</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Type</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Partner</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Date</TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Amount</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Journal</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Status</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Reconciled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeleton />
              ) : records.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={8} className="h-40 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
                        <CreditCard className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">No payments found.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                records.map((row) => (
                  <TableRow
                    key={row.id}
                    className="border-border/40 hover:bg-muted/50 transition-colors"
                  >
                    <TableCell>
                      <span className="font-mono text-sm font-medium">
                        {row.name || 'Draft'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                        row.payment_type === 'inbound'
                          ? 'bg-success/10 text-success'
                          : 'bg-destructive/10 text-destructive'
                      )}>
                        {row.payment_type === 'inbound' ? (
                          <ArrowDownLeft className="h-3 w-3" />
                        ) : (
                          <ArrowUpRight className="h-3 w-3" />
                        )}
                        {row.payment_type === 'inbound' ? 'Received' : 'Sent'}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.partner_id ? row.partner_id[1] : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.date}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn(
                        'font-mono text-sm font-semibold',
                        row.payment_type === 'inbound' ? 'text-success' : 'text-foreground'
                      )}>
                        {formatCurrency(row.amount)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.journal_id ? row.journal_id[1] : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={stateVariants[row.state] ?? 'secondary'}>
                        {stateLabels[row.state] ?? row.state}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {row.is_reconciled ? (
                        <div className="flex items-center gap-1.5 text-success">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-xs font-medium">Yes</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-muted-foreground/50">
                          <Circle className="h-4 w-4" />
                          <span className="text-xs">No</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
