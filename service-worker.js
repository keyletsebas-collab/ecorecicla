// =============================================
// SERVICE WORKER – Reciminsaap PWA
// v14: Upgrade Excel exports with styling, currencies, auto column widths, formulas
// =============================================

const CACHE_NAME = 'reciminsaap-v40';

const SAME_ORIGIN_ASSETS = [
  './',
  './index.html',
  './privacidad.html',
  './terminos.html',
  './css/main.css',
  './css/auth.css',
  './css/app.css',
  './css/index.css',
  './css/chatbot.css',
  './js/logger-messages.js',
  './js/supabase-config.js',
  './js/default-logo.js',
  './js/logo-data.js',
  './js/pdf-utils.js',
  './js/i18n.js',
  './js/auth.js',
  './js/biometric-auth.js',
  './js/security.js',
  './js/materials.js',
  './js/clients.js',
  './js/collaborators.js',
  './js/bitacoras.js',
  './js/routes-agenda.js',
  './js/dgii-api.js',
  './js/dgii-reports.js',
  './js/invoices.js',
  './js/history.js',
  './js/finance.js',
  './js/settings.js',
  './js/storage-engine.js',
  './js/sync-status.js',
  './js/audit-log.js',
  './js/company-settings.js',
  './js/qr-vector.js',
  './js/eco-pdf-engine.js',
  './js/ecology.js',
  './js/whatsapp-share.js',
  './js/prices.js',
  './js/sidebar.js',
  './js/excel-utils.js',
  './js/smart-alerts.js',
  './js/app.js',
  './js/mobile-select-picker.js',
  './js/sync.js',
  './js/chatbot.js',
  './js/native-bridge.js',
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

  // 3. Same-origin assets: Network First → Cache fallback (garantiza código actualizado cuando hay red y soporte 100% offline)
  event.respondWith(
    fetch(req)
      .then(networkResp => {
        if (networkResp && networkResp.status === 200) {
          const clone = networkResp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return networkResp;
      })
      .catch(() => {
        return caches.match(req, { ignoreSearch: true }).then(cached => {
          if (cached) return cached;
          if (req.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });
      })
  );
});
