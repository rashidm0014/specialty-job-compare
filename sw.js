/* Specialty Job Compare — offline shell cache */
const CACHE = "sjc-v5.5.0";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./phase2.js",
  "./app.js",
  "./phase1.js",
  "./phase3.js",
  "./phase4.js",
  "./bootstrap.js",
  "./workflow-guide.js",
  "./data/workflow-guide.json",
  "./data/community-benchmarks.json",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon.svg",
  "./config/monetization.json",
  "./data/specialties/index.json",
  "./data/benchmark-templates/index.json",
  "./data/benchmark-templates/pain-national.json",
  "./data/benchmark-templates/peds-national.json",
  "./data/benchmark-templates/anesthesia-national.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
