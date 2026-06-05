// Legendum Service Worker - 离线缓存 + 加速重复加载
const CACHE = "legendum-v2";
const ASSETS = [
  "/",
  "index.html",
  "Legendum.js",
  "Legendum.wasm",
  "Legendum.pck",
  "Legendum.png",
  "Legendum.icon.png",
  "Legendum.apple-touch-icon.png",
  "Legendum.audio.worklet.js",
  "Legendum.audio.position.worklet.js",
  "pako_inflate.min.js"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS).catch(err =>
      console.warn("[SW] Some assets failed to cache:", err)
    )).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  if (e.request.url.startsWith("chrome-extension://")) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (!response.ok || response.type !== "basic") return response;
        const cloned = response.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, cloned));
        return response;
      }).catch(() => {
        if (e.request.destination === "document") return caches.match("index.html");
      });
    })
  );
});
