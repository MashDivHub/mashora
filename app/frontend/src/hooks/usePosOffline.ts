import { useEffect, useState } from 'react'
import {
  subscribeOnline, startAutoSync, getQueueCounts, syncAllPending,
  type ConnectivityState,
} from '@/lib/posOffline'

export interface PosOfflineState {
  online: boolean
  pending: number
  failed: number
  synced: number
  syncing: boolean
  syncNow: () => Promise<void>
}

export function usePosOffline(): PosOfflineState {
  const [online, setOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [counts, setCounts] = useState({ pending: 0, failed: 0, synced: 0 })
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    const unsubOnline = subscribeOnline((s: ConnectivityState) => setOnline(s === 'online'))
    const stopAutoSync = startAutoSync(15_000)

    const refreshCounts = async () => {
      try { setCounts(await getQueueCounts()) } catch { /* db not ready */ }
    }
    refreshCounts()
    const tick = setInterval(refreshCounts, 5_000)

    return () => {
      unsubOnline()
      stopAutoSync()
      clearInterval(tick)
    }
  }, [])

  async function syncNow() {
    setSyncing(true)
    try {
      await syncAllPending()
      setCounts(await getQueueCounts())
    } finally {
      setSyncing(false)
    }
  }

  return { online, ...counts, syncing, syncNow }
}
