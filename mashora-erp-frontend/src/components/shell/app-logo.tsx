import { Boxes, Sparkles } from 'lucide-react'

export function AppLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex size-12 items-center justify-center overflow-hidden rounded-2xl border border-primary/25 bg-primary/12 text-primary shadow-[0_18px_40px_-24px_rgba(14,165,233,0.8)]">
        <Boxes className="size-5" />
        <Sparkles className="absolute -right-1 -top-1 size-4 rounded-full bg-background p-0.5 text-primary" />
      </div>
      <div>
        <div className="text-sm font-semibold tracking-[0.2em] text-primary">MASHORA</div>
        <div className="text-xs text-muted-foreground">ERP Control Surface</div>
      </div>
    </div>
  )
}
