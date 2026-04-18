import { Wifi, WifiOff, RefreshCw, AlertTriangle, Check } from 'lucide-react'
import { Badge, Button, cn } from '@mashora/design-system'
import { usePosOffline } from '@/hooks/usePosOffline'

export default function PosOfflineBadge({ className }: { className?: string }) {
  const { online, pending, failed, syncing, syncNow } = usePosOffline()

  return (
    <div className={cn('flex items-center gap-2 text-xs', className)}>
      {/* Online indicator */}
      <Badge variant={online ? 'success' : 'destructive'} className="gap-1.5 rounded-full">
        {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
        {online ? 'Online' : 'Offline'}
      </Badge>

      {/* Queue status */}
      {pending > 0 && (
        <Badge variant="warning" className="gap-1.5 rounded-full">
          <RefreshCw className={cn('h-3 w-3', syncing && 'animate-spin')} />
          {pending} pending
        </Badge>
      )}

      {failed > 0 && (
        <Badge variant="destructive" className="gap-1.5 rounded-full">
          <AlertTriangle className="h-3 w-3" />
          {failed} failed
        </Badge>
      )}

      {pending === 0 && failed === 0 && online && (
        <Badge variant="outline" className="gap-1.5 rounded-full text-emerald-600 border-emerald-500/30">
          <Check className="h-3 w-3" />
          Synced
        </Badge>
      )}

      {/* Manual sync */}
      {(pending > 0 || failed > 0) && online && (
        <Button size="sm" variant="ghost" className="h-7 text-xs rounded-lg" onClick={syncNow} disabled={syncing}>
          {syncing ? 'Syncing...' : 'Sync now'}
        </Button>
      )}
    </div>
  )
}
