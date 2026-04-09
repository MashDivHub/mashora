import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Input, Button, Skeleton,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@mashora/design-system'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface PLRow {
  account_id: number
  account_code: string
  account_name: string
  balance: number
}

interface PLData {
  income: PLRow[]
  expense: PLRow[]
  total_income: number
  total_expense: number
  net_profit: number
}

const fmt = (n: number) =>
  '$' + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function SectionSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i} className="hover:bg-transparent border-border/40">
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
        </TableRow>
      ))}
    </>
  )
}

function AccountSection({
  title,
  rows,
  subtotal,
  isFetching,
  subtotalLabel,
}: {
  title: string
  rows: PLRow[]
  subtotal: number
  isFetching: boolean
  subtotalLabel: string
}) {
  return (
    <div className="rounded-2xl border border-border/30 bg-card/50 overflow-hidden">
      <div className="border-b border-border/30 bg-muted/20 px-6 py-4">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40 bg-muted/10 hover:bg-muted/10">
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground w-32">
                Code
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Account Name
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground text-right">
                Balance
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFetching ? (
              <SectionSkeleton />
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={3} className="h-20 text-center text-sm text-muted-foreground">
                  No accounts.
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
                    <TableCell className="font-mono text-right text-sm">{fmt(row.balance)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t border-border/60 bg-muted/20 hover:bg-muted/20">
                  <TableCell colSpan={2} className="text-sm font-semibold">
                    {subtotalLabel}
                  </TableCell>
                  <TableCell className="font-mono text-right text-sm font-bold">{fmt(subtotal)}</TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export default function ProfitLoss() {
  const today = new Date().toISOString().split('T')[0]
  const firstOfYear = `${new Date().getFullYear()}-01-01`

  const [dateFrom, setDateFrom] = useState(firstOfYear)
  const [dateTo, setDateTo] = useState(today)

  const { data, isFetching, refetch } = useQuery<PLData>({
    queryKey: ['profit-loss', dateFrom, dateTo],
    queryFn: () =>
      erpClient.raw
        .get('/accounting/reports/profit-and-loss', { params: { date_from: dateFrom, date_to: dateTo } })
        .then((r) => r.data),
    enabled: false,
  })

  const netProfit = data?.net_profit ?? 0
  const isPositive = netProfit >= 0

  return (
    <div className="space-y-6">
      <PageHeader title="Profit & Loss" subtitle="accounting" />

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

      {data === undefined && !isFetching ? (
        <div className="rounded-2xl border border-border/30 bg-card/50 p-12 text-center text-sm text-muted-foreground">
          Select a date range and click Generate.
        </div>
      ) : (
        <>
          <AccountSection
            title="Income"
            rows={data?.income ?? []}
            subtotal={data?.total_income ?? 0}
            isFetching={isFetching}
            subtotalLabel="Total Income"
          />

          <AccountSection
            title="Expenses"
            rows={data?.expense ?? []}
            subtotal={data?.total_expense ?? 0}
            isFetching={isFetching}
            subtotalLabel="Total Expenses"
          />

          {/* Net Profit summary */}
          <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  Net Profit
                </p>
                {isFetching ? (
                  <Skeleton className="h-10 w-48" />
                ) : (
                  <p className={`text-4xl font-bold font-mono tracking-tight ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {!isPositive && '-'}{fmt(netProfit)}
                  </p>
                )}
              </div>
              {!isFetching && (
                <div className={`rounded-2xl border p-4 ${isPositive ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
                  {isPositive
                    ? <TrendingUp className="h-8 w-8 text-emerald-400" />
                    : <TrendingDown className="h-8 w-8 text-red-400" />
                  }
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
