import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared'
import { Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'

const fmt = (n: number) => '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface BankStatement {
  id: number
  name: string
  date: string
  journal_id: [number, string]
  balance_start: number
  balance_end_real: number
}

interface BankLine {
  id: number
  date: string
  payment_ref: string
  amount: number
  partner_id: [number, string] | false
}

export default function BankReconciliation() {
  const { id } = useParams<{ id: string }>()

  const { data: statement, isLoading: stmtLoading } = useQuery<BankStatement>({
    queryKey: ['bank-statement', id],
    queryFn: async () => {
      const { data } = await erpClient.raw.get(`/accounting/bank-statements/${id}`)
      return data
    },
    enabled: !!id,
  })

  const { data: lines, isLoading: linesLoading } = useQuery<BankLine[]>({
    queryKey: ['bank-unreconciled'],
    queryFn: async () => {
      const { data } = await erpClient.raw.get('/accounting/bank-statements/unreconciled')
      return data.records ?? data
    },
  })

  const isLoading = stmtLoading || linesLoading

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Bank Reconciliation" backTo="/admin/accounting/bank" />

      {statement && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Statement</p>
            <p className="text-sm font-semibold">{statement.name}</p>
            <p className="text-xs text-muted-foreground">{statement.date}</p>
          </div>
          <div className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Opening Balance</p>
            <p className="text-xl font-bold font-mono">{fmt(statement.balance_start)}</p>
          </div>
          <div className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Closing Balance</p>
            <p className="text-xl font-bold font-mono">{fmt(statement.balance_end_real)}</p>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border/30 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/30">
          <p className="text-sm font-semibold">Unreconciled Lines</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/40">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Date</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Label</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Partner</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Amount</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!lines || lines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">No unreconciled lines.</TableCell>
              </TableRow>
            ) : lines.map(line => (
              <TableRow key={line.id} className="border-border/30 hover:bg-muted/10">
                <TableCell className="py-2 text-sm text-muted-foreground">{line.date}</TableCell>
                <TableCell className="py-2 text-sm font-medium">{line.payment_ref || '—'}</TableCell>
                <TableCell className="py-2 text-sm text-muted-foreground">
                  {Array.isArray(line.partner_id) ? line.partner_id[1] : '—'}
                </TableCell>
                <TableCell className={`py-2 text-right font-mono text-sm font-medium ${line.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmt(line.amount)}
                </TableCell>
                <TableCell className="py-2 text-right">
                  <button
                    disabled
                    className="rounded-lg border border-border/40 bg-muted/20 px-3 py-1 text-xs text-muted-foreground cursor-not-allowed"
                  >
                    Reconcile
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
