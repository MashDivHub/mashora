import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@mashora/design-system'
import {
  FileText, Receipt, CreditCard, DollarSign, AlertTriangle,
  BookOpen, BookMarked, Landmark, FileBarChart, Settings,
  TrendingUp, BarChart3, Scale, Clock, ArrowDownCircle, ArrowUpCircle,
} from 'lucide-react'
import { PageHeader, StatCards, type StatCardData } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

export default function AccountingDashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['accounting-dashboard'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]
      const [draftInv, overdue, bills] = await Promise.all([
        erpClient.raw.post('/model/account.move', {
          domain: [['move_type', '=', 'out_invoice'], ['state', '=', 'draft']],
          fields: ['id'], limit: 1,
        }).then(r => r.data).catch(() => ({ total: 0 })),
        erpClient.raw.post('/model/account.move', {
          domain: [['move_type', '=', 'out_invoice'], ['state', '=', 'posted'], ['payment_state', '!=', 'paid'], ['invoice_date_due', '<', today]],
          fields: ['id', 'amount_residual'], limit: 1,
        }).then(r => r.data).catch(() => ({ total: 0 })),
        erpClient.raw.post('/model/account.move', {
          domain: [['move_type', '=', 'in_invoice'], ['state', '=', 'draft']],
          fields: ['id'], limit: 1,
        }).then(r => r.data).catch(() => ({ total: 0 })),
      ])

      let totalReceivable = 0
      let totalPayable = 0
      try {
        const { data: rg } = await erpClient.raw.post('/model/account.move/read_group', {
          domain: [['move_type', '=', 'out_invoice'], ['state', '=', 'posted'], ['payment_state', '!=', 'paid']],
          fields: ['amount_residual'], groupby: [],
        })
        totalReceivable = rg.groups?.[0]?.amount_residual || 0
      } catch {}
      try {
        const { data: rg } = await erpClient.raw.post('/model/account.move/read_group', {
          domain: [['move_type', '=', 'in_invoice'], ['state', '=', 'posted'], ['payment_state', '!=', 'paid']],
          fields: ['amount_residual'], groupby: [],
        })
        totalPayable = rg.groups?.[0]?.amount_residual || 0
      } catch {}

      return {
        draftInvoices: draftInv.total || 0,
        overdueCount: overdue.total || 0,
        totalReceivable,
        totalPayable,
        draftBills: bills.total || 0,
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  const fmtCur = (v: number) =>
    v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v.toFixed(0)}`

  const stats: StatCardData[] = [
    {
      label: 'Draft Invoices', value: data?.draftInvoices || 0,
      icon: <FileText className="h-5 w-5" />, color: 'info',
      onClick: () => navigate('/invoicing/invoices?filter=draft'),
    },
    {
      label: 'Overdue', value: data?.overdueCount || 0, sub: 'past due date',
      icon: <AlertTriangle className="h-5 w-5" />,
      color: (data?.overdueCount || 0) > 0 ? 'danger' : 'default',
      onClick: () => navigate('/invoicing/invoices?filter=overdue'),
    },
    {
      label: 'Receivable', value: fmtCur(data?.totalReceivable || 0), sub: 'outstanding',
      icon: <DollarSign className="h-5 w-5" />, color: 'success',
    },
    {
      label: 'Payable', value: fmtCur(data?.totalPayable || 0), sub: 'outstanding',
      icon: <DollarSign className="h-5 w-5" />, color: 'warning',
    },
  ]

  const actions = [
    { label: 'Invoices', desc: 'Customer invoices', icon: <FileText className="h-5 w-5" />, path: '/invoicing/invoices' },
    { label: 'Vendor Bills', desc: 'Bills from vendors', icon: <Receipt className="h-5 w-5" />, path: '/invoicing/invoices?filter=bills' },
    { label: 'Payments', desc: 'Register & view payments', icon: <CreditCard className="h-5 w-5" />, path: '/invoicing/payments' },
    { label: 'Chart of Accounts', desc: 'Account structure', icon: <BookOpen className="h-5 w-5" />, path: '/accounting/accounts' },
    { label: 'Journals', desc: 'Accounting journals', icon: <BookMarked className="h-5 w-5" />, path: '/accounting/journals' },
    { label: 'Journal Entries', desc: 'All journal entries', icon: <FileBarChart className="h-5 w-5" />, path: '/accounting/entries' },
    { label: 'Bank Statements', desc: 'Reconcile bank feeds', icon: <Landmark className="h-5 w-5" />, path: '/accounting/bank' },
    { label: 'Tax Configuration', desc: 'Tax rates & rules', icon: <Settings className="h-5 w-5" />, path: '/accounting/taxes' },
  ]

  const reports = [
    { label: 'Trial Balance', desc: 'Account balances summary', icon: <Scale className="h-5 w-5" />, path: '/accounting/reports/trial-balance' },
    { label: 'Profit & Loss', desc: 'Income statement', icon: <TrendingUp className="h-5 w-5" />, path: '/accounting/reports/profit-loss' },
    { label: 'Balance Sheet', desc: 'Assets, liabilities & equity', icon: <BarChart3 className="h-5 w-5" />, path: '/accounting/reports/balance-sheet' },
    { label: 'Aged Receivable', desc: 'Outstanding customer balances', icon: <ArrowDownCircle className="h-5 w-5" />, path: '/accounting/reports/aged-receivable' },
    { label: 'Aged Payable', desc: 'Outstanding vendor balances', icon: <ArrowUpCircle className="h-5 w-5" />, path: '/accounting/reports/aged-payable' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Accounting" subtitle="overview" />
      <StatCards stats={stats} columns={4} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {actions.map(item => (
          <button key={item.path} onClick={() => navigate(item.path)}
            className="rounded-2xl border border-border/50 bg-card p-5 text-left transition-all hover:bg-muted/20 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">{item.icon}</div>
              <div>
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Financial Reports</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {reports.map(item => (
            <button key={item.path} onClick={() => navigate(item.path)}
              className="rounded-2xl border border-border/50 bg-card p-5 text-left transition-all hover:bg-muted/20 hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center gap-3">
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
    </div>
  )
}
