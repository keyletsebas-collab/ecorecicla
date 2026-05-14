const CACHE_NAME = 'reciminsa-v7';
const ASSETS = [
  './',
  './index.html',
  './css/main.css',
  './css/auth.css',
  './css/app.css',
  './css/index.css',
  './js/app.js',
  './js/auth.js',
  './js/sync.js',
  './js/i18n.js',
  './js/materials.js',
  './js/bitacoras.js',
  './js/invoices.js',
  './js/history.js',
  './js/finance.js',
  './js/settings.js',
  './js/sidebar.js',
  './js/firebase-config.js',
  './js/excel-utils.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
