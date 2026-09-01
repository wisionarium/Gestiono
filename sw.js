// ============================================
// SERVICE WORKER — BOA GESTÃO PWA
// Cache offline e suporte PWA completo
// ============================================

const CACHE_NAME = 'boa-gestao-v14';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './storage.js',
  './utils.js',
  './supabase-config.js',
  './logo.svg',
  './wisionarium-logo.png',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Ativação e limpeza de caches antigos
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
    }).then(() => self.clients.claim())
  );
});

// Estratégia Network-First com fallback para cache (Garante atualizações imediatas no dev/produção)
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('supabase.co') || event.request.method !== 'GET') {
    return;
  }

  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
