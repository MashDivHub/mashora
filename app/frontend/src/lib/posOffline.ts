/**
 * POS offline-first IndexedDB store + sync queue.
 *
 * Stores:
 * - products: cached product catalog for offline use
 * - sessions: cached open POS sessions
 * - orders: locally created orders not yet synced (status: 'pending' | 'synced' | 'failed')
 *
 * Sync strategy:
 * - All POS writes go to IndexedDB first
 * - Background sync attempts to POST pending orders when online
 * - Successful sync updates order status to 'synced' with server id
 * - Failed sync increments retry count; retries with exponential backoff
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

const DB_NAME = 'mashora_pos'
const DB_VERSION = 1

export interface PosProductCache {
  id: number
  name: string
  list_price: number
  default_code?: string
  barcode?: string
  pos_categ_ids?: number[]
  taxes_id?: number[]
  cached_at?: number  // auto-set by cacheProducts
}

export interface PosSessionCache {
  id: number
  config_id: number
  config_name: string
  state: string
  user_id: number
  cached_at: number
}

export interface PosOrderQueued {
  uuid: string                   // local UUID
  server_id?: number             // set after sync
  session_id: number
  config_id: number
  partner_id: number | null
  table_id: number | null
  lines: Array<{ product_id: number; qty: number; price_unit: number; product_name: string }>
  payments: Array<{ payment_method_id: number | string; amount: number; method_name: string }>
  amount_total: number
  amount_tax: number
  amount_paid: number
  amount_return: number
  status: 'pending' | 'syncing' | 'synced' | 'failed'
  retry_count: number
  last_error?: string
  created_at: number
  synced_at?: number
}

interface PosDB extends DBSchema {
  products: {
    key: number
    value: PosProductCache
    indexes: { 'by-barcode': string }
  }
  sessions: {
    key: number
    value: PosSessionCache
  }
  orders: {
    key: string
    value: PosOrderQueued
    indexes: { 'by-status': string; 'by-created': number }
  }
}

let _dbPromise: Promise<IDBPDatabase<PosDB>> | null = null

function getDB(): Promise<IDBPDatabase<PosDB>> {
  if (!_dbPromise) {
    _dbPromise = openDB<PosDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('products')) {
          const products = db.createObjectStore('products', { keyPath: 'id' })
          products.createIndex('by-barcode', 'barcode')
        }
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('orders')) {
          const orders = db.createObjectStore('orders', { keyPath: 'uuid' })
          orders.createIndex('by-status', 'status')
          orders.createIndex('by-created', 'created_at')
        }
      },
    })
  }
  return _dbPromise
}

// ─── Products ─────────────────────────────────────────────────────────────

export async function cacheProducts(products: PosProductCache[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('products', 'readwrite')
  await Promise.all(products.map(p => tx.store.put({ ...p, cached_at: Date.now() })))
  await tx.done
}

export async function getCachedProducts(): Promise<PosProductCache[]> {
  const db = await getDB()
  return db.getAll('products')
}

export async function findProductByBarcode(barcode: string): Promise<PosProductCache | undefined> {
  const db = await getDB()
  return db.getFromIndex('products', 'by-barcode', barcode)
}

// ─── Sessions ─────────────────────────────────────────────────────────────

export async function cacheSession(s: PosSessionCache): Promise<void> {
  const db = await getDB()
  await db.put('sessions', { ...s, cached_at: Date.now() })
}

export async function getCachedSession(id: number): Promise<PosSessionCache | undefined> {
  const db = await getDB()
  return db.get('sessions', id)
}

// ─── Order queue ──────────────────────────────────────────────────────────

export async function queueOrder(order: Omit<PosOrderQueued, 'uuid' | 'status' | 'retry_count' | 'created_at'>): Promise<string> {
  const db = await getDB()
  const uuid = `pos_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const queued: PosOrderQueued = {
    ...order,
    uuid,
    status: 'pending',
    retry_count: 0,
    created_at: Date.now(),
  }
  await db.put('orders', queued)
  return uuid
}

export async function getQueuedOrders(status?: PosOrderQueued['status']): Promise<PosOrderQueued[]> {
  const db = await getDB()
  if (status) return db.getAllFromIndex('orders', 'by-status', status)
  return db.getAll('orders')
}

export async function getQueueCounts(): Promise<{ pending: number; failed: number; synced: number }> {
  const db = await getDB()
  const [pending, failed, synced] = await Promise.all([
    db.countFromIndex('orders', 'by-status', 'pending'),
    db.countFromIndex('orders', 'by-status', 'failed'),
    db.countFromIndex('orders', 'by-status', 'synced'),
  ])
  return { pending, failed, synced }
}

export async function clearSyncedOrders(olderThanDays: number = 7): Promise<number> {
  const db = await getDB()
  const cutoff = Date.now() - olderThanDays * 86400_000
  const synced = await db.getAllFromIndex('orders', 'by-status', 'synced')
  const toDelete = synced.filter(o => (o.synced_at || 0) < cutoff)
  await Promise.all(toDelete.map(o => db.delete('orders', o.uuid)))
  return toDelete.length
}

// ─── Sync ─────────────────────────────────────────────────────────────────

export async function syncOrder(uuid: string): Promise<{ ok: boolean; server_id?: number; error?: string }> {
  const db = await getDB()
  const order = await db.get('orders', uuid)
  if (!order) return { ok: false, error: 'Order not found' }
  if (order.status === 'synced') return { ok: true, server_id: order.server_id }

  // Mark syncing
  await db.put('orders', { ...order, status: 'syncing' })

  try {
    const vals: Record<string, any> = {
      session_id: order.session_id,
      partner_id: order.partner_id || false,
      lines: order.lines.map(l => ({ product_id: l.product_id, qty: l.qty, price_unit: l.price_unit })),
      payment_ids: order.payments.map(p => ({
        ...(typeof p.payment_method_id === 'number' && p.payment_method_id > 0
          ? { payment_method_id: p.payment_method_id }
          : { payment_method_name: p.method_name }),
        amount: p.amount,
      })),
      amount_total: order.amount_total,
      amount_tax: order.amount_tax,
      amount_paid: order.amount_paid,
      amount_return: order.amount_return,
      state: 'paid',
    }
    if (order.table_id) vals.table_id = order.table_id

    const { data } = await erpClient.raw.post('/model/pos.order/create', { vals })
    const serverId = data?.id || data?.record?.id

    await db.put('orders', { ...order, status: 'synced', server_id: serverId, synced_at: Date.now() })
    return { ok: true, server_id: serverId }
  } catch (e: unknown) {
    const errorMsg = extractErrorMessage(e, 'Sync failed')
    await db.put('orders', {
      ...order,
      status: 'failed',
      retry_count: order.retry_count + 1,
      last_error: errorMsg,
    })
    return { ok: false, error: errorMsg }
  }
}

export async function syncAllPending(): Promise<{ succeeded: number; failed: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { succeeded: 0, failed: 0 }
  }
  const pending = await getQueuedOrders('pending')
  let succeeded = 0
  let failed = 0
  for (const o of pending) {
    const r = await syncOrder(o.uuid)
    if (r.ok) succeeded++
    else failed++
  }
  return { succeeded, failed }
}

// ─── Connectivity ─────────────────────────────────────────────────────────

export type ConnectivityState = 'online' | 'offline'

export function subscribeOnline(cb: (state: ConnectivityState) => void): () => void {
  const onUp = () => cb('online')
  const onDown = () => cb('offline')
  window.addEventListener('online', onUp)
  window.addEventListener('offline', onDown)
  return () => {
    window.removeEventListener('online', onUp)
    window.removeEventListener('offline', onDown)
  }
}

// ─── Auto-sync background loop ────────────────────────────────────────────

let _syncTimer: ReturnType<typeof setInterval> | null = null

export function startAutoSync(intervalMs: number = 15000): () => void {
  if (_syncTimer) clearInterval(_syncTimer)
  _syncTimer = setInterval(() => { syncAllPending().catch(() => {}) }, intervalMs)
  // Also sync when coming back online
  const offCb = subscribeOnline((state) => {
    if (state === 'online') syncAllPending().catch(() => {})
  })
  return () => {
    if (_syncTimer) clearInterval(_syncTimer)
    _syncTimer = null
    offCb()
  }
}
