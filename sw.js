// Legendum Service Worker - 离线缓存 + 加速重复加载
const CACHE = "legendum-v1";
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

// 安装时预缓存所有资源
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      console.log("[SW] Caching all game assets...");
      return cache.addAll(ASSETS).catch(err => {
        // 单个文件失败不阻塞安装
        console.warn("[SW] Some assets failed to cache:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 激活时清理旧缓存
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// 缓存优先策略：先从缓存取，缓存没有才走网络
self.addEventListener("fetch", e => {
  // 跳过 chrome-extension 和非 GET 请求
  if (e.request.method !== "GET") return;
  if (e.request.url.startsWith("chrome-extension://")) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        // 只缓存成功的同源请求
        if (!response.ok || response.type !== "basic") return response;
        const cloned = response.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, cloned));
        return response;
      }).catch(() => {
        // 离线时，非页面请求返回空
        if (e.request.destination === "document") {
          return caches.match("index.html");
        }
      });
    })
  );
});
