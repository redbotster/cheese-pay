// Cheese Pay service worker. Caches only static assets so the app opens fast and works as an installed app.
// Pages and anything under /api are always fetched fresh and never stored: no balances, sessions or wallet data in the cache.
const CACHE = "cheesepay-static-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  const isStatic = u.pathname.startsWith("/_next/static/") || /^\/(icon\.svg|pwa-icon\/\d+|apple-icon)$/.test(u.pathname);
  if (!isStatic) return; // network only for pages and APIs
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(e.request);
    if (hit) return hit;
    const res = await fetch(e.request);
    if (res.ok) c.put(e.request, res.clone());
    return res;
  }));
});
