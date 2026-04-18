import { Button, cn } from '@mashora/design-system'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export interface ErrorStateProps {
  error?: Error | unknown
  title?: string
  onRetry?: () => void
  className?: string
}

function formatError(error: Error | unknown): string {
  if (!error) return 'An unexpected error occurred.'
  if (error instanceof Error) return error.message || 'An unexpected error occurred.'
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return 'An unexpected error occurred.'
  }
}

export default function ErrorState({ error, title = 'Something went wrong', onRetry, className }: ErrorStateProps) {
  const message = formatError(error)
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center justify-center gap-3 py-12 text-center', className)}
    >
      <div className="text-destructive">
        <AlertTriangle className="h-10 w-10" />
      </div>
      <p className="text-base font-medium text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground max-w-md break-words">{message}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="mt-2 rounded-xl gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </Button>
      )}
    </div>
  )
}
