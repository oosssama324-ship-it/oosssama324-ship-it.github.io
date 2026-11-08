const CACHE = "memory-game-v2";
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== CACHE).map(n => caches.delete(n)))));
  self.clients.claim();
});

// يحفظ فقط الردود الناجحة من نفس الموقع (لا يحفظ صفحات 404)
function save(req, res){
  if (res && res.ok && new URL(req.url).origin === location.origin) {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
  }
  return res;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  // الصفحات: من الشبكة أولًا حتى تظهر التحديثات فورًا، ومن الذاكرة عند انقطاع الإنترنت
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(r => save(req, r))
        .catch(() => caches.match(req).then(hit => hit || caches.match("index.html")))
    );
    return;
  }

  // باقي الملفات: من الذاكرة أولًا ثم الشبكة
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => save(req, r))));
});
