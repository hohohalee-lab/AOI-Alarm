const V = 'aoi-v3', SHELL = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url); if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.includes('/data/')) {   // data: network first, fall back to last copy when offline
    const key = new Request(u.origin + u.pathname);   // ignore the ?t= cache-buster so the offline copy is found
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(V).then(x => x.put(key, c)); return r; }).catch(() => caches.match(key)));
  } else {                                // shell: cache first, refresh in background
    e.respondWith(caches.match(e.request).then(m => { const n = fetch(e.request).then(r => { caches.open(V).then(x => x.put(e.request, r.clone())); return r; }).catch(() => m); return m || n; }));
  }
});
