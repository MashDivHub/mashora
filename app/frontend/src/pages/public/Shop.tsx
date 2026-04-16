import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { erpClient } from '@/lib/erp-api'
import { Card, CardContent, Input } from '@mashora/design-system'
import { Search } from 'lucide-react'

export default function Shop() {
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)

  const { data: categories } = useQuery({
    queryKey: ['website', 'categories'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.post('/website/categories', { limit: 50 })
        return data.records || []
      } catch { return [] }
    },
  })

  const { data, isLoading } = useQuery({
    queryKey: ['website', 'products', search, categoryId],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.post('/website/products', {
          search: search || undefined,
          category_id: categoryId || undefined,
          limit: 60,
          order: 'name asc',
        })
        return data
      } catch { return { records: [], total: 0 } }
    },
  })

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight mb-6">Shop</h1>
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="pl-9" />
        </div>
        <select value={categoryId || ''} onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : null)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="">All categories</option>
          {(categories || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {isLoading ? <div className="text-muted-foreground">Loading...</div> : (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {(data?.records || []).map((p: any) => (
            <Link key={p.id} to={`/shop/${p.id}`}>
              <Card className="h-full hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="aspect-square rounded-xl bg-muted mb-3 overflow-hidden">
                    {p.image_1920 && <img src={`data:image/png;base64,${p.image_1920}`} className="h-full w-full object-cover" alt={p.name} />}
                  </div>
                  <div className="font-medium line-clamp-2">{p.name}</div>
                  <div className="text-sm text-muted-foreground mt-1">${typeof p.list_price === 'number' ? p.list_price.toFixed(2) : '0.00'}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {(!data?.records?.length) && <div className="text-muted-foreground col-span-full text-center py-8">No products found.</div>}
        </div>
      )}
    </div>
  )
}
