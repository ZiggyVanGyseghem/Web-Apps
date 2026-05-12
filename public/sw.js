const CACHE_NAME = 'animetrack-cache-v26';
const urlsToCache = [
  './',
  './index.html',
  './camera.html',
  './library.html',
  './browse.html',
  './style.css',
  './app.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap',
  'https://unpkg.com/html5-qrcode'
];

// Install Event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch Event (Network First, falling back to Cache)
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Activate Event (Clean up old caches)
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  clients.claim();
});
// Notification Click Event
self.addEventListener('notificationclick', event => {
  event.notification.close();
  // Broadcast vibration to all clients when notification is clicked
  clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
    for (let client of windowClients) {
      client.postMessage({ type: 'NOTIFICATION_CLICKED', vibrate: [50, 100, 50] });
    }
  });
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // If app is already open, focus it
        for (let client of windowClients) {
          if ('focus' in client) return client.focus();
        }
        // If not, open it
        if (clients.openWindow) return clients.openWindow('./index.html');
      })
  );
});
