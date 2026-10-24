import { getDb } from '../db.js';

/**
 * Météo journalière (14 jours passés + 7 jours de prévision) via Open-Meteo.
 *
 * Usage commercial : Open-Meteo est gratuit en non-commercial uniquement.
 * Dès que Premium est vendu, prendre une offre API et renseigner
 * OPEN_METEO_API_KEY (bascule automatique sur customer-api.open-meteo.com).
 *
 * Les coins sont regroupés par maille de 0,1° (~11 km × 7 km) : un seul appel
 * par maille, mis en cache WEATHER_CACHE_HOURS (6 h par défaut).
 */

export const PAST_DAYS = 14;
export const FORECAST_DAYS = 7;
const CACHE_HOURS = Number(process.env.WEATHER_CACHE_HOURS || 6);

export function cellOf(lat, lng) {
  return `${(Math.round(lat * 10) / 10).toFixed(1)},${(Math.round(lng * 10) / 10).toFixed(1)}`;
}

function buildUrl(lat, lng) {
  const key = process.env.OPEN_METEO_API_KEY;
  const base = key ? 'https://customer-api.open-meteo.com/v1/forecast' : 'https://api.open-meteo.com/v1/forecast';
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    daily: 'precipitation_sum,temperature_2m_min,temperature_2m_max',
    past_days: String(PAST_DAYS),
    forecast_days: String(FORECAST_DAYS),
    timezone: 'Europe/Paris'
  });
  if (key) params.set('apikey', key);
  return `${base}?${params}`;
}

async function fetchFromApi(lat, lng) {
  const res = await fetch(buildUrl(lat, lng), { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const json = await res.json();
  const d = json.daily;
  if (!d?.time?.length) throw new Error('Open-Meteo : réponse sans données journalières');
  return {
    time: d.time,
    rain: d.precipitation_sum.map(v => v ?? 0),
    tmin: d.temperature_2m_min,
    tmax: d.temperature_2m_max,
    todayIndex: PAST_DAYS
  };
}

/** Météo d'une maille, depuis le cache si récent. */
export async function getCellWeather(cell) {
  const db = await getDb();
  const cached = await db.get('SELECT fetched_at, data_json FROM weather_cache WHERE cell = ?', cell);
  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_HOURS * 3600 * 1000) {
    return JSON.parse(cached.data_json);
  }
  const [lat, lng] = cell.split(',').map(Number);
  try {
    const data = await fetchFromApi(lat, lng);
    await db.run(
      `INSERT INTO weather_cache (cell, fetched_at, data_json) VALUES (?, ?, ?)
       ON CONFLICT(cell) DO UPDATE SET fetched_at = excluded.fetched_at, data_json = excluded.data_json`,
      cell, new Date().toISOString(), JSON.stringify(data)
    );
    return data;
  } catch (e) {
    // API indisponible : on se rabat sur un cache même périmé plutôt que rien.
    if (cached) return JSON.parse(cached.data_json);
    throw e;
  }
}

/** Météo pour une liste de coins, regroupés par maille. Renvoie Map(cell → data|null). */
export async function getWeatherForSpots(spots) {
  const cells = [...new Set(spots.map(s => cellOf(s.lat, s.lng)))];
  const out = new Map();
  for (const cell of cells) {
    try { out.set(cell, await getCellWeather(cell)); }
    catch (e) { console.warn(`[weather] ${cell} : ${e.message}`); out.set(cell, null); }
  }
  return out;
}
