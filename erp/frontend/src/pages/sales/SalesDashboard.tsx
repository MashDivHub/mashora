import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import { ShoppingCart, FileText, DollarSign, Clock, Send, CheckCircle } from 'lucide-react'
import { PageHeader, StatCards, type StatCardData } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

export default function SalesDashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['sales-dashboard'],
    queryFn: async () => {
      const [quotations, orders, toInvoice] = await Promise.all([
        erpClient.raw.post('/model/sale.order', {
          domain: [['state', 'in', ['draft', 'sent']]], fields: ['id', 'amount_total'], limit: 1,
        }).then(r => r.data),
        erpClient.raw.post('/model/sale.order', {
          domain: [['state', '=', 'sale']], fields: ['id', 'amount_total'], limit: 1,
        }).then(r => r.data),
        erpClient.raw.post('/model/sale.order', {
          domain: [['invoice_status', '=', 'to invoice']], fields: ['id'], limit: 1,
        }).then(r => r.data),
      ])

      let totalRevenue = 0
      try {
        const { data: rg } = await erpClient.raw.post('/model/sale.order/read_group', {
          domain: [['state', '=', 'sale']], fields: ['amount_total'], groupby: [],
        })
        totalRevenue = rg.groups?.[0]?.amount_total || 0
      } catch {}

      return {
        quotationCount: quotations.total || 0,
        orderCount: orders.total || 0,
        toInvoiceCount: toInvoice.total || 0,
        totalRevenue,
      }
    },
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  const fmtCur = (v: number) => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v/1e3).toFixed(0)}K` : `$${v.toFixed(0)}`

  const stats: StatCardData[] = [
    {
      label: 'Quotations', value: data?.quotationCount || 0,
      sub: 'draft & sent',
      icon: <FileText className="h-5 w-5" />, color: 'info',
      onClick: () => navigate('/sales/orders?filter=quotations'),
    },
    {
      label: 'Sales Orders', value: data?.orderCount || 0,
      sub: 'confirmed',
      icon: <ShoppingCart className="h-5 w-5" />, color: 'success',
      onClick: () => navigate('/sales/orders?filter=orders'),
    },
    {
      label: 'To Invoice', value: data?.toInvoiceCount || 0,
      sub: 'ready for invoicing',
      icon: <Clock className="h-5 w-5" />, color: 'warning',
      onClick: () => navigate('/sales/orders?filter=to_invoice'),
    },
    {
      label: 'Revenue', value: fmtCur(data?.totalRevenue || 0),
      sub: 'from confirmed orders',
      icon: <DollarSign className="h-5 w-5" />, color: 'default',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Sales" subtitle="overview" />
      <StatCards stats={stats} columns={4} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { label: 'New Quotation', desc: 'Create a new quotation', icon: <Send className="h-5 w-5" />, path: '/sales/orders/new' },
          { label: 'All Orders', desc: 'Browse all sales orders', icon: <ShoppingCart className="h-5 w-5" />, path: '/sales/orders' },
          { label: 'To Invoice', desc: 'Orders ready to invoice', icon: <CheckCircle className="h-5 w-5" />, path: '/sales/orders?filter=to_invoice' },
        ].map(item => (
          <button key={item.path} onClick={() => navigate(item.path)}
            className="rounded-2xl border border-border/50 bg-card p-5 text-left transition-all hover:bg-muted/20 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">{item.icon}</div>
              <div>
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
