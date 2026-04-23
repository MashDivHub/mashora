import { useEffect, useMemo, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, Button,
} from '@mashora/design-system'
import { Wallet, CreditCard, UserCircle2, Banknote, Delete, X } from 'lucide-react'
import { fmtMoney, type PaymentLine, type PosPaymentMethod } from './types'

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  total: number
  lineCount: number
  methods: PosPaymentMethod[]
  payments: PaymentLine[]
  onChangePayments: (p: PaymentLine[]) => void
  onValidate: () => void
  submitting: boolean
}

const ACCENTS = [
  '#10b981', // emerald (cash)
  '#3b82f6', // blue
  '#a855f7', // purple
  '#f97316', // orange
  '#06b6d4', // cyan
  '#ec4899', // pink
]

function methodIcon(m: PosPaymentMethod) {
  if (m.is_cash_count) return Banknote
  if (m.use_payment_terminal) return CreditCard
  const n = m.name.toLowerCase()
  if (n.includes('cash')) return Banknote
  if (n.includes('account') || n.includes('customer')) return UserCircle2
  if (n.includes('card') || n.includes('credit') || n.includes('debit')) return CreditCard
  return Wallet
}

export default function PaymentDialog({
  open, onOpenChange, total, lineCount, methods, payments, onChangePayments, onValidate, submitting,
}: PaymentDialogProps) {
  const [selectedIdx, setSelectedIdx] = useState<number>(0)

  useEffect(() => {
    if (!open) setSelectedIdx(0)
  }, [open])

  const tendered = useMemo(
    () => payments.reduce((s, p) => s + (Number(p.amount) || 0), 0),
    [payments],
  )
  const remaining = Math.max(0, total - tendered)
  const change = Math.max(0, tendered - total)
  const isPaid = tendered + 0.001 >= total

  function addOrSelectMethod(m: PosPaymentMethod) {
    const existing = payments.findIndex(p => p.payment_method_id === m.id)
    if (existing >= 0) {
      setSelectedIdx(existing)
      return
    }
    const next: PaymentLine[] = [...payments, {
      payment_method_id: m.id,
      payment_method_name: m.name,
      amount: remaining > 0 ? remaining : 0,
      is_cash: !!m.is_cash_count,
    }]
    onChangePayments(next)
    setSelectedIdx(next.length - 1)
  }

  function setAmount(idx: number, amount: number) {
    onChangePayments(payments.map((p, i) => i === idx ? { ...p, amount } : p))
  }

  function addAmount(delta: number) {
    if (selectedIdx < 0 || selectedIdx >= payments.length) return
    setAmount(selectedIdx, Math.max(0, Number((payments[selectedIdx].amount + delta).toFixed(2))))
  }

  function setExact() {
    if (selectedIdx < 0 || selectedIdx >= payments.length) return
    setAmount(selectedIdx, Number((payments[selectedIdx].amount + remaining).toFixed(2)))
  }

  function removeLine(idx: number) {
    const next = payments.filter((_, i) => i !== idx)
    onChangePayments(next)
    setSelectedIdx(Math.max(0, Math.min(idx, next.length - 1)))
  }

  // Keypad
  function pressKey(k: string) {
    if (selectedIdx < 0 || selectedIdx >= payments.length) return
    const current = payments[selectedIdx]
    const s = current.amount.toFixed(2)
    if (k === 'clear') {
      setAmount(selectedIdx, 0)
      return
    }
    if (k === 'back') {
      // drop last significant digit
      const str = s.replace('.', '')
      const trimmed = str.slice(0, -1) || '0'
      const next = Number(trimmed) / 100
      setAmount(selectedIdx, next)
      return
    }
    // Digit or dot: treat whole amount as cents, shift left + append
    if (k === '.') {
      // No-op — we always work with 2 decimals
      return
    }
    const digit = Number(k)
    if (!Number.isFinite(digit)) return
    const str = s.replace('.', '')
    const nextStr = (str + String(digit)).slice(-10)
    const next = Number(nextStr) / 100
    setAmount(selectedIdx, next)
  }

  function onKeypadKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      if (isPaid) onValidate()
    }
  }

  const selected = payments[selectedIdx]

  return (
    <Dialog open={open} onOpenChange={v => !submitting && onOpenChange(v)}>
      <DialogContent
        className="sm:max-w-5xl rounded-3xl p-0 overflow-hidden"
        onKeyDown={onKeypadKey}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/30">
          <DialogTitle className="flex items-center justify-between">
            <span className="text-lg">Charge {fmtMoney(total)}</span>
            <span className="text-xs text-muted-foreground font-normal">
              {lineCount} item{lineCount === 1 ? '' : 's'}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid lg:grid-cols-[1fr_420px]">
          {/* Left: payment methods grid + tendered lines */}
          <div className="p-6 space-y-5 border-r border-border/30">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Payment methods
              </p>
              <div className="grid grid-cols-2 gap-2">
                {methods.map((m, i) => {
                  const Icon = methodIcon(m)
                  const accent = ACCENTS[i % ACCENTS.length]
                  const active = payments.some(p => p.payment_method_id === m.id)
                  return (
                    <button
                      key={m.id}
                      onClick={() => addOrSelectMethod(m)}
                      className={`rounded-2xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
                        active
                          ? 'border-emerald-500/60 bg-emerald-500/10'
                          : 'border-border/40 bg-card hover:border-border'
                      }`}
                    >
                      <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center mb-2"
                        style={{ background: `${accent}26`, color: accent }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <p className="font-semibold text-sm">{m.name}</p>
                      <p className="text-xs text-muted-foreground">Tap to add</p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Tendered
              </p>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No payments yet.</p>
              ) : (
                <div className="space-y-2">
                  {payments.map((p, i) => {
                    const Icon = methodIcon(methods.find(m => m.id === p.payment_method_id) ?? { id: p.payment_method_id, name: p.payment_method_name, is_cash_count: p.is_cash })
                    const isSel = i === selectedIdx
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedIdx(i)}
                        className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200 ${
                          isSel
                            ? 'border-emerald-500/60 bg-emerald-500/10'
                            : 'border-border/40 bg-card hover:bg-muted/40'
                        }`}
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 text-sm font-medium truncate">{p.payment_method_name}</span>
                        <span className="text-sm tabular-nums font-semibold">{fmtMoney(p.amount)}</span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={e => { e.stopPropagation(); removeLine(i) }}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); removeLine(i) } }}
                          className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
                          aria-label="Remove payment"
                        >
                          <X className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="space-y-1 pt-2 border-t border-border/30 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tendered</span>
                <span className="font-mono tabular-nums">{fmtMoney(tendered)}</span>
              </div>
              {remaining > 0.001 ? (
                <div className="flex justify-between text-amber-400 font-semibold">
                  <span>Remaining</span>
                  <span className="font-mono tabular-nums">{fmtMoney(remaining)}</span>
                </div>
              ) : (
                <div className="flex justify-between text-emerald-400 font-semibold">
                  <span>Change due</span>
                  <span className="font-mono tabular-nums">{fmtMoney(change)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Amount + keypad */}
          <div className="p-6 space-y-5 bg-muted/10">
            <div className="text-center space-y-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {selected?.payment_method_name ?? 'Select a method'}
              </p>
              <p className="text-5xl font-bold tabular-nums">
                {selected ? fmtMoney(selected.amount) : fmtMoney(0)}
              </p>
            </div>

            {/* Quick amounts */}
            <div className="grid grid-cols-4 gap-2">
              <button
                disabled={!selected}
                onClick={setExact}
                className="rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold py-2 hover:bg-emerald-500/20 transition-all duration-200 disabled:opacity-40"
              >
                Exact
              </button>
              {[5, 10, 20].map(v => (
                <button
                  key={v}
                  disabled={!selected}
                  onClick={() => addAmount(v)}
                  className="rounded-xl bg-muted/40 border border-border/40 text-xs font-semibold py-2 hover:bg-muted/70 transition-all duration-200 disabled:opacity-40"
                >
                  +${v}
                </button>
              ))}
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2">
              {['1','2','3','4','5','6','7','8','9','.','0','back'].map(k => (
                <button
                  key={k}
                  disabled={!selected}
                  onClick={() => pressKey(k)}
                  className="h-14 rounded-xl bg-card border border-border/40 hover:bg-muted/60 text-xl font-semibold transition-all duration-200 disabled:opacity-40 flex items-center justify-center"
                >
                  {k === 'back' ? <Delete className="h-5 w-5" /> : k}
                </button>
              ))}
            </div>
            <button
              disabled={!selected}
              onClick={() => pressKey('clear')}
              className="w-full h-10 rounded-xl bg-muted/30 border border-border/30 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-all duration-200 disabled:opacity-40"
            >
              Clear
            </button>

            <Button
              className="w-full h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-base font-semibold transition-all duration-200"
              disabled={submitting || !isPaid || lineCount === 0}
              onClick={onValidate}
            >
              {submitting ? 'Processing…' : `Validate ${fmtMoney(total)}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
