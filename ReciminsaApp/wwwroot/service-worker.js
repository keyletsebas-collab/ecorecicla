// =============================================
// SERVICE WORKER – Reciminsaap PWA
// v14: Upgrade Excel exports with styling, currencies, auto column widths, formulas
// =============================================

const CACHE_NAME = 'reciminsaap-v25';

const SAME_ORIGIN_ASSETS = [
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
  './js/clients.js',
  './js/bitacoras.js',
  './js/invoices.js',
  './js/history.js',
  './js/finance.js',
  './js/settings.js',
  './js/ecology.js',
  './js/prices.js',
  './js/security.js',
  './js/sidebar.js',
  './js/supabase-config.js',
  './js/excel-utils.js',
  './js/pdf-utils.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// ---- Install: pre-cache local assets ----
self.addEventListener('install', event => {
  self.skipWaiting(); // Activate immediately, don't wait for old SW to die
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Use individual adds so one failure doesn't block everything
      return Promise.allSettled(
        SAME_ORIGIN_ASSETS.map(url => cache.add(url).catch(() => {}))
      );
    })
  );
});

// ---- Activate: delete old caches and claim all clients ----
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim()) // Take control of ALL open tabs immediately
  );
});

// ---- Fetch: smart routing ----
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. NEVER intercept non-GET requests (POST to Supabase, Google Apps Script, etc.)
  if (req.method !== 'GET') return;

  // 2. NEVER intercept cross-origin requests (Supabase, Google, CDNs, fonts…)
  //    Just returning here lets the browser handle them natively with no SW interference.
  if (url.origin !== self.location.origin) return;

  // 3. Same-origin assets: Cache First → Network fallback
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;

      return fetch(req).then(networkResp => {
        // Cache fresh successful responses for future offline use
        if (networkResp && networkResp.status === 200) {
          const clone = networkResp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return networkResp;
      }).catch(() => {
        // Offline fallback: return cached index.html for navigation
        if (req.mode === 'navigate') {
          return caches.match('./index.html');
        }
        // For other assets, just fail gracefully
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      });
    })
  );
});
