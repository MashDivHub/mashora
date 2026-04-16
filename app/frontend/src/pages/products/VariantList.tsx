import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, Input, Badge } from '@mashora/design-system'
import { Layers, Search } from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

const FIELDS = ['id', 'product_tmpl_id', 'default_code', 'barcode', 'active', 'combination_indices']

export default function VariantList() {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['product-variants', search],
    queryFn: async () => {
      const domain: any[] = []
      if (search) domain.push('|', ['default_code', 'ilike', search], ['barcode', 'ilike', search])
      const { data } = await erpClient.raw.post('/model/product.product', { domain, fields: FIELDS, limit: 100, order: 'id desc' })
      return data as { records: any[]; total: number }
    },
  })

  const records = data?.records ?? []

  return (
    <div className="space-y-5">
      <PageHeader title="Product Variants" subtitle="products" backTo="/admin/products" />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by reference or barcode..." className="pl-9" />
      </div>

      <p className="text-sm text-muted-foreground">{data?.total ?? 0} variants total</p>

      <Card className="rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Layers className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No variants found</p>
            <p className="text-xs">Variants are created automatically from product templates.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/20">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Template</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Internal Ref</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Barcode</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((v: any) => {
                const tmplName = Array.isArray(v.product_tmpl_id) ? v.product_tmpl_id[1] : `#${v.product_tmpl_id}`
                return (
                  <tr key={v.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-muted-foreground">{v.id}</td>
                    <td className="px-4 py-3 font-medium">{tmplName}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{v.default_code || '—'}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{v.barcode || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={v.active ? 'success' : 'secondary'} className="text-xs">{v.active ? 'Active' : 'Archived'}</Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
