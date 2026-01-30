const CACHE_NAME = 'palestra-v2'; // Ho incrementato la versione per forzare l'aggiornamento
const ASSETS = [
  './', // Cache della root, importante!
  './login.html',
  './style.css',
  './login.js',
  
  './dashboard-client.html',
  './client-style.css',
  './dashboard-client.js',
  
  './dashboard-pt.html',
  './dashboard-pt.js', // Assumendo esista uno stile condiviso o dedicato
  
  './onboarding.html',
  './onboarding-style.css',
  './onboarding.js',
  
  './workout-builder.html',
  './builder-style.css',
  './workout-builder.js',
  
  './workout-viewer.html',
  './viewer-style.css',
  './workout-viewer.js',
  
  './pending.html',
  
  './exercise-db.js',
  './manifest.json',
  './sw.js',
  
  // ICONE (FONDAMENTALI!)
  './icon/icon-192.png',
  './icon/icon-512.png',
  
  // Font di Google (per un offline completo)
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff2' // Questo URL potrebbe cambiare, è un esempio
];

// Installazione: mette i file in cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
      return cache.addAll(ASSETS);
    })
  );
});

// Attivazione: pulisce le vecchie cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Clearing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch: serve i file dalla cache se offline
self.addEventListener('fetch', (event) => {
  // Ignora le richieste non-GET
  if (event.request.method !== 'GET') return;
  
  // Per le richieste ai font di Google, usa una strategia "stale-while-revalidate"
  if (event.request.url.startsWith('https://fonts.googleapis.com') || event.request.url.startsWith('https://fonts.gstatic.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        const fetchedResponse = fetch(event.request).then((networkResponse) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
        return cachedResponse || fetchedResponse;
      })
    );
    return;
  }
  
  // Per tutte le altre richieste, usa una strategia "cache-first"
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});