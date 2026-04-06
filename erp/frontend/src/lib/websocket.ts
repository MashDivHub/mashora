/**
 * WebSocket client for real-time notifications.
 *
 * Connects to the backend bus endpoint and provides subscription
 * management for real-time updates (record changes, chat messages, etc.)
 */

type MessageHandler = (message: any) => void

interface BusOptions {
  url?: string
  channels?: string[]
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

class WebSocketBus {
  private ws: WebSocket | null = null
  private handlers: Map<string, Set<MessageHandler>> = new Map()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private options: Required<BusOptions>
  private pendingSubscriptions: string[] = []

  constructor(options: BusOptions = {}) {
    this.options = {
      url: options.url || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/v1/ws/bus`,
      channels: options.channels || ['mashora_erp'],
      reconnectInterval: options.reconnectInterval || 5000,
      maxReconnectAttempts: options.maxReconnectAttempts || 10,
    }
  }

  private safeSend(data: any): boolean {
    try {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(data))
        return true
      }
    } catch (e) {
      console.warn('[Bus] Send failed:', e)
    }
    return false
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) return

    try {
      this.ws = new WebSocket(this.options.url)

      this.ws.onopen = () => {
        this.reconnectAttempts = 0
        // Send initial subscriptions
        const channels = [...this.options.channels, ...this.pendingSubscriptions]
        this.pendingSubscriptions = []
        this.safeSend({ subscribe: channels })
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'ping') {
            this.safeSend({ type: 'pong' })
            return
          }

          if (data.type === 'subscribed') return // Ack, ignore

          // Dispatch to channel handlers
          const channel = data.channel || 'default'
          const handlers = this.handlers.get(channel)
          if (handlers) {
            handlers.forEach((handler) => {
              try { handler(data.payload || data) } catch (e) { console.error('[Bus] Handler error:', e) }
            })
          }

          // Also dispatch to wildcard handlers
          const wildcardHandlers = this.handlers.get('*')
          if (wildcardHandlers) {
            wildcardHandlers.forEach((handler) => {
              try { handler(data) } catch (e) { console.error('[Bus] Handler error:', e) }
            })
          }
        } catch {
          // Ignore unparseable messages
        }
      }

      this.ws.onclose = () => {
        this.ws = null
        this.scheduleReconnect()
      }

      this.ws.onerror = () => {
        // onclose will fire after this
      }
    } catch {
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) return
    if (this.reconnectTimer) return

    this.reconnectAttempts++
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, this.options.reconnectInterval)
  }

  subscribe(channel: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set())
    }
    this.handlers.get(channel)!.add(handler)

    // Subscribe on server if connected, otherwise queue
    if (!this.safeSend({ subscribe: [channel] })) {
      this.pendingSubscriptions.push(channel)
    }

    // Return unsubscribe function
    return () => {
      this.handlers.get(channel)?.delete(handler)
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
    this.ws = null
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

// Singleton instance
export const bus = new WebSocketBus()

/**
 * React hook for subscribing to bus channels.
 *
 * Usage:
 *   useBusSubscription('record_update', (msg) => { queryClient.invalidateQueries() })
 */
import { useEffect, useRef } from 'react'

export function useBusSubscription(channel: string, handler: MessageHandler) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    bus.connect()
    const stableHandler: MessageHandler = (msg) => handlerRef.current(msg)
    const unsubscribe = bus.subscribe(channel, stableHandler)
    return unsubscribe
  }, [channel])
}
