import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared'
import { Button, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@mashora/design-system'
import { Plus, Percent } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

interface TaxRecord {
  id: number
  name: string
  amount: number
  type_tax_use: 'sale' | 'purchase' | 'none'
  amount_type: 'percent' | 'fixed' | 'group'
  active: boolean
}

interface TaxResponse {
  records: TaxRecord[]
  total: number
}

const typeLabel: Record<string, string> = { sale: 'Sale', purchase: 'Purchase', none: 'None' }
const typeColor: Record<string, string> = {
  sale: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  purchase: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  none: 'bg-muted/50 text-muted-foreground border-border/40',
}

export default function TaxConfig() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery<TaxResponse>({
    queryKey: ['accounting-taxes'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/accounting/taxes', {
        domain: [],
        offset: 0,
        limit: 100,
      })
      return data
    },
  })

  const records = data?.records ?? []

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  const handleCreate = () => navigate('/admin/model/account.tax/new')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tax Configuration"
        actions={
          <Button size="sm" className="rounded-xl gap-1.5" onClick={handleCreate}>
            <Plus className="h-3.5 w-3.5" /> New Tax
          </Button>
        }
      />

      {records.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-12 text-center space-y-4">
          <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-primary">
            <Percent className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">No taxes configured yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Set up your first tax rate to apply on invoices and orders.
            </p>
          </div>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Create First Tax
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/30 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/40">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Tax Name</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Type</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Amount</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Amount Type</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map(tax => (
                <TableRow
                  key={tax.id}
                  onClick={() => navigate(`/admin/model/account.tax/${tax.id}`)}
                  className="border-border/30 hover:bg-muted/10 cursor-pointer"
                >
                <TableCell className="py-2 text-sm font-medium">{tax.name}</TableCell>
                <TableCell className="py-2">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${typeColor[tax.type_tax_use] ?? typeColor.none}`}>
                    {typeLabel[tax.type_tax_use] ?? tax.type_tax_use}
                  </span>
                </TableCell>
                <TableCell className="py-2 text-right font-mono text-sm">
                  {tax.amount_type === 'percent'
                    ? `${tax.amount.toFixed(2)}%`
                    : tax.amount_type === 'fixed'
                    ? `$${tax.amount.toFixed(2)}`
                    : '—'}
                </TableCell>
                <TableCell className="py-2 text-sm capitalize text-muted-foreground">{tax.amount_type}</TableCell>
                <TableCell className="py-2">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                    tax.active
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-muted/50 text-muted-foreground border-border/40'
                  }`}>
                    {tax.active ? 'Active' : 'Inactive'}
                  </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
