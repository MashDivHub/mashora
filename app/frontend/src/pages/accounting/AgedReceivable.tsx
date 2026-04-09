import { useQuery } from '@tanstack/react-query'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Skeleton,
} from '@mashora/design-system'
import { Users } from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface AgedRow {
  partner_id: number
  partner_name: string
  current: number
  days_30: number
  days_60: number
  days_90: number
  days_90_plus: number
  total: number
}

function fmt(v: number) {
  return `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i} className="border-border/40 hover:bg-transparent">
          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
        </TableRow>
      ))}
    </>
  )
}

export default function AgedReceivable() {
  const { data, isLoading } = useQuery<AgedRow[]>({
    queryKey: ['aged-receivable'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.get('/accounting/reports/aged-receivable')
        // API may return array directly or { records: [...] } or { data: [...] }
        if (Array.isArray(data)) return data
        if (Array.isArray(data?.records)) return data.records
        if (Array.isArray(data?.data)) return data.data
        return []
      } catch {
        return []
      }
    },
  })

  const records = data ?? []

  const totals = records.reduce(
    (acc, row) => ({
      current: acc.current + row.current,
      days_30: acc.days_30 + row.days_30,
      days_60: acc.days_60 + row.days_60,
      days_90: acc.days_90 + row.days_90,
      days_90_plus: acc.days_90_plus + row.days_90_plus,
      total: acc.total + row.total,
    }),
    { current: 0, days_30: 0, days_60: 0, days_90: 0, days_90_plus: 0, total: 0 },
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Aged Receivable" subtitle="accounting" />

      <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-border/70 bg-muted/20 px-6 py-4">
          <div className="rounded-xl border border-border/70 bg-muted/60 p-2">
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="text-sm font-semibold">Partners</span>
          {!isLoading && (
            <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {records.length}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 bg-muted/10 hover:bg-muted/10">
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Partner</TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Current</TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">1–30 Days</TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">31–60 Days</TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">61–90 Days</TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">90+ Days</TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeleton />
              ) : records.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="h-40 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
                        <Users className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">No aged receivable data.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                records.map((row) => (
                  <TableRow key={row.partner_id} className="border-border/40 hover:bg-muted/50 transition-colors">
                    <TableCell className="font-medium text-sm">{row.partner_name}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(row.current)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(row.days_30)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(row.days_60)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(row.days_90)}</TableCell>
                    <TableCell className={`text-right font-mono text-sm${row.days_90_plus > 0 ? ' text-red-400' : ''}`}>
                      {fmt(row.days_90_plus)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-bold">{fmt(row.total)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {!isLoading && records.length > 0 && (
              <tfoot>
                <TableRow className="border-t-2 border-border/60 bg-muted/20 font-semibold hover:bg-muted/20">
                  <TableCell className="text-sm font-semibold">Total</TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmt(totals.current)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmt(totals.days_30)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmt(totals.days_60)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmt(totals.days_90)}</TableCell>
                  <TableCell className={`text-right font-mono text-sm${totals.days_90_plus > 0 ? ' text-red-400' : ''}`}>
                    {fmt(totals.days_90_plus)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-bold">{fmt(totals.total)}</TableCell>
                </TableRow>
              </tfoot>
            )}
          </Table>
        </div>
      </div>
    </div>
  )
}
