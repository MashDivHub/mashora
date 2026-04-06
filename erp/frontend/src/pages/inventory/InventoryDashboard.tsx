import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import { Truck, Package, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Clock } from 'lucide-react'
import { PageHeader, StatCards, type StatCardData } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

export default function InventoryDashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-dashboard'],
    queryFn: async () => {
      const q = (domain: any[]) => erpClient.raw.post('/model/stock.picking', { domain, fields: ['id'], limit: 1 }).then(r => r.data).catch(() => ({ total: 0 }))
      const now = new Date().toISOString().replace('Z', '').split('.')[0]
      const [receipts, deliveries, internal, late] = await Promise.all([
        q([['picking_type_code', '=', 'incoming'], ['state', 'not in', ['done', 'cancel']]]),
        q([['picking_type_code', '=', 'outgoing'], ['state', 'not in', ['done', 'cancel']]]),
        q([['picking_type_code', '=', 'internal'], ['state', 'not in', ['done', 'cancel']]]),
        q([['scheduled_date', '<', now], ['state', 'not in', ['done', 'cancel']]]),
      ])
      return {
        receipts: receipts.total || 0,
        deliveries: deliveries.total || 0,
        internal: internal.total || 0,
        late: late.total || 0,
      }
    },
    staleTime: 60_000,
  })

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-48 rounded-xl" /><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div></div>
  }

  const stats: StatCardData[] = [
    { label: 'Receipts', value: data?.receipts || 0, sub: 'to process', icon: <ArrowDownToLine className="h-5 w-5" />, color: 'info', onClick: () => navigate('/inventory/transfers?filter=receipts') },
    { label: 'Deliveries', value: data?.deliveries || 0, sub: 'to process', icon: <ArrowUpFromLine className="h-5 w-5" />, color: 'success', onClick: () => navigate('/inventory/transfers?filter=deliveries') },
    { label: 'Internal', value: data?.internal || 0, sub: 'transfers', icon: <ArrowLeftRight className="h-5 w-5" />, color: 'default', onClick: () => navigate('/inventory/transfers?filter=internal') },
    { label: 'Late', value: data?.late || 0, sub: 'past scheduled date', icon: <Clock className="h-5 w-5" />, color: 'danger', onClick: () => navigate('/inventory/transfers?filter=late') },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" subtitle="overview" />
      <StatCards stats={stats} columns={4} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { label: 'All Transfers', desc: 'Receipts, deliveries, internal', icon: <Truck className="h-5 w-5" />, path: '/inventory/transfers' },
          { label: 'Stock on Hand', desc: 'Current inventory levels', icon: <Package className="h-5 w-5" />, path: '/inventory/stock' },
          { label: 'Products', desc: 'Product catalog', icon: <Package className="h-5 w-5" />, path: '/model/product.product' },
        ].map(item => (
          <button key={item.path} onClick={() => navigate(item.path)}
            className="rounded-2xl border border-border/50 bg-card p-5 text-left transition-all hover:bg-muted/20 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">{item.icon}</div>
              <div><p className="text-sm font-semibold">{item.label}</p><p className="text-xs text-muted-foreground">{item.desc}</p></div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
