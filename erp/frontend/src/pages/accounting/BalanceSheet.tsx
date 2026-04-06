import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Input, Button, Skeleton,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@mashora/design-system'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { CheckCircle2, AlertCircle } from 'lucide-react'

interface BSRow {
  account_id: number
  account_code: string
  account_name: string
  balance: number
}

interface BSData {
  assets: BSRow[]
  liabilities: BSRow[]
  equity: BSRow[]
  total_assets: number
  total_liabilities: number
  total_equity: number
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

function SectionCard({
  title,
  rows,
  subtotal,
  isFetching,
}: {
  title: string
  rows: BSRow[]
  subtotal: number
  isFetching: boolean
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
                    Total {title}
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

export default function BalanceSheet() {
  const today = new Date().toISOString().split('T')[0]
  const [asOf, setAsOf] = useState(today)

  const { data, isFetching, refetch } = useQuery<BSData>({
    queryKey: ['balance-sheet', asOf],
    queryFn: () =>
      erpClient.raw
        .get('/accounting/reports/balance-sheet', { params: { date: asOf } })
        .then((r) => r.data),
    enabled: false,
  })

  const totalAssets = data?.total_assets ?? 0
  const totalLiabilities = data?.total_liabilities ?? 0
  const totalEquity = data?.total_equity ?? 0

  // Assets = Liabilities + Equity (within $0.01 for floating point)
  const liabPlusEquity = totalLiabilities + totalEquity
  const isBalanced = data !== undefined && Math.abs(totalAssets - liabPlusEquity) < 0.01

  return (
    <div className="space-y-6">
      <PageHeader title="Balance Sheet" subtitle="accounting" />

      {/* As-of date filter */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              As of Date
            </label>
            <Input
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
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
          Select a date and click Generate.
        </div>
      ) : (
        <>
          <SectionCard
            title="Assets"
            rows={data?.assets ?? []}
            subtotal={totalAssets}
            isFetching={isFetching}
          />

          <SectionCard
            title="Liabilities"
            rows={data?.liabilities ?? []}
            subtotal={totalLiabilities}
            isFetching={isFetching}
          />

          <SectionCard
            title="Equity"
            rows={data?.equity ?? []}
            subtotal={totalEquity}
            isFetching={isFetching}
          />

          {/* Verification line */}
          {!isFetching && data !== undefined && (
            <div
              className={`rounded-2xl border p-5 flex items-center gap-3 ${
                isBalanced
                  ? 'border-emerald-500/30 bg-emerald-500/10'
                  : 'border-red-500/30 bg-red-500/10'
              }`}
            >
              {isBalanced ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${isBalanced ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isBalanced ? 'Balance sheet is balanced' : 'Balance sheet is out of balance'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                  Assets {fmt(totalAssets)} = Liabilities {fmt(totalLiabilities)} + Equity {fmt(totalEquity)}
                  {' '}= {fmt(liabPlusEquity)}
                  {!isBalanced && ` (difference: ${fmt(Math.abs(totalAssets - liabPlusEquity))})`}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
