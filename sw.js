const CACHE_NAME = 'ai-academy-v1';
const ASSETS = ['./css/tokens.css', './css/base.css', './css/layout.css', './css/components.css', './css/pages.css', './css/forms.css'];

self.addEventListener('install', () => { self.skipWaiting(); });

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(resp => {
        if (resp.ok && ASSETS.some(a => e.request.url.endsWith(a))) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match(new Request('./offline.html')) || caches.match(new Request('./')))
    )
  );
});
