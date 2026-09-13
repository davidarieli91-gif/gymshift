/* GymShift service worker:
 * - network-first for navigations and /api (fresh data wins, cache as offline fallback)
 * - cache-first for static assets (icons, fonts, _next/static)
 * - offline fallback for navigations → cached "/"
 * - skipWaiting + clientsClaim so updates apply immediately
 */
const CACHE = "gymshift-v1";
const PRECACHE = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation = req.mode === "navigate";
  const isApi = url.pathname.startsWith("/api");

  if (isNavigation || isApi) {
    // network-first: try the network, fall back to the cache when offline
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !isNavigation) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached ?? (isNavigation ? caches.match("/") : undefined)),
        ),
    );
    return;
  }

  // static assets: cache-first
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ??
        fetch(req).then((res) => {
          if (res.ok && (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons") || req.destination === "font" || req.destination === "image")) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
