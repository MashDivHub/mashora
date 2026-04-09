import { useQueryClient } from '@tanstack/react-query'
import { useBusSubscription } from '@/lib/websocket'
import { useCallback } from 'react'

/**
 * Subscribe to real-time record updates for a specific model.
 * Automatically invalidates React Query cache when records change.
 */
export function useRecordUpdates(model: string) {
  const queryClient = useQueryClient()

  const handler = useCallback((data: any) => {
    if (data?.model === model) {
      // Invalidate all queries for this model
      queryClient.invalidateQueries({ queryKey: [model] })
    }
  }, [model, queryClient])

  useBusSubscription('record_update', handler)
}
