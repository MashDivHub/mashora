import * as React from 'react'
import { cn } from '../../lib/utils'

interface StatusBarProps {
  states: { value: string; label: string }[]
  currentState: string
  className?: string
}

function StatusBar({ states, currentState, className }: StatusBarProps) {
  const currentIndex = states.findIndex((s) => s.value === currentState)

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {states.map((state, index) => {
        const isActive = index <= currentIndex
        const isCurrent = state.value === currentState
        return (
          <div
            key={state.value}
            className={cn(
              'flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              isActive && !isCurrent && 'bg-success/20 text-success',
              isCurrent && 'bg-primary text-primary-foreground',
              !isActive && 'bg-muted text-muted-foreground'
            )}
          >
            {state.label}
          </div>
        )
      })}
    </div>
  )
}

export { StatusBar }
