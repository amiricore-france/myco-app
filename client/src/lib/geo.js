/** Petits calculs géographiques (sans dépendance, utilisables hors-ligne). */

const R = 6371000; // rayon terrestre moyen (m)
const rad = d => (d * Math.PI) / 180;
const deg = r => (r * 180) / Math.PI;

/** Distance en mètres entre deux points {lat, lng}. */
export function distance(a, b) {
  if (!a || !b) return null;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Cap (0-360°, 0 = nord) pour aller de a vers b. */
export function bearing(a, b) {
  if (!a || !b) return null;
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
            Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

const CARDINALS = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest'];
const CARDINALS_SHORT = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

export function cardinal(b, short = false) {
  if (b == null) return '';
  const i = Math.round(b / 45) % 8;
  return (short ? CARDINALS_SHORT : CARDINALS)[i];
}

export function formatDistance(m) {
  if (m == null) return '—';
  if (m < 1000) return `${Math.round(m / 5) * 5} m`;
  return `${(m / 1000).toLocaleString('fr-FR', { maximumFractionDigits: m < 10000 ? 1 : 0 })} km`;
}

/** Longueur totale d'une trace. */
export function trackLength(points) {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += distance(points[i - 1], points[i]);
  return d;
}

/** Durée lisible : « 1 h 05 », « 12 min ». */
export function formatDuration(ms) {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}

/** « il y a 3 min », « à l'instant ». */
export function ago(iso, now = Date.now()) {
  if (!iso) return 'jamais';
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'à l’instant';
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  return `il y a ${formatDuration(s * 1000)}`;
}

export function formatClock(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function formatCoords(p) {
  return p ? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` : '';
}
