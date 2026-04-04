import { Badge } from '@/components/ui/badge'

const statusVariants: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'outline'> = {
  active: 'success',
  trialing: 'info',
  pending: 'warning',
  in_progress: 'info',
  open: 'success',
  resolved: 'info',
  completed: 'success',
  approved: 'info',
  published: 'success',
  low: 'outline',
  normal: 'warning',
  medium: 'warning',
  starter: 'outline',
  professional: 'info',
  enterprise: 'success',
  suspended: 'danger',
  canceled: 'danger',
  cancelled: 'danger',
  failed: 'danger',
  rejected: 'danger',
  urgent: 'danger',
  high: 'warning',
  closed: 'outline',
}

interface StatusBadgeProps {
  value: string
}

export function StatusBadge({ value }: StatusBadgeProps) {
  return (
    <Badge variant={statusVariants[value] ?? 'outline'} className="capitalize">
      {value.replace(/_/g, ' ')}
    </Badge>
  )
}
