import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageHeader, FormSection, ReadonlyField } from '@/components/shared'
import {
  Badge, Skeleton,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@mashora/design-system'
import { erpClient } from '@/lib/erp-api'
import { ArrowLeft, Gift, Star, Percent, Target } from 'lucide-react'

interface LoyaltyRule {
  id: number
  mode: string
  code: string
  minimum_qty: number
  minimum_amount: number
  reward_point_amount: number
  reward_point_mode: string
  product_ids: number[]
  product_category_id: number | false
}

interface LoyaltyReward {
  id: number
  reward_type: string
  description: string
  required_points: number
  discount: number
  discount_mode: string
  discount_applicability: string
  discount_max_amount: number
  reward_product_id: number | false
  reward_product_qty: number
}

interface LoyaltyProgram {
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
  rules: LoyaltyRule[]
  rewards: LoyaltyReward[]
}

function programTypeBadge(type: string) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
    promotion:     { label: 'Promotion',      variant: 'default' },
    loyalty:       { label: 'Loyalty',        variant: 'secondary' },
    gift_card:     { label: 'Gift Card',      variant: 'outline' },
    promo_code:    { label: 'Promo Code',     variant: 'outline' },
    ewallet:       { label: 'eWallet',        variant: 'secondary' },
  }
  const entry = map[type] ?? { label: type, variant: 'outline' as const }
  return <Badge variant={entry.variant}>{entry.label}</Badge>
}

function triggerBadge(trigger: string) {
  return (
    <Badge variant={trigger === 'auto' ? 'secondary' : 'outline'}>
      {trigger === 'auto' ? 'Automatic' : 'With Code'}
    </Badge>
  )
}

function rewardTypeBadge(type: string) {
  const icons: Record<string, React.ReactNode> = {
    discount: <Percent className="h-3 w-3" />,
    product:  <Gift className="h-3 w-3" />,
    points:   <Star className="h-3 w-3" />,
  }
  return (
    <Badge variant="outline" className="gap-1">
      {icons[type] ?? <Target className="h-3 w-3" />}
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </Badge>
  )
}

function fmt(date: string | false) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString()
}

export default function LoyaltyProgramDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: program, isLoading } = useQuery<LoyaltyProgram>({
    queryKey: ['loyalty-program', id],
    queryFn: async () => {
      const { data } = await erpClient.raw.get(`/sales/loyalty/programs/${id}`)
      return data
    },
    enabled: !!id,
  })

  if (isLoading || !program) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-72 rounded-xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={program.name}
        backTo="/sales/loyalty"
        backLabel="Loyalty Programs"
        icon={<ArrowLeft className="h-4 w-4" />}
      />

      {/* Info card */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
        <div className="grid md:grid-cols-2 gap-x-10 gap-y-4">
          {/* Left column */}
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Program Type</p>
              <div>{programTypeBadge(program.program_type)}</div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trigger</p>
              <div>{triggerBadge(program.trigger)}</div>
            </div>
            <ReadonlyField
              label="Applies On"
              value={
                program.applies_on === 'current' ? 'Current Order'
                : program.applies_on === 'future' ? 'Future Orders'
                : program.applies_on
              }
            />
            <ReadonlyField
              label="Portal Visible"
              value={program.portal_visible ? 'Yes' : 'No'}
            />
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <ReadonlyField
              label="Validity"
              value={
                program.date_from || program.date_to
                  ? `${fmt(program.date_from)} — ${fmt(program.date_to)}`
                  : 'No date restriction'
              }
            />
            <ReadonlyField
              label="Coupons Issued"
              value={program.coupon_count.toLocaleString()}
            />
            <ReadonlyField
              label="Orders Used"
              value={program.total_order_count.toLocaleString()}
            />
          </div>
        </div>
      </div>

      {/* Earning Rules */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          Earning Rules
        </h3>
        {program.rules.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No rules configured</p>
        ) : (
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/40">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Mode</TableHead>
                  {program.rules.some(r => r.mode === 'with_code') && (
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Code</TableHead>
                  )}
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Min Qty</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Min Amount ($)</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Points Earned</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Point Mode</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {program.rules.map(rule => {
                  const hasCode = program.rules.some(r => r.mode === 'with_code')
                  return (
                    <TableRow key={rule.id} className="border-border/30 hover:bg-muted/10">
                      <TableCell>
                        <Badge variant={rule.mode === 'auto' ? 'secondary' : 'outline'}>
                          {rule.mode === 'auto' ? 'Automatic' : 'With Code'}
                        </Badge>
                      </TableCell>
                      {hasCode && (
                        <TableCell className="font-mono text-sm">{rule.code || '—'}</TableCell>
                      )}
                      <TableCell className="text-right font-mono text-sm">{rule.minimum_qty}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {rule.minimum_amount > 0 ? `$${Number(rule.minimum_amount).toFixed(2)}` : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{rule.reward_point_amount}</TableCell>
                      <TableCell className="text-sm capitalize">{rule.reward_point_mode}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Rewards */}
      <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Gift className="h-4 w-4 text-muted-foreground" />
          Rewards
        </h3>
        {program.rewards.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No rewards configured</p>
        ) : (
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/40">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Description</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Type</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Required Points</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Discount %</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Discount Mode</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Max Amount</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Free Product</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {program.rewards.map(reward => (
                  <TableRow key={reward.id} className="border-border/30 hover:bg-muted/10">
                    <TableCell className="text-sm font-medium">{reward.description || '—'}</TableCell>
                    <TableCell>{rewardTypeBadge(reward.reward_type)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{reward.required_points}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {reward.reward_type === 'discount' && reward.discount > 0 ? `${reward.discount}%` : '—'}
                    </TableCell>
                    <TableCell className="text-sm capitalize">
                      {reward.reward_type === 'discount' ? reward.discount_mode : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {reward.discount_max_amount > 0 ? `$${Number(reward.discount_max_amount).toFixed(2)}` : '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {reward.reward_product_id ? `Product #${reward.reward_product_id}` : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
