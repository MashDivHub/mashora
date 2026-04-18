import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'text-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        success: 'border-transparent bg-success text-success-foreground',
        warning: 'border-transparent bg-warning text-warning-foreground',
        info: 'border-transparent bg-info text-info-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'destructive'
  | 'success'
  | 'warning'
  | 'info'

const KNOWN_BADGE_VARIANTS: ReadonlySet<string> = new Set([
  'default',
  'secondary',
  'outline',
  'destructive',
  'success',
  'warning',
  'info',
])

/**
 * Maps an arbitrary status/variant string to a typed BadgeVariant, falling
 * back to 'secondary' for unknown values. Use at call sites where `variant`
 * originates from dynamic state maps so we avoid `as any` casts.
 */
export function statusToBadgeVariant(status: string | null | undefined): BadgeVariant {
  if (status && KNOWN_BADGE_VARIANTS.has(status)) {
    return status as BadgeVariant
  }
  return 'secondary'
}

export { Badge, badgeVariants }
