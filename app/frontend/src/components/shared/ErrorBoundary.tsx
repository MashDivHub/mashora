import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@mashora/design-system'
import { AlertTriangle } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Minimal top-level error boundary. Catches render-phase errors thrown
 * anywhere in the subtree and displays a fallback UI with a reset button
 * so the user can retry without a full page reload.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface the error in the dev console so it shows up in local diagnosis.
    // Intentionally minimal — no telemetry, no third-party reporter.
    if (import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary]', error, info?.componentStack)
    }
  }

  reset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    const { error } = this.state
    if (error) {
      if (this.props.fallback) return this.props.fallback(error, this.reset)
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
            <p className="max-w-md text-sm text-muted-foreground">
              An unexpected error prevented this page from rendering. You can try again, or return to the dashboard.
            </p>
          </div>
          {import.meta.env?.DEV && (
            <pre className="max-w-xl overflow-auto rounded-xl border border-border/60 bg-muted/30 p-3 text-left text-xs text-muted-foreground">
              {error.message}
            </pre>
          )}
          <div className="flex gap-2">
            <Button size="sm" className="rounded-xl" onClick={this.reset}>
              Try again
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => {
                this.reset()
                window.location.href = '/admin/dashboard'
              }}
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
