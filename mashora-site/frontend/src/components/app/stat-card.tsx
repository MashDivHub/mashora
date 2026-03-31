import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  hint?: string
}

export function StatCard({ title, value, icon: Icon, hint }: StatCardProps) {
  return (
    <Card className="group overflow-hidden bg-card/90 transition-transform duration-300 hover:-translate-y-0.5">
      <CardContent className="p-6">
        <div className="mb-5 flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">{title}</p>
            <div className="text-3xl font-semibold tracking-tight">{value}</div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/60 p-3 text-muted-foreground transition-colors group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:bg-zinc-100 dark:group-hover:text-zinc-900">
            <Icon className="size-5" />
          </div>
        </div>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}
