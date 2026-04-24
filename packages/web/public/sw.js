const CACHE_NAME = 'meetmind-v1'
const CORE_ASSETS = ['/', '/favicon.ico', '/manifest.json', '/offline.html']

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return
  }
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
    event.respondWith(fetch(request))
    return
  }
  if (request.method !== 'GET') return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')))
    return
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached
      return fetch(request)
        .then(response => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then(cache => {
            if (url.protocol === 'http:' || url.protocol === 'https:') {
              cache.put(request, copy).catch(() => {})
            }
          })
          return response
        })
        .catch(() => cached)
    }),
  )
})
