import { Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ErpEmptyStateProps {
  title: string
  description: string
}

export function ErpEmptyState({ title, description }: ErpEmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <Sparkles className="size-5" />
        </div>
        <CardTitle className="mt-4">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{description}</CardContent>
    </Card>
  )
}
