import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader, toast } from '@/components/shared'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@mashora/design-system'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

const fmt = (n: number) =>
  '$' + (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtAbs = (n: number) =>
  '$' + Math.abs(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function SignedAmount({ amount, className = '' }: { amount: number; className?: string }) {
  const positive = amount >= 0
  const Icon = positive ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={`inline-flex items-center gap-1 ${positive ? 'text-emerald-400' : 'text-red-400'} ${className}`}
      aria-label={positive ? `credit ${fmtAbs(amount)}` : `debit ${fmtAbs(amount)}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {positive ? '+' : '−'}{fmtAbs(amount)}
    </span>
  )
}

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

interface AmlProposal {
  id: number
  name: string
  date: string
  account_id: [number, string] | false
  partner_id: [number, string] | false
  debit: number
  credit: number
  amount_residual: number
  move_id: [number, string] | false
}

const PROPOSAL_FIELDS = [
  'id', 'name', 'date', 'account_id', 'partner_id',
  'debit', 'credit', 'amount_residual', 'move_id',
]

export default function BankReconciliation() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

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

  const [activeLine, setActiveLine] = useState<BankLine | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const closeDialog = () => {
    setActiveLine(null)
    setSelectedIds([])
  }

  const partnerId = activeLine && Array.isArray(activeLine.partner_id) ? activeLine.partner_id[0] : null

  // Suggested counterpart proposals: open AMLs on receivable/payable for the same partner
  const { data: proposals, isLoading: propLoading } = useQuery<AmlProposal[]>({
    queryKey: ['aml-proposals', partnerId],
    enabled: !!activeLine && !!partnerId,
    queryFn: async () => {
      const domain: (string | [string, string, unknown])[] = [
        ['reconciled', '=', false],
        ['account_id.account_type', 'in', ['asset_receivable', 'liability_payable']],
      ]
      if (partnerId) domain.push(['partner_id', '=', partnerId])
      const { data } = await erpClient.raw.post('/model/account.move.line', {
        domain,
        fields: PROPOSAL_FIELDS,
        order: 'date desc, id desc',
        limit: 50,
      })
      return data.records || []
    },
  })

  const toggleSelected = (amlId: number) => {
    setSelectedIds(prev => prev.includes(amlId) ? prev.filter(x => x !== amlId) : [...prev, amlId])
  }

  const reconcileMut = useMutation({
    mutationFn: async () => {
      if (!activeLine) throw new Error('No line selected')
      const { data } = await erpClient.raw.post(
        `/accounting/bank-statements/lines/${activeLine.id}/reconcile`,
        { counterpart_ids: selectedIds },
      )
      return data
    },
    onSuccess: () => {
      toast('success', 'Reconciled', 'Statement line successfully reconciled.')
      queryClient.invalidateQueries({ queryKey: ['bank-unreconciled'] })
      queryClient.invalidateQueries({ queryKey: ['bank-statement', id] })
      closeDialog()
    },
    onError: (err: unknown) => {
      toast('error', 'Reconcile failed', extractErrorMessage(err, 'Could not reconcile this line.'))
    },
  })

  const selectedTotal = useMemo(() => {
    if (!proposals) return 0
    return proposals
      .filter(p => selectedIds.includes(p.id))
      .reduce((s, p) => s + (p.amount_residual || (p.debit - p.credit)), 0)
  }, [proposals, selectedIds])

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
                <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                  No unreconciled lines.
                </TableCell>
              </TableRow>
            ) : lines.map(line => (
              <TableRow key={line.id} className="border-border/30 hover:bg-muted/10">
                <TableCell className="py-2 text-sm text-muted-foreground">{line.date}</TableCell>
                <TableCell className="py-2 text-sm font-medium">{line.payment_ref || '—'}</TableCell>
                <TableCell className="py-2 text-sm text-muted-foreground">
                  {Array.isArray(line.partner_id) ? line.partner_id[1] : '—'}
                </TableCell>
                <TableCell className="py-2 text-right font-mono text-sm font-medium">
                  <SignedAmount amount={line.amount} />
                </TableCell>
                <TableCell className="py-2 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 rounded-lg text-xs"
                    onClick={() => { setActiveLine(line); setSelectedIds([]) }}
                  >
                    Match &amp; Reconcile
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!activeLine} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reconcile Statement Line</DialogTitle>
          </DialogHeader>

          {activeLine && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Statement Line</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Date</p>
                    <p>{activeLine.date}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Partner</p>
                    <p>{Array.isArray(activeLine.partner_id) ? activeLine.partner_id[1] : '—'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Label</p>
                    <p>{activeLine.payment_ref || '—'}</p>
                  </div>
                  <div className="col-span-2 flex items-center justify-between border-t border-border/30 pt-2">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Amount</span>
                    <SignedAmount amount={activeLine.amount} className="font-mono font-semibold" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 flex-row items-center justify-between">
                  <CardTitle className="text-sm">Suggested Counterparts</CardTitle>
                  <Badge variant="secondary" className="text-[10px]">
                    {selectedIds.length} selected
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-2">
                  {!partnerId ? (
                    <p className="text-xs text-muted-foreground">Set a partner on this line to see proposals.</p>
                  ) : propLoading ? (
                    <Skeleton className="h-24 w-full rounded-lg" />
                  ) : !proposals || proposals.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No open journal items for this partner.</p>
                  ) : (
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {proposals.map(p => {
                        const checked = selectedIds.includes(p.id)
                        const amount = p.amount_residual || (p.debit - p.credit)
                        return (
                          <label
                            key={p.id}
                            className="flex items-center gap-3 rounded-lg border border-border/30 p-2 hover:bg-muted/20 cursor-pointer"
                          >
                            <Checkbox checked={checked} onCheckedChange={() => toggleSelected(p.id)} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {Array.isArray(p.move_id) ? p.move_id[1] : p.name}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {p.date} · {Array.isArray(p.account_id) ? p.account_id[1] : ''}
                              </p>
                            </div>
                            <SignedAmount amount={amount} className="font-mono text-sm" />
                          </label>
                        )
                      })}
                    </div>
                  )}
                  {selectedIds.length > 0 && (
                    <div className="flex items-center justify-between border-t border-border/30 pt-2 text-sm">
                      <span className="text-muted-foreground">Selected total</span>
                      <span className="font-mono font-semibold">{fmt(selectedTotal)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Manual Write-off (optional)</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Account ID</p>
                    <Input type="number" placeholder="account.account id" disabled className="h-9 rounded-lg" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Amount</p>
                    <Input type="number" placeholder="0.00" disabled className="h-9 rounded-lg" />
                  </div>
                  <p className="col-span-2 text-[11px] text-muted-foreground">
                    Write-off support is not available in the current backend endpoint.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>Cancel</Button>
            <Button
              onClick={() => reconcileMut.mutate()}
              disabled={reconcileMut.isPending || selectedIds.length === 0}
            >
              {reconcileMut.isPending ? 'Reconciling…' : 'Confirm Reconcile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
