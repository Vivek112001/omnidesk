const CACHE_NAME = 'omnidesk-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './css/main.css',
  './css/timer.css',
  './css/stopwatch.css',
  './css/todo.css',
  './css/notes.css',
  './css/journal.css',
  './js/storage.js',
  './js/audio.js',
  './js/timer.js',
  './js/stopwatch.js',
  './js/todo.js',
  './js/notes.js',
  './js/journal.js',
  './js/pwa.js',
  './js/app.js',
  './icons/icon-192.svg',
  './icons/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Cache addAll error during install:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Pass through external network requests (like GitHub Gist API) directly
  if (event.request.url.startsWith('http') && !event.request.url.includes(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
          })
          .catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
