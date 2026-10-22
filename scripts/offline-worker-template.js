// Replaced by build-web with the hash and exact static output manifest.
const VERSION = '__BUILD_VERSION__';
const ASSETS = /* __BUILD_ASSETS__ */ [];
const CACHE = 'liubai-static-' + VERSION;
const allowed = new Set(ASSETS.map(path => new URL(path, self.registration.scope).pathname));
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await cache.addAll(ASSETS.map(path => new Request(new URL(path, self.registration.scope), { cache: 'reload' })));
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) if (name.startsWith('liubai-static-') && name !== CACHE) await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.search || !allowed.has(url.pathname)) return;
  // Network first keeps online pages current. The fallback is an immutable,
  // complete build, rather than a mix of partial downloads or private API data.
  event.respondWith((async () => {
    try { const response = await fetch(event.request); if (response.ok) return response; } catch {}
    const cached = await (await caches.open(CACHE)).match(url.pathname);
    return cached || new Response('Offline page unavailable', { status: 503 });
  })());
});
