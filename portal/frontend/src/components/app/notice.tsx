import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const toneClasses = {
  info: 'border-sky-500/20 bg-sky-500/10 text-sky-800 dark:text-sky-200',
  success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
  warning: 'border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-200',
  danger: 'border-red-500/20 bg-red-500/10 text-red-800 dark:text-red-200',
} as const

interface NoticeProps {
  tone?: keyof typeof toneClasses
  children: ReactNode
  className?: string
}

export function Notice({ tone = 'info', children, className }: NoticeProps) {
  return (
    <div className={cn('rounded-2xl border px-4 py-3 text-sm', toneClasses[tone], className)}>
      {children}
    </div>
  )
}
