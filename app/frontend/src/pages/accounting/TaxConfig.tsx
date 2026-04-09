import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared'
import { Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@mashora/design-system'
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

  return (
    <div className="space-y-6">
      <PageHeader title="Tax Configuration" />

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
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">No tax records found.</TableCell>
              </TableRow>
            ) : records.map(tax => (
              <TableRow key={tax.id} className="border-border/30 hover:bg-muted/10">
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
    </div>
  )
}
