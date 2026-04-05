import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PageHeader, Button, Badge, Separator, Skeleton, StatusBar,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  CardTitle, Input, Label, cn,
} from '@mashora/design-system'
import { ArrowLeft, Send, Ban, CreditCard, FileText, Hash, Calendar, Building2 } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'
import { useState } from 'react'

const invoiceStates = [
  { value: 'draft', label: 'Draft' },
  { value: 'posted', label: 'Posted' },
  { value: 'cancel', label: 'Cancelled' },
]

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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function InfoRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      <span className={cn('text-sm font-medium', mono && 'font-mono')}>
        {value || '—'}
      </span>
    </div>
  )
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const isNew = id === 'new'

  const [formPartner, setFormPartner] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [formMoveType, setFormMoveType] = useState(searchParams.get('type') ?? 'out_invoice')

  const createMut = useMutation({
    mutationFn: (vals: Record<string, any>) =>
      erpClient.raw.post('/accounting/invoices/create', vals).then((r) => r.data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['invoice'] })
      navigate(`/accounting/invoices/${result.id}`, { replace: true })
    },
  })

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => erpClient.raw.get(`/accounting/invoices/${id}`).then((r) => r.data),
    enabled: !isNew,
  })

  const postMutation = useMutation({
    mutationFn: () => erpClient.raw.post(`/accounting/invoices/${id}/post`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoice', id] }),
  })

  const cancelMutation = useMutation({
    mutationFn: () => erpClient.raw.post(`/accounting/invoices/${id}/cancel`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoice', id] }),
  })

  // ── Create mode ──
  if (isNew) {
    const moveTypeOptions = [
      { value: 'out_invoice', label: 'Customer Invoice' },
      { value: 'in_invoice', label: 'Vendor Bill' },
      { value: 'out_refund', label: 'Credit Note' },
      { value: 'in_refund', label: 'Vendor Refund' },
    ]
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Accounting</p>
          <h1 className="text-2xl font-bold tracking-tight">New Invoice</h1>
        </div>
        <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
          <div className="border-b border-border/70 bg-muted/20 px-6 py-4">
            <CardTitle>Invoice Details</CardTitle>
          </div>
          <div className="p-6 space-y-4 max-w-lg">
            <div className="space-y-1.5">
              <Label htmlFor="inv-partner">Partner</Label>
              <Input
                id="inv-partner"
                placeholder="Partner name"
                value={formPartner}
                onChange={(e) => setFormPartner(e.target.value)}
                className="rounded-2xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-date">Invoice Date</Label>
              <Input
                id="inv-date"
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="rounded-2xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-type">Type</Label>
              <select
                id="inv-type"
                value={formMoveType}
                onChange={(e) => setFormMoveType(e.target.value)}
                className="w-full rounded-2xl border border-border/60 bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {moveTypeOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="border-t border-border/60 bg-muted/20 px-6 py-4 flex gap-2">
            <Button
              onClick={() => createMut.mutate({ partner_name: formPartner, invoice_date: formDate, move_type: formMoveType })}
              disabled={createMut.isPending || !formPartner}
              className="rounded-2xl"
            >
              {createMut.isPending ? 'Creating…' : 'Create Invoice'}
            </Button>
            <Button variant="outline" className="rounded-2xl" onClick={() => navigate('/accounting/invoices')}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-64" />
          </div>
          <Skeleton className="h-9 w-40" />
        </div>
        <Skeleton className="h-12 w-full max-w-sm" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-56 w-full rounded-3xl" />
          <Skeleton className="h-56 w-full rounded-3xl" />
        </div>
        <Skeleton className="h-72 w-full rounded-3xl" />
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="rounded-2xl border border-border/70 bg-muted/40 p-5">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">Invoice not found.</p>
        <Button variant="outline" onClick={() => navigate('/accounting/invoices')}>
          <ArrowLeft className="h-4 w-4" />
          Back to Invoices
        </Button>
      </div>
    )
  }

  const isDraft = invoice.state === 'draft'
  const isPosted = invoice.state === 'posted'
  const lines = invoice.invoice_lines || []

  const eyebrowMap: Record<string, string> = {
    out_invoice: 'Customer Invoice',
    in_invoice: 'Vendor Bill',
    out_refund: 'Credit Note',
    in_refund: 'Vendor Refund',
    entry: 'Journal Entry',
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={invoice.name || 'Draft Invoice'}
        eyebrow={eyebrowMap[invoice.move_type] ?? invoice.move_type}
        actions={
          <div className="flex items-center gap-2">
            {isDraft && (
              <Button onClick={() => postMutation.mutate()} disabled={postMutation.isPending}>
                <Send className="h-4 w-4" />
                {postMutation.isPending ? 'Posting...' : 'Post'}
              </Button>
            )}
            {isPosted && invoice.payment_state !== 'paid' && (
              <Button variant="success" onClick={() => navigate(`/accounting/invoices/${id}/pay`)}>
                <CreditCard className="h-4 w-4" />
                Register Payment
              </Button>
            )}
            {isPosted && (
              <Button
                variant="outline"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
              >
                <Ban className="h-4 w-4" />
                Cancel
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate('/accounting/invoices')}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
        }
      />

      {/* Status progression */}
      <div className="flex flex-wrap items-center gap-3">
        <StatusBar states={invoiceStates} currentState={invoice.state} />
        {isPosted && invoice.payment_state && (
          <Badge variant={paymentStateVariants[invoice.payment_state] ?? 'secondary'}>
            {paymentStateLabels[invoice.payment_state] ?? invoice.payment_state.replace('_', ' ')}
          </Badge>
        )}
      </div>

      {/* Info grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Details card */}
        <div className="rounded-3xl border border-border/60 bg-card/90 shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-border/70 bg-muted/20 px-6 py-4">
            <div className="rounded-xl border border-border/70 bg-muted/60 p-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-sm font-semibold">Details</CardTitle>
          </div>
          <div className="px-6 py-4">
            <InfoRow label="Partner" value={invoice.partner_id ? invoice.partner_id[1] : '—'} />
            <InfoRow label="Invoice Date" value={invoice.invoice_date || '—'} mono />
            <InfoRow label="Due Date" value={invoice.invoice_date_due || '—'} mono />
            <InfoRow label="Journal" value={invoice.journal_id ? invoice.journal_id[1] : '—'} />
            {invoice.ref && (
              <InfoRow label="Reference" value={invoice.ref} />
            )}
          </div>
        </div>

        {/* Amounts card */}
        <div className="rounded-3xl border border-border/60 bg-card/90 shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-border/70 bg-muted/20 px-6 py-4">
            <div className="rounded-xl border border-border/70 bg-muted/60 p-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-sm font-semibold">Amounts</CardTitle>
          </div>
          <div className="px-6 py-4">
            <InfoRow
              label="Untaxed Amount"
              value={formatCurrency(invoice.amount_untaxed)}
              mono
            />
            <InfoRow
              label="Tax"
              value={formatCurrency(invoice.amount_tax)}
              mono
            />
            <div className="flex items-center justify-between py-3 border-b border-border/40">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Total
              </span>
              <span className="font-mono text-lg font-semibold">
                {formatCurrency(invoice.amount_total)}
              </span>
            </div>
            {isPosted && (
              <div className="flex items-center justify-between pt-3">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Amount Due
                </span>
                <span className={cn(
                  'font-mono text-base font-semibold',
                  invoice.amount_residual > 0 ? 'text-warning' : 'text-success'
                )}>
                  {formatCurrency(invoice.amount_residual)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Lines */}
      <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-border/70 bg-muted/20 px-6 py-4">
          <div className="rounded-xl border border-border/70 bg-muted/60 p-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
          </div>
          <CardTitle className="text-sm font-semibold">
            Invoice Lines
            {lines.length > 0 && (
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {lines.length}
              </span>
            )}
          </CardTitle>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 bg-muted/10 hover:bg-muted/10">
                <TableHead className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Product</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Description</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Account</TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Qty</TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Price</TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Disc %</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Taxes</TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={8} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="rounded-2xl border border-border/70 bg-muted/40 p-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">No invoice lines.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                lines.map((line: any) => (
                  <TableRow key={line.id} className="border-border/40 hover:bg-muted/50 transition-colors">
                    <TableCell className="text-sm">
                      {line.product_id ? line.product_id[1] : '—'}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {line.name || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {line.account_id ? line.account_id[1] : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {line.quantity}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(line.price_unit)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">
                      {line.discount > 0 ? `${line.discount}%` : '—'}
                    </TableCell>
                    <TableCell>
                      {line.tax_ids?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {line.tax_ids.map((tax: any) => (
                            <Badge
                              key={typeof tax === 'number' ? tax : tax[0]}
                              variant="secondary"
                              className="text-xs"
                            >
                              {typeof tax === 'number' ? `Tax ${tax}` : tax[1]}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium">
                      {formatCurrency(line.price_subtotal)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Totals footer */}
        {lines.length > 0 && (
          <div className="flex justify-end border-t border-border/70 bg-muted/20 px-6 py-4">
            <div className="w-full max-w-xs space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono">{formatCurrency(invoice.amount_untaxed)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-mono">{formatCurrency(invoice.amount_tax)}</span>
              </div>
              <Separator className="opacity-60" />
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span className="font-mono">{formatCurrency(invoice.amount_total)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
