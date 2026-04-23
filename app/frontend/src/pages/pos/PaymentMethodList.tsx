import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Skeleton } from '@mashora/design-system'
import {
  CreditCard, Plus, ArrowLeft, Banknote, Terminal as TerminalIcon, User,
  Pencil,
} from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface PaymentMethod {
  id: number
  name: string
  active: boolean
  is_cash_count: boolean
  journal_id: [number, string] | false
  use_payment_terminal: boolean
  split_transactions: boolean
  sequence: number
}

interface PaymentMethodsResponse {
  records: PaymentMethod[]
  total: number
}

type MethodKind = 'cash' | 'terminal' | 'account'

function methodKind(m: PaymentMethod): MethodKind {
  if (m.is_cash_count) return 'cash'
  if (m.use_payment_terminal) return 'terminal'
  return 'account'
}

function KindIcon({ kind }: { kind: MethodKind }) {
  if (kind === 'cash') return <Banknote className="h-5 w-5" />
  if (kind === 'terminal') return <TerminalIcon className="h-5 w-5" />
  return <User className="h-5 w-5" />
}

const KIND_STYLES: Record<MethodKind, { bg: string; text: string; ring: string; label: string }> = {
  cash:     { bg: 'bg-emerald-500/10', text: 'text-emerald-500', ring: 'ring-emerald-500/20', label: 'Cash' },
  terminal: { bg: 'bg-blue-500/10',    text: 'text-blue-500',    ring: 'ring-blue-500/20',    label: 'Terminal' },
  account:  { bg: 'bg-violet-500/10',  text: 'text-violet-500',  ring: 'ring-violet-500/20',  label: 'Account' },
}

function MethodCard({ method, onEdit }: { method: PaymentMethod; onEdit: (id: number) => void }) {
  const kind = methodKind(method)
  const style = KIND_STYLES[kind]
  const journalName = Array.isArray(method.journal_id) ? method.journal_id[1] : null

  return (
    <div
      onClick={() => onEdit(method.id)}
      className="group rounded-2xl border border-border/40 bg-card p-6 space-y-4 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`rounded-xl p-2.5 shrink-0 ring-1 ${style.bg} ${style.text} ${style.ring}`}>
            <KindIcon kind={kind} />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold tracking-tight truncate">{method.name}</p>
            <p className="text-xs text-muted-foreground">Sequence #{method.sequence}</p>
          </div>
        </div>
        <Pencil className="h-4 w-4 text-muted-foreground/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${style.bg} ${style.text}`}>
          {style.label}
        </span>
        {method.split_transactions && (
          <span className="inline-flex items-center rounded-full bg-muted/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Split
          </span>
        )}
        {!method.active && (
          <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-rose-500">
            Archived
          </span>
        )}
      </div>

      <div className="pt-1 border-t border-border/40">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-3">Journal</p>
        <p className="text-sm font-medium truncate">{journalName || '—'}</p>
      </div>
    </div>
  )
}

export default function PaymentMethodList() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery<PaymentMethodsResponse>({
    queryKey: ['pos-payment-methods-list'],
    queryFn: async () => {
      const { data } = await erpClient.raw.get('/pos/payment-methods?active_only=false')
      return data
    },
    staleTime: 30_000,
  })

  const methods = data?.records ?? []
  const total = data?.total ?? methods.length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Methods"
        subtitle={isLoading ? 'Loading…' : `${total} method${total !== 1 ? 's' : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/admin/pos/config')} className="gap-2 rounded-xl">
              <ArrowLeft className="h-4 w-4" /> POS config
            </Button>
            <Button onClick={() => navigate('/admin/pos/payment-methods/new')} className="gap-2 rounded-xl">
              <Plus className="h-4 w-4" /> New method
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : methods.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/40 bg-gradient-to-br from-primary/5 via-background to-emerald-500/5 p-12 text-center space-y-5">
          <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-primary">
            <CreditCard className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-bold tracking-tight">No payment methods configured</p>
            <p className="text-sm text-muted-foreground">
              Add cash, terminal, or account-based methods for your POS.
            </p>
          </div>
          <Button onClick={() => navigate('/admin/pos/payment-methods/new')} className="gap-2 rounded-xl">
            <Plus className="h-4 w-4" /> Create first method
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {methods.map(m => (
            <MethodCard key={m.id} method={m} onEdit={id => navigate(`/admin/pos/payment-methods/${id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}
