// Service worker of the built page: keeps the page, its workers, OpenCascade's .wasm, the
// fonts and the licences, so that the page works offline once loaded. The build
// (vite.config.ts) writes it to sw.js after CACHE, named after the files, and FILES, every
// file of the page. A new version waits until the page is closed everywhere: an open page
// keeps finding its own files. Plain JavaScript: copied as is by the build.
/* global CACHE, FILES */

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('temoin-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Files of the page from the cache, the page itself for any of its addresses (the preset
// travels in the fragment, never sent); anything else from the network.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  event.respondWith(caches.match(request, { cacheName: CACHE, ignoreSearch: true })
    .then((hit) => hit ?? (request.mode === 'navigate' ? caches.match('./', { cacheName: CACHE }) : undefined))
    .then((hit) => hit ?? fetch(request)));
});
