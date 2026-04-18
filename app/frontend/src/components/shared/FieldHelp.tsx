import { HelpCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, cn } from '@mashora/design-system'

/**
 * A small `?` icon that reveals a short explanation on hover/focus.
 * Use it next to field labels or any other UI element that needs clarification.
 *
 * Usage:
 *   <Label>Invoicing Policy <FieldHelp text="Determines when the customer is invoiced: on order placement, or only for delivered quantities." /></Label>
 */
export default function FieldHelp({ text, className }: { text: string; className?: string }) {
  if (!text) return null
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center justify-center ml-1 text-muted-foreground/60 hover:text-foreground cursor-help transition-colors align-middle',
              className,
            )}
            tabIndex={0}
            role="button"
            aria-label="Help"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-xs text-xs leading-relaxed">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
