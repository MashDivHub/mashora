import { useState } from 'react'
import { Plus, Minus, Trash2, ChevronDown, Percent, StickyNote } from 'lucide-react'
import { Input } from '@mashora/design-system'
import { fmtMoney, imageSrc, type CartLine } from './types'

interface CartLineRowProps {
  line: CartLine
  onQtyChange: (uid: string, delta: number) => void
  onQtySet: (uid: string, qty: number) => void
  onRemove: (uid: string) => void
  onDiscountChange: (uid: string, discount: number) => void
  onNoteChange: (uid: string, note: string) => void
  accentColor?: string
}

export default function CartLineRow({
  line,
  onQtyChange,
  onQtySet,
  onRemove,
  onDiscountChange,
  onNoteChange,
  accentColor = '#10b981',
}: CartLineRowProps) {
  const [expanded, setExpanded] = useState(false)
  const img = imageSrc(line.image_1920)
  const gross = line.price * line.qty
  const discountAmount = gross * (line.discount / 100)
  const net = gross - discountAmount

  return (
    <div className="rounded-xl border border-border/30 bg-card/60 hover:bg-card transition-colors duration-200">
      <div
        className="flex items-center gap-3 p-3 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Thumbnail */}
        <div
          className="h-12 w-12 rounded-lg shrink-0 overflow-hidden flex items-center justify-center"
          style={{ background: img ? undefined : `${accentColor}26` }}
        >
          {img ? (
            <img src={img} alt="" className="h-full w-full object-cover" />
          ) : (
            <span
              className="text-sm font-bold"
              style={{ color: accentColor }}
            >
              {line.name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>

        {/* Middle */}
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate text-sm">{line.name}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <span className="tabular-nums">{fmtMoney(line.price)}</span>
            {line.discount > 0 && (
              <span className="text-rose-400">− {line.discount}%</span>
            )}
            {line.note && (
              <span className="flex items-center gap-1 truncate">
                <StickyNote className="h-3 w-3" /> {line.note}
              </span>
            )}
          </div>
        </div>

        {/* Qty stepper */}
        <div
          className="flex items-center gap-1 shrink-0"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => onQtyChange(line.uid, -1)}
            className="h-7 w-7 rounded-md border border-border/40 bg-muted/30 flex items-center justify-center hover:bg-muted/60 transition-all duration-200"
            aria-label="Decrease quantity"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-8 text-center text-sm font-semibold tabular-nums">{line.qty}</span>
          <button
            onClick={() => onQtyChange(line.uid, 1)}
            className="h-7 w-7 rounded-md border border-border/40 bg-muted/30 flex items-center justify-center hover:bg-muted/60 transition-all duration-200"
            aria-label="Increase quantity"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Line total */}
        <span className="text-sm font-semibold tabular-nums w-20 text-right shrink-0">
          {fmtMoney(net)}
        </span>

        {/* Remove */}
        <button
          onClick={e => { e.stopPropagation(); onRemove(line.uid) }}
          className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200 shrink-0"
          aria-label="Remove line"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>

        <ChevronDown
          className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-0 border-t border-border/20 space-y-2">
          <div className="grid grid-cols-2 gap-2 pt-2">
            <label className="text-xs space-y-1">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Percent className="h-3 w-3" /> Discount %
              </span>
              <Input
                type="number"
                min="0"
                max="100"
                step="1"
                value={line.discount}
                onChange={e => onDiscountChange(line.uid, Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                className="h-8 rounded-lg text-right tabular-nums"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="flex items-center gap-1 text-muted-foreground">Qty</span>
              <Input
                type="number"
                min="0"
                step="1"
                value={line.qty}
                onChange={e => onQtySet(line.uid, Math.max(0, Number(e.target.value) || 0))}
                className="h-8 rounded-lg text-right tabular-nums"
              />
            </label>
          </div>
          <label className="text-xs space-y-1 block">
            <span className="flex items-center gap-1 text-muted-foreground">
              <StickyNote className="h-3 w-3" /> Note
            </span>
            <Input
              value={line.note ?? ''}
              onChange={e => onNoteChange(line.uid, e.target.value)}
              placeholder="No pickles, extra sauce…"
              className="h-8 rounded-lg"
            />
          </label>
        </div>
      )}
    </div>
  )
}
