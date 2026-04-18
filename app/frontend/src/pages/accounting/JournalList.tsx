import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import {
  Badge, Button, Input, Label, Skeleton, cn,
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@mashora/design-system'
import {
  ShoppingCart, Package, Landmark, Wallet, FileText, BookMarked,
  Plus, Upload, ChevronRight, AlertTriangle,
} from 'lucide-react'
import { PageHeader, M2OInput, toast } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

type CurrencyValue = [number, string] | number | false

type JournalType = 'sale' | 'purchase' | 'bank' | 'cash' | 'general'

interface Journal {
  id: number
  name: string
  type: JournalType
  code: string
  color?: number
  currency_id?: [number, string] | false
  company_id?: [number, string]
  bank_account_id?: [number, string] | false
}

interface JournalCounts {
  draft: number
  awaiting: number
  late_amount: number
  to_reconcile: number
  last_balance: number
  last_statement_date: string | null
}

const TYPE_META: Record<JournalType, {
  label: string
  Icon: typeof ShoppingCart
  iconClass: string
  stripe: string
}> = {
  sale: {
    label: 'Sale',
    Icon: ShoppingCart,
    iconClass: 'bg-blue-500/15 text-blue-400',
    stripe: 'bg-blue-500',
  },
  purchase: {
    label: 'Purchase',
    Icon: Package,
    iconClass: 'bg-amber-500/15 text-amber-400',
    stripe: 'bg-amber-500',
  },
  bank: {
    label: 'Bank',
    Icon: Landmark,
    iconClass: 'bg-emerald-500/15 text-emerald-400',
    stripe: 'bg-emerald-500',
  },
  cash: {
    label: 'Cash',
    Icon: Wallet,
    iconClass: 'bg-purple-500/15 text-purple-400',
    stripe: 'bg-purple-500',
  },
  general: {
    label: 'Misc.',
    Icon: FileText,
    iconClass: 'bg-slate-500/15 text-slate-300',
    stripe: 'bg-slate-500',
  },
}

// Optional Odoo color palette mapping
const COLOR_STRIPES: Record<number, string> = {
  1: 'bg-red-500', 2: 'bg-orange-500', 3: 'bg-amber-500',
  4: 'bg-yellow-500', 5: 'bg-lime-500', 6: 'bg-emerald-500',
  7: 'bg-cyan-500', 8: 'bg-blue-500', 9: 'bg-indigo-500',
  10: 'bg-purple-500', 11: 'bg-pink-500',
}

function fmtCur(v: number) {
  return v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M`
    : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K`
    : `$${(v || 0).toFixed(2)}`
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

async function safePost<T>(url: string, body: unknown, fallback: T): Promise<T> {
  try {
    const { data } = await erpClient.raw.post(url, body)
    return data as T
  } catch {
    return fallback
  }
}

async function loadJournalCounts(j: Journal): Promise<JournalCounts> {
  const today = new Date().toISOString().split('T')[0]
  const counts: JournalCounts = {
    draft: 0,
    awaiting: 0,
    late_amount: 0,
    to_reconcile: 0,
    last_balance: 0,
    last_statement_date: null,
  }

  if (j.type === 'sale' || j.type === 'purchase') {
    const moveType = j.type === 'sale' ? 'out_invoice' : 'in_invoice'
    const [draft, awaiting, late] = await Promise.all([
      safePost('/model/account.move', {
        domain: [
          ['journal_id', '=', j.id],
          ['move_type', '=', moveType],
          ['state', '=', 'draft'],
        ],
        fields: ['id'], limit: 1,
      }, { total: 0 }),
      safePost('/model/account.move', {
        domain: [
          ['journal_id', '=', j.id],
          ['move_type', '=', moveType],
          ['state', '=', 'posted'],
          ['payment_state', 'in', ['not_paid', 'partial']],
        ],
        fields: ['id'], limit: 1,
      }, { total: 0 }),
      safePost('/model/account.move/read_group', {
        domain: [
          ['journal_id', '=', j.id],
          ['move_type', '=', moveType],
          ['state', '=', 'posted'],
          ['payment_state', 'in', ['not_paid', 'partial']],
          ['invoice_date_due', '<', today],
        ],
        fields: ['amount_residual'],
        groupby: [],
      }, { groups: [] as Array<Record<string, unknown>> }),
    ])
    counts.draft = draft.total || 0
    counts.awaiting = awaiting.total || 0
    counts.late_amount = Number(late.groups?.[0]?.amount_residual || 0)
  } else if (j.type === 'bank' || j.type === 'cash') {
    const [reconcile, lastStatement] = await Promise.all([
      safePost('/model/account.bank.statement.line', {
        domain: [
          ['journal_id', '=', j.id],
          ['is_reconciled', '=', false],
        ],
        fields: ['id'], limit: 1,
      }, { total: 0 }),
      safePost('/model/account.bank.statement', {
        domain: [['journal_id', '=', j.id]],
        fields: ['id', 'date', 'balance_end_real'],
        order: 'date desc, id desc',
        limit: 1,
      }, { records: [] as Array<Record<string, unknown>> }),
    ])
    counts.to_reconcile = reconcile.total || 0
    const last = lastStatement.records?.[0]
    if (last) {
      counts.last_balance = Number(last.balance_end_real || 0)
      counts.last_statement_date = typeof last.date === 'string' ? last.date : null
    }
  } else {
    // Misc / general
    const draft = await safePost('/model/account.move', {
      domain: [
        ['journal_id', '=', j.id],
        ['state', '=', 'draft'],
      ],
      fields: ['id'], limit: 1,
    }, { total: 0 })
    counts.draft = draft.total || 0
  }

  return counts
}

// ─── Create Journal Dialog ───────────────────────────────────────────────────

interface JournalFormState {
  name: string
  code: string
  type: JournalType
  currency_id: CurrencyValue
}

const blankJournal: JournalFormState = {
  name: '',
  code: '',
  type: 'sale',
  currency_id: false,
}

function NewJournalDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}) {
  const [form, setForm] = useState<JournalFormState>(blankJournal)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) setForm(blankJournal)
  }, [open])

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    if (!form.code.trim()) { toast.error('Code is required'); return }
    setBusy(true)
    try {
      const vals: Record<string, unknown> = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase().slice(0, 5),
        type: form.type,
      }
      if (form.currency_id) {
        vals.currency_id = Array.isArray(form.currency_id)
          ? form.currency_id[0]
          : form.currency_id
      }
      await erpClient.raw.post('/model/account.journal/create', { vals })
      toast.success('Journal created')
      onOpenChange(false)
      onCreated()
    } catch (e: unknown) {
      toast.error('Create failed', extractErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Journal</DialogTitle>
          <DialogDescription>
            Create a new accounting journal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="journal-name">Name</Label>
            <Input
              id="journal-name"
              value={form.name}
              placeholder="Customer Invoices"
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="journal-code">Code</Label>
              <Input
                id="journal-code"
                value={form.code}
                placeholder="INV"
                maxLength={5}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="journal-type">Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm(f => ({ ...f, type: v as JournalType }))}
              >
                <SelectTrigger id="journal-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sale">Sale</SelectItem>
                  <SelectItem value="purchase">Purchase</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="general">Miscellaneous</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Currency</Label>
            <M2OInput
              model="res.currency"
              value={form.currency_id}
              onChange={v => setForm(f => ({ ...f, currency_id: v }))}
              placeholder="Company default"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Journal Card ────────────────────────────────────────────────────────────

function CountChip({
  label, value, onClick, tone = 'default',
}: {
  label: string
  value: number | string
  onClick?: () => void
  tone?: 'default' | 'danger' | 'warning'
}) {
  const toneClass = tone === 'danger'
    ? 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/15'
    : tone === 'warning'
    ? 'border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/15'
    : 'border-border/40 bg-muted/30 hover:bg-muted/50'
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'flex items-center justify-between w-full text-xs rounded-lg px-2.5 py-1.5 border transition-colors text-left',
        toneClass,
        !onClick && 'opacity-80 cursor-default',
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1 font-semibold tabular-nums">
        {value}
        {onClick && <ChevronRight className="h-3 w-3" />}
      </span>
    </button>
  )
}

