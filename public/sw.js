/* COMET service worker — offline practice.
   Cache-first for same-origin GETs, network fallback, runtime-cached. */
const CACHE = 'comet-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.add('/')));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // ignoreVary: asset responses carry `Vary: Accept-Encoding`, which would
  // otherwise make cache matches miss and fall back to the HTML shell.
  event.respondWith(
    caches.match(req, { ignoreVary: true }).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          if (cached) return cached;
          // Only fall back to the app shell for navigations, never for assets.
          if (req.mode === 'navigate') return caches.match('/', { ignoreVary: true });
          return new Response('', { status: 504, statusText: 'offline' });
        });
      return cached || network;
    }),
  );
});
