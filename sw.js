
const CACHE = 'artigiano20-v2';

const CORE_FILES = [
  './',
  './index.html'
];

const OPTIONAL_FILES = [
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);

    await cache.addAll(CORE_FILES);

    await Promise.allSettled(
      OPTIONAL_FILES.map(file => cache.add(file))
    );

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys
        .filter(key => key.startsWith('artigiano20-') && key !== CACHE)
        .map(key => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Non intercetta servizi esterni o richieste API.
  if (url.origin !== self.location.origin) return;

  // Le pagine HTML usano la rete e, offline, la copia salvata.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);

        if (response.ok) {
          const cache = await caches.open(CACHE);
          cache.put('./index.html', response.clone());
        }

        return response;
      } catch (error) {
        return (await caches.match('./index.html')) ||
          new Response('App non disponibile offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
      }
    })());

    return;
  }

  // Per le risorse locali: prima cache, poi rete.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);

      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone());
      }

      return response;
    } catch (error) {
      return new Response('', { status: 503 });
    }
  })());
});
