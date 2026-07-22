// Echo回声 Service Worker v1.1
// 策略：HTML网络优先（保证更新），静态资源缓存优先（秒开）
var CACHE_NAME = 'echo-v2';
var STATIC_ASSETS = [
  '/echo-app/manifest.json',
  '/echo-app/icons/icon-192.png',
  '/echo-app/icons/icon-512.png',
  '/echo-app/music/autumn.mp3',
  '/echo-app/music/bamboo.mp3',
  '/echo-app/music/breeze.mp3',
  '/echo-app/music/fishing.mp3',
  '/echo-app/music/moonlight.mp3',
  '/echo-app/music/nightcalm.mp3',
  '/echo-app/music/spring.mp3',
  '/echo-app/music/stream.mp3'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // 逐个缓存并各自容错：单个资源 404 不会导致整个 install 失败
      return Promise.all(STATIC_ASSETS.map(function(asset) {
        return cache.add(asset).catch(function(err) {
          console.warn('[SW] 预缓存失败(跳过):', asset, err);
        });
      }));
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return clients.claim();
    })
  );
});

self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // version.txt 永远不缓存（自愈机制依赖它）
  if (url.pathname.indexOf('version.txt') !== -1) {
    e.respondWith(fetch(e.request));
    return;
  }

  // HTML页面：网络优先，失败回退缓存（离线可用）
  if (e.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request).then(function(response) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) { cache.put(e.request, clone); });
        return response;
      }).catch(function() {
        return caches.match(e.request).then(function(cached) {
          return cached || new Response('<h1>离线中</h1><p>请连接网络后重试</p>', {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        });
      })
    );
    return;
  }

  // 静态资源：缓存优先
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;
      return fetch(e.request).then(function(response) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) { cache.put(e.request, clone); });
        return response;
      });
    })
  );
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.indexOf('/echo-app/') !== -1 && 'focus' in list[i]) return list[i].focus();
      }
      if (clients.openWindow) return clients.openWindow('/echo-app/');
    })
  );
});
