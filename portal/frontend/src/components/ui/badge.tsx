import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-zinc-900 text-zinc-50 dark:border dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        warning: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
        danger: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
        info: 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300',
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

export { Badge, badgeVariants }
