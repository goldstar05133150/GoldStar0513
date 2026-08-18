// キャッシュバージョン。更新したい場合はここのバージョン名を変更（例: v2 -> v3）
const CACHE_NAME = 'goldstar-cache-v2';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js'
];

// インストール時にファイルをキャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  // 新しいService Workerを即座にアクティブにする
  self.skipWaiting();
});

// アクティベート時に古いキャッシュを削除（PWAの即時更新用）
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // すべてのクライアント（開いているタブ）を直ちに制御下に置く
  self.clients.claim();
});

// ネットワーク優先（Network First）戦略でのフェッチ処理
// 更新を最速で反映させるため、ネットワーク取得を試みて失敗した場合にキャッシュを返す
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // ネットワークから正常に取得できた場合、キャッシュも更新しておく
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(event.request, responseToCache);
          });
        return response;
      })
      .catch(() => {
        // オフライン時、またはネットワーク取得エラー時はキャッシュから返す
        return caches.match(event.request);
      })
  );
});
