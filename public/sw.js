const CACHE = 'materialistic-v3';
const SHELL = ['/manifest.webmanifest', '/icons/icon-192.png'];
const LISTING_PATHS = /^\/(top|new|best|ask|show|jobs)\/?$/;

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

// Listing pages (top/new/best/…): stale-while-revalidate. Serve the cached copy
// instantly (no network in the foreground), then update the cache in the
// background for the next visit. Same-user installation so private content is fine.
async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  const network = fetch(req).then(res => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return cached || (await network) || new Response('Offline', { status: 503 });
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cc = res.headers.get('Cache-Control') || '';
      if (!cc.includes('no-store')) {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    return cached || new Response('Offline', { status: 503 });
  }
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) {
    const cache = await caches.open(CACHE);
    cache.put(req, res.clone());
  }
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Always go to network for API and partial fetches
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/partial/')) return;

  const isAsset = /\.(js|css|png|ico|webmanifest|woff2?)$/.test(url.pathname);
  if (isAsset) { e.respondWith(cacheFirst(req)); return; }

  if (LISTING_PATHS.test(url.pathname) || url.pathname === '/') {
    e.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Item, search, login etc. — network-first with offline fallback
  e.respondWith(networkFirst(req));
});
