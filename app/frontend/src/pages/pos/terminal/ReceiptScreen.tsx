import { useState } from 'react'
import { Check, Printer, Mail, Plus } from 'lucide-react'
import { Button, Input } from '@mashora/design-system'
import { toast } from '@/components/shared'
import { fmtMoney, type CompletedReceipt } from './types'

interface ReceiptScreenProps {
  receipt: CompletedReceipt
  onNewOrder: () => void
}

export default function ReceiptScreen({ receipt, onNewOrder }: ReceiptScreenProps) {
  const [email, setEmail] = useState('')

  function sendEmail() {
    if (!email) return
    toast.success('Receipt sent', email)
    setEmail('')
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="rounded-3xl bg-card border border-border/40 shadow-xl p-6 space-y-5">
        {/* Success badge */}
        <div className="flex flex-col items-center space-y-2 pt-2">
          <div className="h-16 w-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <Check className="h-8 w-8 text-emerald-400" strokeWidth={3} />
          </div>
          <div className="text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Payment accepted</p>
            <p className="text-lg font-bold">{receipt.orderName ?? `Order #${receipt.orderId}`}</p>
            <p className="text-xs text-muted-foreground">{receipt.date}</p>
          </div>
        </div>

        {receipt.customer && (
          <div className="text-xs text-center">
            <span className="text-muted-foreground">Customer: </span>
            <span className="font-medium">{receipt.customer}</span>
          </div>
        )}

        {/* Lines */}
        <div className="rounded-2xl border border-border/40 overflow-hidden">
          {receipt.lines.map(l => (
            <div key={l.uid} className="flex justify-between items-start px-4 py-2.5 text-xs border-b border-border/20 last:border-0">
              <div className="flex-1 min-w-0 pr-3">
                <p className="truncate">
                  <span className="font-semibold tabular-nums">{l.qty}×</span> {l.name}
                </p>
                {l.discount > 0 && (
                  <p className="text-[10px] text-rose-400">− {l.discount}% discount</p>
                )}
                {l.note && <p className="text-[10px] text-muted-foreground truncate">{l.note}</p>}
              </div>
              <span className="font-mono tabular-nums shrink-0">
                {fmtMoney(l.price * l.qty * (1 - l.discount / 100))}
              </span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="font-mono tabular-nums">{fmtMoney(receipt.subtotal)}</span>
          </div>
          {receipt.discount > 0 && (
            <div className="flex justify-between text-rose-400">
              <span>Discount</span>
              <span className="font-mono tabular-nums">− {fmtMoney(receipt.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground">
            <span>Tax</span>
            <span className="font-mono tabular-nums">{fmtMoney(receipt.tax)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg pt-2 border-t border-border/30">
            <span>Total</span>
            <span className="font-mono tabular-nums text-emerald-400">{fmtMoney(receipt.total)}</span>
          </div>
        </div>

        {/* Payments */}
        <div className="space-y-1 text-xs pt-2 border-t border-border/30">
          {receipt.payments.map((p, i) => (
            <div key={i} className="flex justify-between">
              <span className="text-muted-foreground">{p.payment_method_name}</span>
              <span className="font-mono tabular-nums">{fmtMoney(p.amount)}</span>
            </div>
          ))}
          {receipt.change > 0 && (
            <div className="flex justify-between font-semibold pt-1 text-emerald-400">
              <span>Change due</span>
              <span className="font-mono tabular-nums">{fmtMoney(receipt.change)}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-2">
          <Button
            className="w-full h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold gap-2 transition-all duration-200"
            onClick={onNewOrder}
          >
            <Plus className="h-4 w-4" /> New Order
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-10 rounded-xl gap-1.5 transition-all duration-200"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" /> Print
            </Button>
            <div className="flex gap-1">
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email receipt"
                className="h-10 rounded-xl text-xs"
              />
              <button
                onClick={sendEmail}
                disabled={!email}
                className="h-10 w-10 shrink-0 rounded-xl border border-border/40 bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all duration-200 disabled:opacity-40"
                aria-label="Send receipt"
              >
                <Mail className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
