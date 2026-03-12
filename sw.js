const CACHE_NAME = 'verbose-v25';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './App.js',
  './icons/icon-72x72.png',
  './icons/icon-96x96.png',
  './icons/icon-128x128.png',
  './icons/icon-144x144.png',
  './icons/icon-152x152.png',
  './icons/icon-192x192.png',
  './icons/icon-384x384.png',
  './icons/icon-512x512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css'
];

// Install: pre-cache all assets
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) { return cache.addAll(PRECACHE_ASSETS); })
      .then(function() { return self.skipWaiting(); })
  );
});

// Activate: delete old caches, take control immediately
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys()
      .then(function(keys) {
        return Promise.all(
          keys.filter(function(k) { return k !== CACHE_NAME; })
              .map(function(k) { return caches.delete(k); })
        );
      })
      .then(function() { return self.clients.claim(); })
  );
});

// Fetch handler
self.addEventListener('fetch', function(event) {
  var request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Always go to network for API calls
  if (request.url.includes('api.anthropic.com') || request.url.includes('storied-horse-d524ab.netlify.app')) {
    event.respondWith(fetch(request));
    return;
  }

  // Navigation requests (HTML pages): network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(function(response) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(request, clone); });
          return response;
        })
        .catch(function() {
          return caches.match(request)
            .then(function(cached) {
              return cached || caches.match('./offline.html');
            });
        })
    );
    return;
  }

  // CDN assets: cache-first (versioned, immutable)
  if (request.url.startsWith('https://unpkg.com/') ||
      request.url.startsWith('https://cdnjs.cloudflare.com/') ||
      request.url.startsWith('https://fonts.googleapis.com/') ||
      request.url.startsWith('https://fonts.gstatic.com/')) {
    event.respondWith(
      caches.match(request).then(function(cached) {
        if (cached) return cached;
        return fetch(request).then(function(response) {
          if (response.ok) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) { cache.put(request, clone); });
          }
          return response;
        });
      })
    );
    return;
  }

  // All other local assets: stale-while-revalidate
  event.respondWith(
    caches.match(request).then(function(cached) {
      var fetchPromise = fetch(request).then(function(response) {
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(request, clone); });
        }
        return response;
      }).catch(function() {
        return cached;
      });
      return cached || fetchPromise;
    })
  );
});
