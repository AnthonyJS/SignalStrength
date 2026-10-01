/**
 * Service worker: lets the installed app open with no signal.
 *
 * App files are served stale-while-revalidate: straight from cache, so the
 * app launches instantly on a dead train connection, while a fresh copy is
 * fetched in the background for the next launch. The pinned CDN libraries
 * are served cache-first.
 *
 * Only the allowlisted URLs below are ever answered from cache. Everything
 * else (speed-test downloads, map tiles) goes to the network untouched —
 * serving a speed test from cache would record a fake measurement.
 */

// Changing sw.js re-downloads the app shell on its own. Bump this only to
// drop stale entries, e.g. after removing a file from APP_SHELL.
const CACHE_NAME = 'signal-strength-v1';

// Same-origin files, relative to this script. './' is the page itself; it is
// cached as './' rather than 'index.html' because hosts redirect /index.html
// to /, and a redirected response can't be used to answer a navigation.
const APP_SHELL = [
  './',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'css/styles.css',
  'js/app.js',
  'js/Config.js',
  'js/models/DataPoint.js',
  'js/models/Journey.js',
  'js/services/GeolocationService.js',
  'js/services/SpeedTestService.js',
  'js/services/StorageService.js',
  'js/utils/BackgroundTimer.js',
  'js/utils/formatters.js',
  'js/views/CollectorView.js',
  'js/views/MapView.js'
];

// Must match the URLs index.html loads, exactly.
const CDN_ASSETS = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet-doubletapdrag',
  'https://unpkg.com/leaflet-doubletapdragzoom'
];

const PAGE_URL = new URL('./', self.location).href;
const SHELL_URLS = new Set(APP_SHELL.map(path => new URL(path, self.location).href));
const CDN_URLS = new Set(CDN_ASSETS);

self.addEventListener('install', (event) => {
  bypassForUncachedRequests(event);

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(
        // 'reload' skips the HTTP cache so a new install never precaches stale files
        [...APP_SHELL, ...CDN_ASSETS].map(url => new Request(url, { cache: 'reload' }))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  // Any in-scope navigation is the single-page app.
  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(event, PAGE_URL));
  } else if (SHELL_URLS.has(request.url)) {
    event.respondWith(staleWhileRevalidate(event, request.url));
  } else if (CDN_URLS.has(request.url)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
  }
  // Anything else falls through to the network.
});

/**
 * Answers from cache when possible, refreshing the cached copy in the
 * background. Falls back to the network on a cache miss.
 * @param {FetchEvent} event
 * @param {string} url
 * @returns {Promise<Response>}
 */
async function staleWhileRevalidate(event, url) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(url);

  // 'no-cache' revalidates with the server instead of trusting the HTTP cache
  const network = fetch(url, { cache: 'no-cache' });
  // Keep the worker alive until the refreshed copy is stored
  event.waitUntil(
    network
      .then(response => response.ok && cache.put(url, response.clone()))
      .catch(() => {})
  );

  return cached || network;
}

/**
 * Where supported (Chrome), routes requests the fetch handler never caches
 * straight to the network without waking this worker. Otherwise every
 * speed-test download would pay for a fetch-event round trip — and a cold
 * worker start — inside its timed window, skewing the measured speed.
 * Other browsers ignore this and fall through the fetch handler instead.
 * @param {InstallEvent} event
 */
function bypassForUncachedRequests(event) {
  if (!event.addRoutes || typeof URLPattern === 'undefined') {
    return;
  }
  try {
    event.addRoutes({
      condition: {
        not: {
          or: [
            { urlPattern: new URLPattern({ baseURL: self.location.origin, pathname: '*' }) },
            { urlPattern: new URLPattern({ protocol: 'https', hostname: 'unpkg.com' }) }
          ]
        }
      },
      source: 'network'
    }).catch(err => console.warn('Service worker: static routes not applied:', err));
  } catch (err) {
    console.warn('Service worker: static routes not applied:', err);
  }
}
