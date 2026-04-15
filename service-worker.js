// ============================================
// SERVICE WORKER - MALIK SERVICE (OPTIMIZED)
// ============================================
// Tips: Ganti CACHE_NAME menjadi 'malik-service-v5' setiap kali deploy update besar
// ============================================

const CACHE_NAME = 'malik-service-v4';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// ============================================
// INSTALL - Simpan file inti untuk offline
// ============================================
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Installed successfully');
        return cache.addAll(urlsToCache);
      })
  );
  // Force waiting service worker to become active
  self.skipWaiting();
});

// ============================================
// FETCH - Strategi Cerdas Campuran
// ============================================
self.addEventListener('fetch', event => {
  // Abaikan request non-GET (POST, PUT, DELETE)
  if (event.request.method !== 'GET') return;
  
  const url = event.request.url;
  
  // --- STRATEGI 1: HTML Utama -> NETWORK FIRST (Biar selalu update) ---
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Update cache diam-diam
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Kalau offline, tampilkan index.html dari cache
          return caches.match('/index.html');
        })
    );
    return;
  }
  
  // --- STRATEGI 2: Aset Statis & Library -> CACHE FIRST (Hemat kuota & cepat) ---
  if (url.includes('/images/') || 
      url.includes('/css/') || 
      url.includes('font-awesome') || 
      url.includes('fonts.googleapis.com') || 
      url.includes('fonts.gstatic.com') ||
      url.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Kalau belum ada di cache, ambil dari network lalu simpan
          return fetch(event.request).then(response => {
            if (!response || response.status !== 200) {
              return response;
            }
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
            return response;
          });
        })
    );
    return;
  }
  
  // --- STRATEGI 3: File JS & Data -> NETWORK FIRST (Biar fungsi kasir selalu fresh) ---
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache JS file untuk offline cadangan
        if (url.endsWith('.js')) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback ke cache kalau network gagal
        return caches.match(event.request);
      })
  );
});

// ============================================
// ACTIVATE - Bersihkan cache lama
// ============================================
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache ->', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Ambil alih halaman yang sedang terbuka
  return self.clients.claim();
});
