import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { cn } from '@mashora/design-system'
import { Bug } from 'lucide-react'

interface DebugInfo {
  model?: string
  viewId?: number
  viewType?: string
  recordId?: number | null
  record?: Record<string, any>
}

// Global debug mode state
let debugEnabled = false
const listeners = new Set<(v: boolean) => void>()

export function isDebugMode(): boolean {
  return debugEnabled
}

export function useDebugMode(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState(debugEnabled)
  const [searchParams] = useSearchParams()

  useEffect(() => {
    // Check URL param
    if (searchParams.get('debug') === '1') {
      debugEnabled = true
      setEnabled(true)
    }

    listeners.add(setEnabled)
    return () => { listeners.delete(setEnabled) }
  }, [searchParams])

  const toggle = (v: boolean) => {
    debugEnabled = v
    listeners.forEach(fn => fn(v))
  }

  return [enabled, toggle]
}

interface DebugPanelProps {
  info: DebugInfo
  className?: string
}

export function DebugPanel({ info, className }: DebugPanelProps) {
  const [debug] = useDebugMode()
  if (!debug) return null

  const metaFields = ['create_uid', 'create_date', 'write_uid', 'write_date', '__last_update']
  const metadata = info.record
    ? metaFields.reduce((acc, f) => {
        if (info.record![f] !== undefined) {
          acc[f] = Array.isArray(info.record![f]) ? info.record![f][1] : info.record![f]
        }
        return acc
      }, {} as Record<string, any>)
    : {}

  return (
    <div className={cn('rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs space-y-2', className)}>
      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
        <Bug className="h-3.5 w-3.5" />
        <span className="font-semibold uppercase tracking-wider">Debug Info</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
        {info.model && <><span className="font-medium">Model:</span><span className="font-mono">{info.model}</span></>}
        {info.viewType && <><span className="font-medium">View Type:</span><span>{info.viewType}</span></>}
        {info.viewId && <><span className="font-medium">View ID:</span><span className="font-mono">{info.viewId}</span></>}
        {info.recordId && <><span className="font-medium">Record ID:</span><span className="font-mono">{info.recordId}</span></>}
        {Object.entries(metadata).map(([k, v]) => (
          <React.Fragment key={k}><span className="font-medium">{k}:</span><span className="font-mono truncate">{String(v)}</span></React.Fragment>
        ))}
      </div>
    </div>
  )
}

// Toggle button for the header
export function DebugToggle() {
  const [debug, setDebug] = useDebugMode()

  return (
    <button
      onClick={() => setDebug(!debug)}
      className={cn(
        'rounded-full p-1.5 transition-colors',
        debug ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'text-muted-foreground hover:text-foreground'
      )}
      title={debug ? 'Disable debug mode' : 'Enable debug mode'}
    >
      <Bug className="h-3.5 w-3.5" />
    </button>
  )
}
