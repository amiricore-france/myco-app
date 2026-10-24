/* Service worker Myco
 *
 * - Application utilisable hors-ligne (coquille HTML + fichiers /assets/).
 * - Tuiles Plan IGN :
 *     · « myco-tiles-zones »   : zones téléchargées par l'utilisateur (Premium),
 *                                jamais purgées automatiquement ;
 *     · « myco-tiles-runtime » : tuiles vues en navigation, plafonnées.
 * - Lecture de l'API hors-ligne (coins, cueillettes, profil, signalements) : réseau d'abord,
 *   cache en secours. Ce cache est vidé à la déconnexion (lib/offline.js).
 * - Notifications push (alertes de poussée).
 */

const VERSION = 'v1';
const SHELL_CACHE = `myco-shell-${VERSION}`;
const ASSETS_CACHE = 'myco-assets';
const API_CACHE = 'myco-api';
const ZONES_CACHE = 'myco-tiles-zones';
const RUNTIME_TILES_CACHE = 'myco-tiles-runtime';
const RUNTIME_TILES_MAX = 1500;

const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png'];
// Lectures d'API utiles hors-ligne (GET uniquement).
const API_OFFLINE = [/^\/api\/spots(\/|$|\?)/, /^\/api\/finds(\/|$|\?)/, /^\/api\/auth\/profile$/, /^\/api\/species(\/|$|\?)/, /^\/api\/dangers(\/|$|\?)/];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = [SHELL_CACHE, ASSETS_CACHE, API_CACHE, ZONES_CACHE, RUNTIME_TILES_CACHE];
    for (const key of await caches.keys()) {
      if (key.startsWith('myco-') && !keep.includes(key)) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

function isTile(url) {
  return url.hostname === 'data.geopf.fr' && url.pathname === '/wmts';
}

async function tileStrategy(request) {
  const zone = await caches.match(request, { cacheName: ZONES_CACHE });
  if (zone) return zone;
  const runtime = await caches.match(request, { cacheName: RUNTIME_TILES_CACHE });
  if (runtime) return runtime;
  try {
    const res = await fetch(request);
    if (res.ok) {
      const cache = await caches.open(RUNTIME_TILES_CACHE);
      await cache.put(request, res.clone());
      trimRuntimeTiles(cache);
    }
    return res;
  } catch {
    // Hors-ligne et tuile absente : case vide plutôt qu'une erreur.
    return new Response('', { status: 504, statusText: 'Hors-ligne' });
  }
}

let trimming = false;
async function trimRuntimeTiles(cache) {
  if (trimming) return;
  trimming = true;
  try {
    const keys = await cache.keys();
    const extra = keys.length - RUNTIME_TILES_MAX;
    for (let i = 0; i < extra; i++) await cache.delete(keys[i]); // les plus anciennes d'abord
  } finally { trimming = false; }
}

async function cacheFirst(request, cacheName) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) (await caches.open(cacheName)).put(request, res.clone());
  return res;
}

async function networkFirst(request, cacheName) {
  try {
    const res = await fetch(request);
    if (res.ok) (await caches.open(cacheName)).put(request, res.clone());
    return res;
  } catch (e) {
    const hit = await caches.match(request, { cacheName });
    if (hit) return hit;
    throw e;
  }
}

async function navigation(request) {
  try {
    const res = await fetch(request);
    if (res.ok) (await caches.open(SHELL_CACHE)).put('/index.html', res.clone());
    return res;
  } catch {
    return (await caches.match('/index.html')) || Response.error();
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (isTile(url)) { event.respondWith(tileStrategy(request)); return; }
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') { event.respondWith(navigation(request)); return; }
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request, ASSETS_CACHE));
    return;
  }
  if (API_OFFLINE.some(re => re.test(url.pathname + url.search))) {
    event.respondWith(networkFirst(request, API_CACHE));
  }
});

// --- Notifications push ---
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || 'Myco', {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: data.tag || 'myco',
    data: { url: data.url || '/' }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.location.origin)) { await w.focus(); return w.navigate(target); }
    }
    return self.clients.openWindow(target);
  })());
});
