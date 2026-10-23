import { ignTileUrl } from './ign.js';

/**
 * Zones hors-ligne : téléchargement des tuiles Plan IGN autour d'un point,
 * stockées dans le cache « myco-tiles-zones » lu par le service worker.
 *
 * Poli avec la Géoplateforme : 4 requêtes simultanées au plus, petite pause
 * entre les lots, et un plafond de tuiles par zone.
 */

export const ZONES_CACHE = 'myco-tiles-zones';
const STORE_KEY = 'myco-offline-zones';
export const ZOOM_MIN = 12;
export const ZOOM_MAX = 18;
export const MAX_TILES = 6000;
const AVG_TILE_KB = 14; // moyenne observée sur le Plan IGN (zones boisées / rurales)
const CONCURRENCY = 4;

export function offlineSupported() {
  return 'caches' in window && 'serviceWorker' in navigator;
}

function lng2x(lng, z) { return Math.floor(((lng + 180) / 360) * 2 ** z); }
function lat2y(lat, z) {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * 2 ** z);
}

/** Emprise (sud, ouest, nord, est) d'un cercle de rayon radiusKm. */
export function boundsAround(lat, lng, radiusKm) {
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  return { south: lat - dLat, west: lng - dLng, north: lat + dLat, east: lng + dLng };
}

/** Liste des URL de tuiles couvrant une emprise. */
export function tilesForBounds(b, zMin = ZOOM_MIN, zMax = ZOOM_MAX) {
  const urls = [];
  for (let z = zMin; z <= zMax; z++) {
    const x0 = lng2x(b.west, z), x1 = lng2x(b.east, z);
    const y0 = lat2y(b.north, z), y1 = lat2y(b.south, z);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) urls.push(ignTileUrl(z, x, y));
  }
  return urls;
}

export function estimate(bounds) {
  const count = tilesForBounds(bounds).length;
  return { count, mb: Math.max(1, Math.round((count * AVG_TILE_KB) / 1024)), tooBig: count > MAX_TILES };
}

export function listZones() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch { return []; }
}
function saveZones(zones) { localStorage.setItem(STORE_KEY, JSON.stringify(zones)); }

/**
 * Télécharge une zone. onProgress({ done, total, failed }).
 * Les tuiles déjà en cache ne sont pas re-téléchargées.
 */
export async function downloadZone({ name, bounds, onProgress, signal }) {
  const urls = tilesForBounds(bounds);
  if (urls.length > MAX_TILES) throw new Error('Zone trop grande : réduisez le rayon ou zoomez.');

  // Demande un stockage persistant (évite la purge par le navigateur).
  try { await navigator.storage?.persist?.(); } catch { /* facultatif */ }

  const cache = await caches.open(ZONES_CACHE);
  let done = 0, failed = 0, bytes = 0, i = 0;

  async function worker() {
    while (i < urls.length) {
      if (signal?.aborted) throw new DOMException('Téléchargement annulé', 'AbortError');
      const url = urls[i++];
      try {
        const hit = await cache.match(url);
        if (hit) {
          bytes += Number(hit.headers.get('content-length')) || AVG_TILE_KB * 1024;
        } else {
          const res = await fetch(url, { mode: 'cors', signal });
          if (!res.ok) throw new Error(res.status);
          const blob = await res.clone().blob();
          bytes += blob.size;
          await cache.put(url, res);
          await new Promise(r => setTimeout(r, 40)); // pas de rafale sur le serveur IGN
        }
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        failed++;
      }
      done++;
      onProgress?.({ done, total: urls.length, failed });
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const zone = {
    id: `z${Date.now()}`,
    name,
    bounds,
    tiles: urls.length - failed,
    failed,
    mb: Math.round((bytes / 1024 / 1024) * 10) / 10,
    created_at: new Date().toISOString()
  };
  saveZones([zone, ...listZones()]);

  // Données de l'app (coins, cueillettes) : on force leur mise en cache par le service worker.
  const token = localStorage.getItem('token');
  if (token) {
    for (const path of ['/api/spots', '/api/finds', '/api/auth/profile']) {
      fetch(path, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    }
  }
  return zone;
}

/** Supprime une zone sans casser les tuiles partagées avec une autre zone. */
export async function deleteZone(id) {
  const zones = listZones();
  const zone = zones.find(z => z.id === id);
  if (!zone) return;
  const rest = zones.filter(z => z.id !== id);
  const keep = new Set(rest.flatMap(z => tilesForBounds(z.bounds)));
  const cache = await caches.open(ZONES_CACHE);
  for (const url of tilesForBounds(zone.bounds)) {
    if (!keep.has(url)) await cache.delete(url);
  }
  saveZones(rest);
}

export async function storageEstimate() {
  try {
    const e = await navigator.storage?.estimate?.();
    return e ? { usedMb: Math.round(e.usage / 1048576), quotaMb: Math.round(e.quota / 1048576) } : null;
  } catch { return null; }
}

/**
 * Déconnexion : on efface les données hors-ligne de ce compte. Les zones
 * téléchargées révèlent l'emplacement des coins, elles partent aussi.
 */
export async function clearOfflineData() {
  localStorage.removeItem(STORE_KEY);
  if (!('caches' in window)) return;
  await Promise.all([caches.delete('myco-api'), caches.delete(ZONES_CACHE), caches.delete('myco-tiles-runtime')]);
}
