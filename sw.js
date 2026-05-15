// DiasporaConnect Service Worker
const CACHE_NAME = 'diaspora-v1';
const STATIC_CACHE = 'diaspora-static-v1';
const DYNAMIC_CACHE = 'diaspora-dynamic-v1';

// Fichiers statiques à mettre en cache
const STATIC_FILES = [
  '/',
  '/index.html',
  '/app.html',
  '/app-styles.css',
  '/app-script.js',
  '/manifest.json',
  '/auth.js',
  '/blockchain.js',
  '/coingecko.js',
  '/rates.js',
  '/transactions.js',
  '/transfer.js',
  '/withdraw.js',
  '/assets/favicon.svg',
  '/assets/icon-192.png',
  '/assets/icon-512.png'
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installation...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Mise en cache des fichiers statiques');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => self.skipWaiting())
  );
});

// Activation du Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Stratégie de cache: Cache First avec fallback réseau
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API requests: Network First avec cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Ressources statiques: Cache First
  event.respondWith(cacheFirst(event.request));
});

// Cache First - Try cache, then fetch
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return caches.match('/index.html');
  }
}

// Network First - Try network, then cache
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response(
      JSON.stringify({ error: 'Hors ligne' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Gestion des notifications push
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const options = {
    body: data.body || 'Nouveau transfert disponible',
    icon: '/assets/icon-192.png',
    badge: '/assets/badge-72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'view', title: 'Voir' },
      { action: 'close', title: 'Fermer' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'DiasporaConnect', options)
  );
});

// Gestion des clics sur les notifications
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view' || !event.action) {
    event.waitUntil(
      clients.openWindow(event.notification.data?.url || '/')
    );
  }
});

// Sync automatique pour les transferts
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-transfers') {
    event.waitUntil(syncTransfers());
  }
});

async function syncTransfers() {
  // Sync des transfers en attente quand reconnecté
  const cache = await caches.open(DYNAMIC_CACHE);
  const requests = await cache.keys();

  for (const request of requests) {
    if (request.url.includes('/api/transfer')) {
      try {
        const response = await fetch(request);
        if (response.ok) {
          cache.put(request, response);
        }
      } catch (error) {
        console.log('[SW] Transfert en attente:', request.url);
      }
    }
  }
}

// Background sync
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-rates') {
    event.waitUntil(updateExchangeRates());
  }
});

async function updateExchangeRates() {
  try {
    const response = await fetch('/api/rates');
    const data = await response.json();
    const cache = await caches.open(DYNAMIC_CACHE);
    await cache.put('/api/rates', new Response(JSON.stringify(data)));
  } catch (error) {
    console.log('[SW] Impossible de mettre à jour les taux');
  }
}