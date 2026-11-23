// 応用情報 学習管理：オフライン用 Service Worker
// アプリを更新するときは VERSION を上げる（古いキャッシュが入れ替わる）
const VERSION = '1.1.0';
const CACHE = `ap-study-${VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('ap-study-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 画面（HTML）は「通信できれば最新、だめならキャッシュ」。3秒で応答がなければキャッシュを使う
function networkFirst(request) {
  return new Promise(resolve => {
    let settled = false;
    const fallback = () => caches.match(request, {ignoreSearch: true})
      .then(hit => hit || caches.match('./index.html'))
      .then(hit => hit || caches.match('./'));
    const timer = setTimeout(() => {
      fallback().then(hit => { if (hit && !settled) { settled = true; resolve(hit); } });
    }, 3000);
    fetch(request).then(res => {
      clearTimeout(timer);
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy));
      }
      if (!settled) { settled = true; resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      fallback().then(hit => { if (!settled) { settled = true; resolve(hit || Response.error()); } });
    });
  });
}

// それ以外（アイコンなど）は「キャッシュ優先、なければ取りに行って保存」
function cacheFirst(request) {
  return caches.match(request).then(hit => hit || fetch(request).then(res => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(request, copy));
    }
    return res;
  }));
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')) {
    event.respondWith(networkFirst(req));
  } else {
    event.respondWith(cacheFirst(req));
  }
});
