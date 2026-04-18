import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Input, Button, Skeleton,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@mashora/design-system'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface TrialBalanceRow {
  account_id: number
  account_code: string
  account_name: string
  account_type: string
  debit: number
  credit: number
  balance: number
}

const fmt = (n: number) =>
  '$' + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i} className="hover:bg-transparent border-border/40">
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
        </TableRow>
      ))}
    </>
  )
}

export default function TrialBalance() {
  const today = new Date().toISOString().split('T')[0]
  const firstOfYear = `${new Date().getFullYear()}-01-01`

  const [dateFrom, setDateFrom] = useState(firstOfYear)
  const [dateTo, setDateTo] = useState(today)

  const { data, isFetching, refetch } = useQuery<TrialBalanceRow[]>({
    queryKey: ['trial-balance', dateFrom, dateTo],
    queryFn: () =>
      erpClient.raw
        .get('/accounting/reports/trial-balance', { params: { date_from: dateFrom, date_to: dateTo } })
        .then((r) => r.data),
    enabled: false,
  })

  const rows: TrialBalanceRow[] = data ?? []

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0)
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0)
  const totalBalance = rows.reduce((s, r) => s + r.balance, 0)

  return (
    <div className="space-y-6">
      <PageHeader title="Trial Balance" subtitle="accounting" />

      {/* Date filter */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">From</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">To</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-44"
            />
          </div>
          <Button
            size="sm"
            className="rounded-xl"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? 'Generating…' : 'Generate'}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border/30 bg-card/50 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 bg-muted/10 hover:bg-muted/10">
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Account Code
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Account Name
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Type
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground text-right">
                  Debit
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground text-right">
                  Credit
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground text-right">
                  Balance
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isFetching ? (
                <TableSkeleton />
              ) : rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground">
                    {data === undefined
                      ? 'Select a date range and click Generate.'
                      : 'No accounts found for this period.'}
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {rows.map((row) => (
                    <TableRow
                      key={row.account_id}
                      className="border-border/40 hover:bg-muted/50 transition-colors"
                    >
                      <TableCell>
                        <span className="font-mono text-sm font-semibold tracking-wide">
                          {row.account_code}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{row.account_name}</TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {row.account_type.replace(/_/g, ' ')}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-right text-sm">{fmt(row.debit)}</TableCell>
                      <TableCell className="font-mono text-right text-sm">{fmt(row.credit)}</TableCell>
                      <TableCell
                        className={`font-mono text-right text-sm font-bold ${
                          row.balance < 0 ? 'text-red-400' : ''
                        }`}
                        aria-label={row.balance < 0 ? `negative ${fmt(row.balance)}` : undefined}
                      >
                        {row.balance < 0 ? `(${fmt(row.balance)})` : fmt(row.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Footer totals */}
                  <TableRow className="border-t-2 border-border/60 bg-muted/20 hover:bg-muted/20 font-semibold">
                    <TableCell colSpan={3} className="text-sm font-semibold">
                      Totals
                    </TableCell>
                    <TableCell className="font-mono text-right text-sm font-semibold">{fmt(totalDebit)}</TableCell>
                    <TableCell className="font-mono text-right text-sm font-semibold">{fmt(totalCredit)}</TableCell>
                    <TableCell
                      className={`font-mono text-right text-sm font-bold ${
                        totalBalance < 0 ? 'text-red-400' : ''
                      }`}
                      aria-label={totalBalance < 0 ? `negative ${fmt(totalBalance)}` : undefined}
                    >
                      {totalBalance < 0 ? `(${fmt(totalBalance)})` : fmt(totalBalance)}
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
