import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import { FileText, CreditCard, DollarSign, Clock, AlertTriangle, Receipt } from 'lucide-react'
import { PageHeader, StatCards, type StatCardData } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

export default function AccountingDashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['accounting-dashboard'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]
      const [draftInv, overdue, bills, payments] = await Promise.all([
        erpClient.raw.post('/model/account.move', { domain: [['move_type', '=', 'out_invoice'], ['state', '=', 'draft']], fields: ['id'], limit: 1 }).then(r => r.data),
        erpClient.raw.post('/model/account.move', { domain: [['move_type', '=', 'out_invoice'], ['state', '=', 'posted'], ['payment_state', '!=', 'paid'], ['invoice_date_due', '<', today]], fields: ['id', 'amount_residual'], limit: 1 }).then(r => r.data),
        erpClient.raw.post('/model/account.move', { domain: [['move_type', '=', 'in_invoice'], ['state', '=', 'draft']], fields: ['id'], limit: 1 }).then(r => r.data),
        erpClient.raw.post('/model/account.payment', { domain: [['state', '=', 'draft']], fields: ['id'], limit: 1 }).then(r => r.data),
      ])

      let totalReceivable = 0
      try {
        const { data: rg } = await erpClient.raw.post('/model/account.move/read_group', {
          domain: [['move_type', '=', 'out_invoice'], ['state', '=', 'posted'], ['payment_state', '!=', 'paid']],
          fields: ['amount_residual'], groupby: [],
        })
        totalReceivable = rg.groups?.[0]?.amount_residual || 0
      } catch {}

      return {
        draftInvoices: draftInv.total || 0,
        overdueCount: overdue.total || 0,
        draftBills: bills.total || 0,
        draftPayments: payments.total || 0,
        totalReceivable,
      }
    },
    staleTime: 60_000,
  })

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-48 rounded-xl" /><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div></div>
  }

  const fmtCur = (v: number) => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v/1e3).toFixed(0)}K` : `$${v.toFixed(0)}`

  const stats: StatCardData[] = [
    { label: 'Draft Invoices', value: data?.draftInvoices || 0, icon: <FileText className="h-5 w-5" />, color: 'info', onClick: () => navigate('/invoicing/invoices?filter=draft') },
    { label: 'Overdue', value: data?.overdueCount || 0, sub: 'past due date', icon: <AlertTriangle className="h-5 w-5" />, color: 'danger', onClick: () => navigate('/invoicing/invoices?filter=overdue') },
    { label: 'Receivable', value: fmtCur(data?.totalReceivable || 0), sub: 'outstanding', icon: <DollarSign className="h-5 w-5" />, color: 'warning' },
    { label: 'Vendor Bills', value: data?.draftBills || 0, sub: 'to process', icon: <Receipt className="h-5 w-5" />, color: 'default', onClick: () => navigate('/invoicing/invoices?filter=bills') },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Invoicing" subtitle="overview" />
      <StatCards stats={stats} columns={4} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { label: 'Invoices', desc: 'Customer invoices', icon: <FileText className="h-5 w-5" />, path: '/invoicing/invoices?filter=invoices' },
          { label: 'Vendor Bills', desc: 'Bills from vendors', icon: <Receipt className="h-5 w-5" />, path: '/invoicing/invoices?filter=bills' },
          { label: 'Payments', desc: 'Register & view payments', icon: <CreditCard className="h-5 w-5" />, path: '/invoicing/payments' },
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
