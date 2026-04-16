import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { erpClient } from '@/lib/erp-api'
import { Button, Card, CardContent } from '@mashora/design-system'
import { ArrowRight } from 'lucide-react'
import { sanitizedHtml } from '@/lib/sanitize'

export default function Home() {
  const { data: homepage } = useQuery({
    queryKey: ['website', 'homepage'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.get('/website/homepage')
        return data
      } catch { return null }
    },
    retry: false,
  })

  const { data: products } = useQuery({
    queryKey: ['website', 'featured'],
    queryFn: async () => {
      try {
        const { data } = await erpClient.raw.post('/website/products', { limit: 8, order: 'id desc' })
        return data.records || []
      } catch { return [] }
    },
    enabled: !homepage,
  })

  if (homepage?.content) {
    return <article className="prose dark:prose-invert max-w-none mx-auto px-4 sm:px-6 py-12" dangerouslySetInnerHTML={sanitizedHtml(homepage.content)} />
  }

  return (
    <div>
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-24 text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl md:text-6xl">Your entire business, one platform.</h1>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-muted-foreground">Operations, finance, sales, inventory, and more — unified under a single, focused interface.</p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild><Link to="/shop">Browse products <ArrowRight className="ml-1 size-4" /></Link></Button>
            <Button variant="outline" asChild><Link to="/contactus">Contact us</Link></Button>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
        <h2 className="text-2xl font-semibold tracking-tight mb-8">Featured Products</h2>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {(products || []).map((p: any) => (
            <Link key={p.id} to={`/shop/${p.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-5">
                  <div className="aspect-square rounded-xl bg-muted mb-3 overflow-hidden">
                    {p.image_1920 && <img src={`data:image/png;base64,${p.image_1920}`} className="h-full w-full object-cover" alt={p.name} />}
                  </div>
                  <div className="font-medium line-clamp-1">{p.name}</div>
                  <div className="text-sm text-muted-foreground mt-1">${typeof p.list_price === 'number' ? p.list_price.toFixed(2) : '0.00'}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {(!products || products.length === 0) && <div className="text-muted-foreground col-span-full text-center py-8">No products available yet.</div>}
        </div>
      </section>
    </div>
  )
}
