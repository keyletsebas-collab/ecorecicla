const CACHE_NAME = 'reciminsa-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/css/index.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/sync.js',
  '/js/i18n.js',
  '/js/materials.js',
  '/js/invoices.js',
  '/js/finance.js',
  '/js/settings.js',
  '/js/firebase-config.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
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
