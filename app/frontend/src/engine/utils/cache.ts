const CACHE_PREFIX = 'mashora_view_cache_'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

interface CacheEntry<T> {
  data: T
  timestamp: number
}

export function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const entry: CacheEntry<T> = JSON.parse(raw)
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_PREFIX + key)
      return null
    }
    return entry.data
  } catch {
    return null
  }
}

export function setCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() }
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry))
  } catch {
    // localStorage full — evict oldest entries
    evictOldest()
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, timestamp: Date.now() }))
    } catch { /* give up */ }
  }
}

export function invalidateCache(pattern?: string): void {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX))
  for (const key of keys) {
    if (!pattern || key.includes(pattern)) {
      localStorage.removeItem(key)
    }
  }
}

function evictOldest(): void {
  const entries: { key: string; timestamp: number }[] = []
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(CACHE_PREFIX)) continue
    try {
      const raw = JSON.parse(localStorage.getItem(key)!)
      entries.push({ key, timestamp: raw.timestamp || 0 })
    } catch { localStorage.removeItem(key) }
  }
  entries.sort((a, b) => a.timestamp - b.timestamp)
  // Remove oldest 25%
  const toRemove = Math.max(1, Math.floor(entries.length / 4))
  for (let i = 0; i < toRemove; i++) {
    localStorage.removeItem(entries[i].key)
  }
}
