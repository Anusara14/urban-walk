// Urban Walk service worker — offline-friendly, hand-rolled (no build plugin).
// Pages: network first (4 s budget), cached copy when offline or slow.
// Static assets, event data, photos and map tiles: stale-while-revalidate, capped.
const VERSION = "uw-v5";
const PAGES = `${VERSION}-pages`;
const ASSETS = `${VERSION}-assets`;
const TILES = `${VERSION}-tiles`;
const LIMITS = { [ASSETS]: 300, [TILES]: 1500 };
const NAV_TIMEOUT_MS = 4000;

const PRECACHE_PAGES = ["/", "/walk", "/community", "/progress"];
const PRECACHE_ASSETS = [
  "/data/event.json", "/data/urban-walk-route.geojson", "/data/landmark-content.json",
  "/brand/urban-walk-app-icon.svg", "/icon-192.png", "/maplibre/maplibre-gl-worker.mjs",
];

self.addEventListener("install", (e) => {
  // per-URL so one failure doesn't abort the rest
  const put = (name, urls) => caches.open(name).then((c) => Promise.allSettled(urls.map((u) => c.add(u))));
  e.waitUntil(Promise.all([put(PAGES, PRECACHE_PAGES), put(ASSETS, PRECACHE_ASSETS)]));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

// ponytail: FIFO eviction checked every 25 writes; LRU if tile churn ever matters
const writes = {};
async function trim(name) {
  writes[name] = (writes[name] ?? 0) + 1;
  if (writes[name] % 25 !== 0) return;
  const cache = await caches.open(name);
  const keys = await cache.keys();
  const over = keys.length - (LIMITS[name] ?? 500);
  for (let i = 0; i < over; i++) await cache.delete(keys[i]);
}

function staleWhileRevalidate(e, name) {
  const req = e.request;
  return caches.open(name).then(async (cache) => {
    const hit = await cache.match(req);
    const fresh = fetch(req)
      .then((res) => {
        // only readable, successful responses (images are requested with CORS)
        if (res.ok) {
          const copy = res.clone();
          e.waitUntil(cache.put(req, copy).then(() => trim(name)));
        }
        return res;
      })
      .catch(() => hit);
    return hit ?? fresh;
  });
}

function networkFirstPage(e) {
  const req = e.request;
  const network = fetch(req).then((res) => {
    // never let an error page or redirect replace the good offline copy
    if (res.ok && res.type === "basic" && !res.redirected) {
      const copy = res.clone();
      e.waitUntil(caches.open(PAGES).then((c) => c.put(req, copy)));
    }
    return res;
  });
  const cached = () => caches.match(req).then((r) => r ?? caches.match("/"));
  const slow = new Promise((resolve) => setTimeout(resolve, NAV_TIMEOUT_MS)).then(cached);
  // whichever answers first; if the cache has nothing yet, keep waiting for the network
  return Promise.race([network.catch(cached), slow.then((r) => r ?? network)]);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (req.mode === "navigate") return e.respondWith(networkFirstPage(e));
  if (url.hostname === "tiles.openfreemap.org") return e.respondWith(staleWhileRevalidate(e, TILES));
  if (
    (url.origin === self.location.origin && (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/data/") || url.pathname.startsWith("/brand/") || url.pathname.startsWith("/maplibre/"))) ||
    (url.hostname.endsWith("wikimedia.org") && req.destination === "image") ||
    // participant photos and thumbnails (unique, immutable paths)
    (url.hostname.endsWith(".supabase.co") && url.pathname.includes("/storage/v1/object/public/") && req.destination === "image")
  ) {
    return e.respondWith(staleWhileRevalidate(e, ASSETS));
  }
});
