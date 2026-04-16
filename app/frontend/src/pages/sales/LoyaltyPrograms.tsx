import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { PageHeader, SearchBar } from '@/components/shared'
import { Badge, Skeleton } from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { Gift, Tag, Percent, CreditCard, Star, Ticket } from 'lucide-react'

const PROGRAM_TYPES: Record<string, string> = {
  loyalty: 'Loyalty Cards',
  coupons: 'Coupons',
  gift_card: 'Gift Card',
  promotion: 'Promotions',
  ewallet: 'eWallet',
  promo_code: 'Promo Code',
  buy_x_get_y: 'Buy X Get Y',
  next_order_coupons: 'Next Order Coupons',
}

const TYPE_BADGE_CLASS: Record<string, string> = {
  loyalty: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  coupons: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  gift_card: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  promotion: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  ewallet: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  promo_code: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  buy_x_get_y: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  next_order_coupons: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
}

function ProgramIcon({ type, className }: { type: string; className?: string }) {
  const props = { className: className ?? 'h-6 w-6' }
  switch (type) {
    case 'gift_card': return <Gift {...props} />
    case 'loyalty': return <Star {...props} />
    case 'coupons': return <Ticket {...props} />
    case 'promotion': return <Percent {...props} />
    case 'ewallet': return <CreditCard {...props} />
    default: return <Tag {...props} />
  }
}

const TYPE_FILTER_PILLS = [
  { key: 'all', label: 'All' },
  { key: 'loyalty', label: 'Loyalty' },
  { key: 'coupons', label: 'Coupons' },
  { key: 'promotion', label: 'Promotions' },
  { key: 'gift_card', label: 'Gift Cards' },
]

interface LoyaltyRecord {
  id: number
  name: string
  program_type: string
  trigger: string
  applies_on: string
  date_from: string | false
  date_to: string | false
  portal_visible: boolean
  coupon_count: number
  total_order_count: number
  rule_ids: number[]
  reward_ids: number[]
  active: boolean
}

export default function LoyaltyPrograms() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const { data, isLoading } = useQuery({
    queryKey: ['loyalty-programs', search, typeFilter],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/sales/loyalty/programs', {
        program_type: typeFilter === 'all' ? undefined : typeFilter,
        search: search || undefined,
        offset: 0,
        limit: 100,
      })
      return data as { records: LoyaltyRecord[]; total: number }
    },
  })

  const records = data?.records ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-4">
      <PageHeader
        title="Loyalty & Promotions"
        subtitle={isLoading ? 'Loading...' : `${total} program${total !== 1 ? 's' : ''}`}
      />

      <SearchBar
        placeholder="Search programs..."
        onSearch={v => setSearch(v)}
      >
        <div className="flex gap-1.5 flex-wrap">
          {TYPE_FILTER_PILLS.map(pill => (
            <button
              key={pill.key}
              onClick={() => setTypeFilter(pill.key)}
              className={[
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                typeFilter === pill.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/60',
              ].join(' ')}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </SearchBar>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Gift className="h-12 w-12 opacity-30" />
          <p className="text-sm">No programs found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {records.map(program => {
            const typeLabel = PROGRAM_TYPES[program.program_type] ?? program.program_type
            const badgeClass = TYPE_BADGE_CLASS[program.program_type] ?? 'bg-muted/30 text-muted-foreground border-border/40'
            const hasDateFrom = !!program.date_from
            const hasDateTo = !!program.date_to
            const showDates = hasDateFrom || hasDateTo

            return (
              <div
                key={program.id}
                onClick={() => navigate(`/admin/sales/loyalty/${program.id}`)}
                className="rounded-2xl border border-border/30 bg-card/50 p-5 hover:bg-muted/20 hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                {/* Header row */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="shrink-0 rounded-xl bg-muted/40 p-2.5 text-muted-foreground">
                    <ProgramIcon type={program.program_type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold leading-tight truncate">{program.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${badgeClass}`}>
                        {typeLabel}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${program.active ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-muted/20 text-muted-foreground border-border/30'}`}>
                        {program.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  {[
                    { label: 'Coupons Issued', value: program.coupon_count },
                    { label: 'Orders Used', value: program.total_order_count },
                    { label: 'Rules', value: program.rule_ids.length },
                    { label: 'Rewards', value: program.reward_ids.length },
                  ].map(stat => (
                    <div key={stat.label} className="rounded-lg bg-muted/20 px-2 py-1.5 text-center">
                      <p className="text-sm font-semibold tabular-nums">{stat.value}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {/* Validity dates */}
                {showDates && (
                  <p className="text-xs text-muted-foreground">
                    Valid:{' '}
                    {hasDateFrom ? new Date(program.date_from as string).toLocaleDateString() : '—'}
                    {' — '}
                    {hasDateTo ? new Date(program.date_to as string).toLocaleDateString() : '—'}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