function JournalCard({ journal }: { journal: Journal }) {
  const navigate = useNavigate()
  const meta = TYPE_META[journal.type] || TYPE_META.general
  const Icon = meta.Icon
  const stripeColor = (journal.color && COLOR_STRIPES[journal.color]) || meta.stripe

  const { data: counts, isLoading } = useQuery<JournalCounts>({
    queryKey: ['journal-counts', journal.id, journal.type],
    queryFn: () => loadJournalCounts(journal),
    staleTime: 60_000,
  })

  function renderBody() {
    if (isLoading) {
      return (
        <div className="space-y-2">
          <Skeleton className="h-7 rounded-lg" />
          <Skeleton className="h-7 rounded-lg" />
        </div>
      )
    }
    const c = counts || {
      draft: 0, awaiting: 0, late_amount: 0,
      to_reconcile: 0, last_balance: 0, last_statement_date: null,
    }

    if (journal.type === 'sale') {
      return (
        <div className="space-y-2">
          {c.draft > 0 && (
            <CountChip
              label="Draft"
              value={c.draft}
              onClick={() => navigate(`/admin/invoicing/invoices?journal=${journal.id}&filter=draft`)}
            />
          )}
          {c.awaiting > 0 && (
            <CountChip
              label="Waiting Payment"
              value={c.awaiting}
              onClick={() => navigate(`/admin/invoicing/invoices?journal=${journal.id}&filter=open`)}
            />
          )}
          {c.late_amount > 0 && (
            <CountChip
              label="Late"
              value={fmtCur(c.late_amount)}
              tone="danger"
              onClick={() => navigate(`/admin/invoicing/invoices?journal=${journal.id}&filter=overdue`)}
            />
          )}
          {c.draft === 0 && c.awaiting === 0 && c.late_amount === 0 && (
            <p className="text-xs text-muted-foreground italic">All caught up.</p>
          )}
          <Button
            size="sm"
            className="w-full h-8 text-xs rounded-lg gap-1"
            onClick={() => navigate(`/admin/invoicing/invoices/new?journal=${journal.id}`)}
          >
            <Plus className="h-3.5 w-3.5" />
            New Invoice
          </Button>
        </div>
      )
    }

    if (journal.type === 'purchase') {
      return (
        <div className="space-y-2">
          {c.draft > 0 && (
            <CountChip
              label="Draft Bills"
              value={c.draft}
              onClick={() => navigate(`/admin/invoicing/invoices?journal=${journal.id}&filter=draft&type=bills`)}
            />
          )}
          {c.awaiting > 0 && (
            <CountChip
              label="To Pay"
              value={c.awaiting}
              tone="warning"
              onClick={() => navigate(`/admin/invoicing/invoices?journal=${journal.id}&filter=open&type=bills`)}
            />
          )}
          {c.draft === 0 && c.awaiting === 0 && (
            <p className="text-xs text-muted-foreground italic">No pending bills.</p>
          )}
          <Button
            size="sm"
            variant="outline"
            className="w-full h-8 text-xs rounded-lg gap-1"
            onClick={() => toast.info('Upload bill', 'Bill OCR upload coming soon')}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload Bill
          </Button>
        </div>
      )
    }

    if (journal.type === 'bank') {
      return (
        <div className="space-y-2">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Last Statement
            </p>
            <p className="text-sm font-semibold">{fmtDate(c.last_statement_date)}</p>
            {c.last_statement_date && (
              <p className="text-base font-bold tracking-tight tabular-nums">
                {fmtCur(c.last_balance)}
              </p>
            )}
          </div>
          {c.to_reconcile > 0 ? (
            <Button
              size="sm"
              className="w-full h-8 text-xs rounded-lg gap-1"
              onClick={() => navigate(`/admin/accounting/bank/${journal.id}/reconcile`)}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Reconcile {c.to_reconcile} items
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground italic">Nothing to reconcile.</p>
          )}
          <Button
            size="sm"
            variant="outline"
            className="w-full h-8 text-xs rounded-lg gap-1"
            onClick={() => navigate(`/admin/accounting/bank?journal=${journal.id}&action=new`)}
          >
            <Plus className="h-3.5 w-3.5" />
            New Statement
          </Button>
        </div>
      )
    }

    if (journal.type === 'cash') {
      return (
        <div className="space-y-2">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Current Balance
            </p>
            <p className="text-2xl font-bold tracking-tight tabular-nums">
              {fmtCur(c.last_balance)}
            </p>
          </div>
          <Button
            size="sm"
            className="w-full h-8 text-xs rounded-lg gap-1"
            onClick={() => navigate(`/admin/model/account.move/new?journal_id=${journal.id}`)}
          >
            <Plus className="h-3.5 w-3.5" />
            New Cash Move
          </Button>
        </div>
      )
    }

    // Miscellaneous / general
    return (
      <div className="space-y-2">
        {c.draft > 0 ? (
          <CountChip
            label="Draft Entries"
            value={c.draft}
            onClick={() => navigate(`/admin/model/account.move?journal_id=${journal.id}&state=draft`)}
          />
        ) : (
          <p className="text-xs text-muted-foreground italic">No draft entries.</p>
        )}
        <Button
          size="sm"
          className="w-full h-8 text-xs rounded-lg gap-1"
          onClick={() => navigate(`/admin/model/account.move/new?journal_id=${journal.id}`)}
        >
          <Plus className="h-3.5 w-3.5" />
          New Entry
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden hover:shadow-md hover:border-border/70 transition-all">
      {/* Color stripe */}
      <div className={cn('h-[3px] w-full', stripeColor)} />

      {/* Header */}
      <div className="p-4 flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn('rounded-xl p-2.5 shrink-0', meta.iconClass)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" title={journal.name}>
              {journal.name}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                {meta.label}
              </Badge>
              {journal.code && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  {journal.code}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pb-4">
        {renderBody()}
      </div>
    </div>
  )
}

// ─── Skeleton card ───────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
      <Skeleton className="h-[3px] w-full rounded-none" />
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <Skeleton className="h-7 rounded-lg" />
        <Skeleton className="h-8 rounded-lg" />
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function JournalList() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['journals'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/accounting/journals', {
        domain: [],
        offset: 0,
        limit: 100,
      })
      return data
    },
  })

  const records: Journal[] = data?.records ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journals"
        subtitle="accounting"
        actions={
          <Button
            size="sm"
            className="rounded-xl gap-1.5"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" /> New Journal
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
            <BookMarked className="h-6 w-6" />
          </div>
          <p className="text-sm">No journals found.</p>
          <Button
            size="sm"
            className="rounded-xl gap-1.5 mt-2"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" /> Create one
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {records.map(j => <JournalCard key={j.id} journal={j} />)}
        </div>
      )}

      <NewJournalDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['journals'] })
        }}
      />
    </div>
  )
}
