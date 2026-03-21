// Service Worker - GAIL対策アプリ
const CACHE_NAME = 'gail-app-v1';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './フラッシュカードデータ.json',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Roboto:wght@300;400;500;700&display=swap'
];

// インストール時 - ファイルをキャッシュ
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching all files');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[Service Worker] Installed successfully');
        return self.skipWaiting(); // 新しいSWをすぐにアクティブ化
      })
  );
});

// アクティベーション時 - 古いキャッシュを削除
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('[Service Worker] Activated successfully');
      return self.clients.claim(); // すぐに制御を取得
    })
  );
});

// フェッチ時 - キャッシュファーストで返す
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // キャッシュにあればそれを返す
        if (response) {
          console.log('[Service Worker] Cache hit:', event.request.url);
          return response;
        }

        // キャッシュになければネットワークから取得
        console.log('[Service Worker] Fetching from network:', event.request.url);
        return fetch(event.request)
          .then(response => {
            // レスポンスが有効かチェック
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // レスポンスをクローンしてキャッシュに保存
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(error => {
            console.error('[Service Worker] Fetch failed:', error);
            // オフライン時のフォールバック（必要に応じて）
            return new Response('オフラインです', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// メッセージ受信（アプリから手動でキャッシュ更新したい時など）
self.addEventListener('message', event => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }

  if (event.data.action === 'clearCache') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      })
    );
  }
});

// プッシュ通知受信（将来的に実装）
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : '新しい通知があります',
    icon: './icon-192.svg',
    badge: './icon-192.svg',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'open',
        title: '開く'
      },
      {
        action: 'close',
        title: '閉じる'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('GAIL対策アプリ', options)
  );
});

// 通知クリック時
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification clicked');
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('./')
    );
  }
});
