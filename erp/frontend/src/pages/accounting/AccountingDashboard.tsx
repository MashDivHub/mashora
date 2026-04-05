import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  PageHeader, Card, CardContent, CardHeader, CardTitle, Button, Separator, Skeleton,
} from '@mashora/design-system'
import {
  FileText, CreditCard, AlertTriangle, DollarSign, TrendingDown, ArrowRight,
  Receipt, Landmark, BarChart3, ArrowUpRight,
} from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

interface StatBlockProps {
  title: string
  value: string | number
  description?: string
  icon: React.ReactNode
  accent?: 'default' | 'warning' | 'destructive' | 'success'
}

function StatBlock({ title, value, description, icon, accent = 'default' }: StatBlockProps) {
  const accentMap = {
    default: 'group-hover:bg-zinc-900 group-hover:text-white',
    warning: 'group-hover:bg-amber-500 group-hover:text-white',
    destructive: 'group-hover:bg-destructive group-hover:text-destructive-foreground',
    success: 'group-hover:bg-emerald-600 group-hover:text-white',
  }

  return (
    <div className="group rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl">
      <div className="flex items-start justify-between">
        <div
          className={[
            'rounded-2xl border border-border/70 bg-muted/60 p-3 transition-all duration-300',
            accentMap[accent],
          ].join(' ')}
        >
          {icon}
        </div>
      </div>
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
          {title}
        </p>
        <p className="mt-1.5 text-3xl font-semibold tracking-tight">{value}</p>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  )
}

function SummaryRowSkeleton() {
  return (
    <div className="flex items-center justify-between py-1.5">
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="h-3.5 w-12" />
    </div>
  )
}

export default function AccountingDashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['accounting-dashboard'],
    queryFn: () => erpClient.raw.get('/accounting/dashboard').then((r) => r.data),
  })

  const invoices = data?.invoices ?? {}
  const bills = data?.bills ?? {}

  return (
    <div className="space-y-8">
      <PageHeader
        title="Accounting"
        description="Financial overview and quick actions"
        actions={
          <Button onClick={() => navigate('/accounting/invoices')}>
            <Receipt className="h-4 w-4" />
            New Invoice
          </Button>
        }
      />

      {/* KPI stat grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatBlock
          title="Draft Invoices"
          value={isLoading ? '—' : invoices.draft ?? 0}
          icon={<FileText className="h-5 w-5" />}
          description="Awaiting validation"
        />
        <StatBlock
          title="Unpaid Invoices"
          value={isLoading ? '—' : invoices.unpaid ?? 0}
          icon={<DollarSign className="h-5 w-5" />}
          description={isLoading ? '' : `${formatCurrency(invoices.total_receivable ?? 0)} receivable`}
          accent="warning"
        />
        <StatBlock
          title="Overdue Invoices"
          value={isLoading ? '—' : invoices.overdue ?? 0}
          icon={<AlertTriangle className="h-5 w-5" />}
          description="Past due date"
          accent="destructive"
        />
        <StatBlock
          title="Unpaid Bills"
          value={isLoading ? '—' : bills.unpaid ?? 0}
          icon={<TrendingDown className="h-5 w-5" />}
          description={isLoading ? '' : `${formatCurrency(bills.total_payable ?? 0)} payable`}
          accent="warning"
        />
      </div>

      {/* Summary cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Customer Invoices */}
        <div className="rounded-3xl border border-border/60 bg-card/90 shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/70 bg-muted/20 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl border border-border/70 bg-muted/60 p-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <CardTitle className="text-sm font-semibold">Customer Invoices</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => navigate('/accounting/invoices')}
            >
              View all
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
          <div className="p-6 space-y-1">
            {isLoading ? (
              <>
                <SummaryRowSkeleton />
                <SummaryRowSkeleton />
                <SummaryRowSkeleton />
              </>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-muted/40 transition-colors">
                  <span className="text-muted-foreground">Draft</span>
                  <span className="font-mono font-medium">{invoices.draft ?? 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-muted/40 transition-colors">
                  <span className="text-muted-foreground">Unpaid</span>
                  <span className="font-mono font-medium">{invoices.unpaid ?? 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-muted/40 transition-colors">
                  <span className="text-muted-foreground">Overdue</span>
                  <span className="font-mono font-medium text-destructive">{invoices.overdue ?? 0}</span>
                </div>
              </>
            )}
            <div className="pt-3">
              <Separator className="mb-3 opacity-60" />
              <div className="flex items-center justify-between px-3">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Total Receivable
                </span>
                {isLoading ? (
                  <Skeleton className="h-5 w-24" />
                ) : (
                  <span className="font-mono text-base font-semibold">
                    {formatCurrency(invoices.total_receivable ?? 0)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Vendor Bills */}
        <div className="rounded-3xl border border-border/60 bg-card/90 shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/70 bg-muted/20 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl border border-border/70 bg-muted/60 p-2">
                <Landmark className="h-4 w-4 text-muted-foreground" />
              </div>
              <CardTitle className="text-sm font-semibold">Vendor Bills</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => navigate('/accounting/invoices?type=in_invoice')}
            >
              View all
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
          <div className="p-6 space-y-1">
            {isLoading ? (
              <>
                <SummaryRowSkeleton />
                <SummaryRowSkeleton />
              </>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-muted/40 transition-colors">
                  <span className="text-muted-foreground">Draft</span>
                  <span className="font-mono font-medium">{bills.draft ?? 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-muted/40 transition-colors">
                  <span className="text-muted-foreground">Unpaid</span>
                  <span className="font-mono font-medium">{bills.unpaid ?? 0}</span>
                </div>
              </>
            )}
            <div className="pt-3">
              <Separator className="mb-3 opacity-60" />
              <div className="flex items-center justify-between px-3">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Total Payable
                </span>
                {isLoading ? (
                  <Skeleton className="h-5 w-24" />
                ) : (
                  <span className="font-mono text-base font-semibold">
                    {formatCurrency(bills.total_payable ?? 0)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick action cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            icon: <Receipt className="h-5 w-5" />,
            title: 'New Invoice',
            description: 'Create a customer invoice',
            onClick: () => navigate('/accounting/invoices/new?type=out_invoice'),
          },
          {
            icon: <CreditCard className="h-5 w-5" />,
            title: 'Register Payment',
            description: 'Record an incoming payment',
            onClick: () => navigate('/accounting/payments'),
          },
          {
            icon: <BarChart3 className="h-5 w-5" />,
            title: 'Chart of Accounts',
            description: 'Browse the account ledger',
            onClick: () => navigate('/accounting/chart-of-accounts'),
          },
        ].map((action) => (
          <button
            key={action.title}
            onClick={action.onClick}
            className="group rounded-3xl border border-border/70 bg-card/85 p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="mb-3 inline-flex rounded-xl border border-border/70 bg-muted/60 p-2.5 transition-all duration-300 group-hover:bg-zinc-900 group-hover:text-white group-hover:border-transparent">
              {action.icon}
            </div>
            <p className="font-semibold">{action.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{action.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
