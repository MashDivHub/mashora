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

  constructor(options: BusOptions = {}) {
    this.options = {
      url: options.url || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/v1/ws/bus`,
      channels: options.channels || ['mashora_erp'],
      reconnectInterval: options.reconnectInterval || 5000,
      maxReconnectAttempts: options.maxReconnectAttempts || 10,
    }
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return

    try {
      this.ws = new WebSocket(this.options.url)

      this.ws.onopen = () => {
        this.reconnectAttempts = 0
        // Subscribe to channels
        this.ws?.send(JSON.stringify({ subscribe: this.options.channels }))
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'ping') {
            this.ws?.send(JSON.stringify({ type: 'pong' }))
            return
          }

          // Dispatch to channel handlers
          const channel = data.channel || 'default'
          const handlers = this.handlers.get(channel)
          if (handlers) {
            handlers.forEach((handler) => {
              try { handler(data.payload || data) } catch (e) { console.error('Bus handler error:', e) }
            })
          }

          // Also dispatch to wildcard handlers
          const wildcardHandlers = this.handlers.get('*')
          if (wildcardHandlers) {
            wildcardHandlers.forEach((handler) => {
              try { handler(data) } catch (e) { console.error('Bus handler error:', e) }
            })
          }
        } catch (e) {
          console.warn('Failed to parse bus message:', e)
        }
      }

      this.ws.onclose = () => {
        this.scheduleReconnect()
      }

      this.ws.onerror = () => {
        this.ws?.close()
      }
    } catch (e) {
      console.warn('WebSocket connection failed:', e)
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

    // Subscribe on server if connected
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ subscribe: [channel] }))
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
import { useEffect } from 'react'

export function useBusSubscription(channel: string, handler: MessageHandler) {
  useEffect(() => {
    bus.connect()
    const unsubscribe = bus.subscribe(channel, handler)
    return unsubscribe
  }, [channel, handler])
}
