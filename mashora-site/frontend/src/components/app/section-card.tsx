import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface SectionCardProps {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  contentClassName?: string
}

export function SectionCard({ title, description, actions, children, contentClassName }: SectionCardProps) {
  return (
    <Card className="overflow-hidden bg-card/90">
      <CardHeader className="border-b border-border/70 bg-muted/20">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {actions ? <div className="flex w-full flex-wrap items-center gap-3 md:w-auto md:justify-end">{actions}</div> : null}
        </div>
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  )
}
