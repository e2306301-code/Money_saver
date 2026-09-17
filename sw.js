const CACHE_NAME = 'simple-kakeibo-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './js/app.js',
  './js/domain.js',
  './js/storage.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(names.filter(name => name.startsWith('simple-kakeibo-shell-') && name !== CACHE_NAME).map(name => caches.delete(name)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
