// Legendum Service Worker - 缓存 + Gzip 客户端解压
importScripts("pako_inflate.min.js");

const CACHE = "legendum-v6";
const ASSETS = [
  "/",
  "index.html",
  "Legendum.js",
  "Legendum.png",
  "Legendum.icon.png",
  "Legendum.apple-touch-icon.png",
  "Legendum.audio.worklet.js",
  "Legendum.audio.position.worklet.js",
  "pako_inflate.min.js"
];

// 需要客户端 gzip 解压的大文件（磁盘上是 .gz，需还原后交给引擎）
const GZIP_ASSETS = ["Legendum.wasm", "Legendum.pck"];

// 安装时预缓存
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll(ASSETS).catch(err =>
        console.warn("[SW] cache addAll:", err)
      )
    ).then(() => self.skipWaiting())
  );
});

// 激活时清旧缓存
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// 请求拦截：gzip 资源 → 解压后返回
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const name = url.pathname.split("/").pop();

  // 大文件：缓存优先，返回时解压
  if (GZIP_ASSETS.includes(name)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return ungzipResponse(cached);
        return fetch(e.request).then(response => {
          if (!response.ok) return response;
          // 缓存原始 gzip 响应
          const toCache = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, toCache));
          return ungzipResponse(response);
        });
      })
    );
    return;
  }

  // 其他资源：缓存优先
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

// 解压 gzip Response → 返回解压后的 Response
async function ungzipResponse(response) {
  const buf = await response.arrayBuffer();
  try {
    const decompressed = pako.inflate(new Uint8Array(buf));
    return new Response(decompressed, {
      status: 200,
      headers: { "Content-Type": "application/octet-stream" }
    });
  } catch (e) {
    console.warn("[SW] pako.inflate failed:", e);
    return response;
  }
}
