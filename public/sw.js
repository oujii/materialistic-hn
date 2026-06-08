const CACHE = 'materialistic-v2';
const SHELL = ['/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  if (e.request.method !== 'GET') return;
  // Don't intercept API or partial-page fetches (used for infinite scroll)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/partial/')) return;

  const isAsset = /\.(js|css|png|ico|webmanifest|woff2?)$/.test(url.pathname);

  if (isAsset) {
    // Cache-first for static assets (hashed filenames = safe to cache forever)
    e.respondWith(
      caches.match(e.request).then(cached => cached ?? fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }))
    );
  } else {
    // Network-first for pages; skip caching responses marked private/no-store
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const cc = res.headers.get('Cache-Control') || '';
            if (!cc.includes('no-store') && !cc.includes('private')) {
              caches.open(CACHE).then(c => c.put(e.request, res.clone()));
            }
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  }
});
