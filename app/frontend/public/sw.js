/**
 * Mashora POS service worker — offline app shell + API cache.
 *
 * Strategy:
 * - HTML/JS/CSS: cache-first, network refresh in background (stale-while-revalidate)
 * - API: network-first with timeout, fall back to cache for read-only GETs
 * - POS write endpoints (POST /model/pos.order/create): never cache; fail through to client offline queue
 */
const CACHE_VERSION = 'mashora-v1'
const SHELL_CACHE = `${CACHE_VERSION}-shell`
const API_CACHE = `${CACHE_VERSION}-api`

const SHELL_URLS = ['/', '/admin/pos', '/login']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL_URLS).catch(() => {}))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => !k.startsWith(CACHE_VERSION)).map(k => caches.delete(k))
    ))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // Don't intercept non-http(s) or cross-origin
  if (!url.protocol.startsWith('http')) return
  if (url.origin !== location.origin) return

  // Never cache POS writes — they must hit IndexedDB queue on client
  if (req.method !== 'GET') return

  // API requests: network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(req, API_CACHE))
    return
  }

  // Static shell assets: stale-while-revalidate
  if (url.pathname.match(/\.(js|css|woff2?|ttf|svg|png|jpg|webp|ico)$/)) {
    event.respondWith(staleWhileRevalidate(req, SHELL_CACHE))
    return
  }

  // HTML navigation: shell-first with network refresh
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(req, SHELL_CACHE))
    return
  }
})

async function networkFirst(req, cacheName) {
  try {
    const response = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
    ])
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(req, response.clone()).catch(() => {})
    }
    return response
  } catch {
    const cache = await caches.open(cacheName)
    const cached = await cache.match(req)
    if (cached) return cached
    // Last-resort fallback: return offline page if requesting HTML
    if (req.mode === 'navigate') {
      const shell = await cache.match('/')
      if (shell) return shell
    }
    return new Response('Offline', { status: 503, statusText: 'Offline' })
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(req)
  const fetchPromise = fetch(req).then(response => {
    if (response.ok) cache.put(req, response.clone()).catch(() => {})
    return response
  }).catch(() => cached)
  return cached || fetchPromise
}

// Background sync hook (Chrome only) — triggers POS sync when connection restored
self.addEventListener('sync', (event) => {
  if (event.tag === 'pos-sync') {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(c => c.postMessage({ type: 'pos-sync-trigger' }))
      })
    )
  }
})
