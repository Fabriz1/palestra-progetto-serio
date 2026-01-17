const CACHE_NAME = "fitness-pwa-v1";

const ASSETS = [
  "/",

  // HTML
  "/login.html",
  "/dashboard-client.html",
  "/dashboard-pt.html",
  "/onboarding.html",
  "/pending.html",
  "/workout-builder.html",
  "/workout-viewer.html",

  // CSS
  "/style.css",
  "/builder-style.css",
  "/client-style.css",
  "/onboarding-style.css",
  "/viewer-style.css",

  // JS
  "/login.js",
  "/dashboard-client.js",
  "/dashboard-pt.js",
  "/exercise-db.js",
  "/onboarding.js",
  "/workout-builder.js",
  "/workout-viewer.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
