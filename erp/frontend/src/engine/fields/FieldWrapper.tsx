import type { ReactNode } from 'react'
import { Label, Tooltip, TooltipContent, TooltipTrigger, TooltipProvider, cn } from '@mashora/design-system'

interface FieldWrapperProps {
  name: string
  label?: string
  help?: string
  required?: boolean
  readonly?: boolean
  invisible?: boolean
  error?: string
  className?: string
  children: ReactNode
  inline?: boolean
}

export default function FieldWrapper({ name, label, help, required, readonly, invisible, error, className, children, inline }: FieldWrapperProps) {
  if (invisible) return null

  return (
    <div className={cn('min-w-0', inline && 'flex items-center gap-3', className)}>
      {label && (
        <div className="flex items-center gap-1 mb-0.5">
          <Label htmlFor={name} className={cn('text-[13px] font-medium', readonly ? 'text-muted-foreground' : 'text-foreground/80')}>
            {label}
            {required && <span className="text-destructive ml-0.5">*</span>}
          </Label>
          {help && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors">(?)</span>
                </TooltipTrigger>
                <TooltipContent side="top"><p className="max-w-xs text-xs">{help}</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}
      <div className={cn(inline && 'flex-1')}>
        {children}
      </div>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  )
}
