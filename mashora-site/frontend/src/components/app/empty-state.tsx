import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'

interface EmptyStateProps {
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Card className="border-dashed bg-card/80">
      <CardContent className="flex flex-col items-center justify-center gap-4 py-14 text-center">
        <div className="size-14 rounded-2xl border border-dashed border-border bg-muted/60" />
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </CardContent>
    </Card>
  )
}
