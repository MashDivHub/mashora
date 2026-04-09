import { useNavigate } from 'react-router-dom'
import {
  BarChart2,
  TrendingUp,
  BookOpen,
  Clock,
  Users,
  Globe,
  DollarSign,
  FileText,
} from 'lucide-react'
import { PageHeader } from '@/components/shared'

interface ReportLink {
  icon: React.ReactNode
  label: string
  to: string
}

interface ReportGroup {
  title: string
  links: ReportLink[]
}

const GROUPS: ReportGroup[] = [
  {
    title: 'Accounting Reports',
    links: [
      { icon: <BookOpen className="h-4 w-4" />, label: 'Trial Balance', to: '/accounting/reports/trial-balance' },
      { icon: <TrendingUp className="h-4 w-4" />, label: 'Profit & Loss', to: '/accounting/reports/profit-loss' },
      { icon: <BarChart2 className="h-4 w-4" />, label: 'Balance Sheet', to: '/accounting/reports/balance-sheet' },
      { icon: <DollarSign className="h-4 w-4" />, label: 'Aged Receivable', to: '/accounting/reports/aged-receivable' },
      { icon: <FileText className="h-4 w-4" />, label: 'Aged Payable', to: '/accounting/reports/aged-payable' },
    ],
  },
  {
    title: 'Sales Reports',
    links: [
      { icon: <TrendingUp className="h-4 w-4" />, label: 'Margin Analysis (per order — linked from order detail)', to: '#' },
    ],
  },
  {
    title: 'Project Reports',
    links: [
      { icon: <Clock className="h-4 w-4" />, label: 'Timesheet Summary', to: '/projects/timesheets/summary' },
    ],
  },
  {
    title: 'Website Reports',
    links: [
      { icon: <Globe className="h-4 w-4" />, label: 'Visitor Analytics', to: '/website/analytics' },
    ],
  },
]

export default function ReportCenter() {
  const navigate = useNavigate()

  const handleLink = (to: string) => {
    if (to && to !== '#') navigate(to)
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Report Center" subtitle="All available reports" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {GROUPS.map(group => (
          <div
            key={group.title}
            className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-3"
          >
            <p className="text-sm font-semibold text-foreground">{group.title}</p>
            <div className="space-y-1">
              {group.links.map(link => (
                <button
                  key={link.label}
                  onClick={() => handleLink(link.to)}
                  disabled={link.to === '#'}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted/30 transition-colors text-sm text-left disabled:opacity-50 disabled:cursor-default text-muted-foreground hover:text-foreground"
                >
                  {link.icon}
                  {link.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
