const CACHE = 'life-wb-v2';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) =>
      Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // 新闻 / 食谱 / 绘画 数据始终走网络，保证每次打开都能看到 Actions 自动刷新的最新内容
  if (url.pathname.endsWith('/news.json') || url.pathname.endsWith('/recipes.json') || url.pathname.endsWith('/drawings.json') || url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(
    caches.match(e.request).then((r) =>
      r ||
      fetch(e.request)
        .then((resp) => {
          const cp = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, cp));
          return resp;
        })
        .catch(() => caches.match('./index.html'))
    )
  );
});
