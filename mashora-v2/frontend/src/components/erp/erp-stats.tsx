import { Card, CardContent } from '@/components/ui/card'

interface StatItem {
  label: string
  value: string
  hint: string
}

interface ErpStatsProps {
  items: StatItem[]
}

export function ErpStats({ items }: ErpStatsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {item.label}
            </div>
            <div className="mt-3 text-2xl font-semibold">{item.value}</div>
            <div className="mt-1 text-sm text-muted-foreground">{item.hint}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
