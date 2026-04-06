import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import { Package, FileText, DollarSign, Clock, Send, Truck } from 'lucide-react'
import { PageHeader, StatCards, type StatCardData } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

export default function PurchaseDashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-dashboard'],
    queryFn: async () => {
      const [rfqs, orders, toBill] = await Promise.all([
        erpClient.raw.post('/model/purchase.order', { domain: [['state', 'in', ['draft', 'sent']]], fields: ['id'], limit: 1 }).then(r => r.data),
        erpClient.raw.post('/model/purchase.order', { domain: [['state', '=', 'purchase']], fields: ['id'], limit: 1 }).then(r => r.data),
        erpClient.raw.post('/model/purchase.order', { domain: [['invoice_status', '=', 'to invoice']], fields: ['id'], limit: 1 }).then(r => r.data),
      ])
      let totalSpend = 0
      try {
        const { data: rg } = await erpClient.raw.post('/model/purchase.order/read_group', {
          domain: [['state', '=', 'purchase']], fields: ['amount_total'], groupby: [],
        })
        totalSpend = rg.groups?.[0]?.amount_total || 0
      } catch {}
      return { rfqCount: rfqs.total || 0, orderCount: orders.total || 0, toBillCount: toBill.total || 0, totalSpend }
    },
    staleTime: 60_000,
  })

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-48 rounded-xl" /><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div></div>
  }

  const fmtCur = (v: number) => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v/1e3).toFixed(0)}K` : `$${v.toFixed(0)}`

  const stats: StatCardData[] = [
    { label: 'RFQs', value: data?.rfqCount || 0, sub: 'draft & sent', icon: <FileText className="h-5 w-5" />, color: 'info', onClick: () => navigate('/purchase/orders?filter=rfq') },
    { label: 'Purchase Orders', value: data?.orderCount || 0, sub: 'confirmed', icon: <Package className="h-5 w-5" />, color: 'success', onClick: () => navigate('/purchase/orders?filter=orders') },
    { label: 'To Bill', value: data?.toBillCount || 0, sub: 'awaiting bills', icon: <Clock className="h-5 w-5" />, color: 'warning', onClick: () => navigate('/purchase/orders?filter=to_bill') },
    { label: 'Total Spend', value: fmtCur(data?.totalSpend || 0), sub: 'from confirmed POs', icon: <DollarSign className="h-5 w-5" />, color: 'default' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Purchase" subtitle="overview" />
      <StatCards stats={stats} columns={4} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { label: 'New RFQ', desc: 'Create a request for quotation', icon: <Send className="h-5 w-5" />, path: '/purchase/orders/new' },
          { label: 'All Orders', desc: 'Browse all purchase orders', icon: <Package className="h-5 w-5" />, path: '/purchase/orders' },
          { label: 'Receipts', desc: 'Incoming shipments', icon: <Truck className="h-5 w-5" />, path: '/inventory/receipts' },
        ].map(item => (
          <button key={item.path} onClick={() => navigate(item.path)}
            className="rounded-2xl border border-border/50 bg-card p-5 text-left transition-all hover:bg-muted/20 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">{item.icon}</div>
              <div><p className="text-sm font-semibold">{item.label}</p><p className="text-xs text-muted-foreground">{item.desc}</p></div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
