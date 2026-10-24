import { useSyncExternalStore } from 'react';
import { api } from '../api.js';
import { distance, formatDistance } from './geo.js';
import { toast } from './toast-store';

/**
 * Signalements de zones de danger (côté client).
 *
 * - Actifs le jour même uniquement ; ensuite affichés en historique, avec une
 *   couleur qui dit leur ancienneté.
 * - Alerte de proximité : dès qu'une position est connue (« Me localiser » sur
 *   la carte, ou sortie en cours), Myco charge les signalements du jour autour
 *   de vous et prévient une seule fois par signalement à moins d'1 km.
 *   Limite d'une appli web : cela ne fonctionne que si Myco est ouvert.
 */

export const ALERT_RADIUS_M = 1000;

export const DANGER_TYPES = [
  { id: 'chasse',     label: 'Partie de chasse',     short: 'Chasse',     emoji: '🎯' },
  { id: 'travaux',    label: 'Travaux forestiers',   short: 'Travaux',    emoji: '🪓' },
  { id: 'promeneurs', label: 'Promeneurs nombreux',  short: 'Promeneurs', emoji: '🚶' },
  { id: 'suspect',    label: 'Comportement suspect', short: 'Suspect',    emoji: '👁️' },
  { id: 'animaux',    label: 'Animaux errants',      short: 'Animaux',    emoji: '🐕' },
  { id: 'autre',      label: 'Autre danger',         short: 'Autre',      emoji: '⚠️' }
];
export const typeInfo = id => DANGER_TYPES.find(t => t.id === id) || DANGER_TYPES[5];

/** Classes d'ancienneté : couleur + libellé, utilisées par la carte et la légende. */
export const AGE_CLASSES = [
  { id: 'today', label: 'Aujourd’hui',   color: '#dc2626', max: 0 },
  { id: 'week',  label: '1 à 7 jours',   color: '#f97316', max: 7 },
  { id: 'month', label: '8 à 30 jours',  color: '#eab308', max: 30 },
  { id: 'older', label: 'Plus ancien',   color: '#a8a29e', max: Infinity }
];
export function ageClass(r) {
  if (r.age_days === 0 && r.ended_at) return { ...AGE_CLASSES[1], label: 'Terminé aujourd’hui' };
  return AGE_CLASSES.find(c => r.age_days <= c.max);
}

export const PERIODS = [
  { days: 0, label: 'Aujourd’hui', short: 'Auj.' },
  { days: 7, label: '7 jours', short: '7 j' },
  { days: 30, label: '30 jours', short: '30 j' },
  { days: 365, label: '1 an', short: '1 an' }
];

export function whenLabel(r) {
  const time = new Date(r.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (r.age_days === 0) return `aujourd’hui à ${time}`;
  if (r.age_days === 1) return `hier à ${time}`;
  if (r.age_days < 30) return `il y a ${r.age_days} jours`;
  return `le ${new Date(r.created_at).toLocaleDateString('fr-FR')}`;
}

export function bboxString(b) {
  return [b.south, b.west, b.north, b.east].map(n => n.toFixed(4)).join(',');
}

export async function fetchDangers(bounds, days = 0) {
  return api(`/dangers?bbox=${bboxString(bounds)}&days=${days}`);
}
export const createDanger = body => api('/dangers', { method: 'POST', body });
export const confirmDanger = id => api(`/dangers/${id}/confirm`, { method: 'POST' });
export const abuseDanger = id => api(`/dangers/${id}/abuse`, { method: 'POST' });
export const endDanger = id => api(`/dangers/${id}/end`, { method: 'POST' });
export const deleteDanger = id => api(`/dangers/${id}`, { method: 'DELETE' });

// ---------------------------------------------------------------------------
// Veille de proximité (signalements du jour autour de la dernière position)
// ---------------------------------------------------------------------------

const AROUND_KM = 15;               // rayon de chargement autour de la position
const REFRESH_MS = 5 * 60 * 1000;   // rechargement périodique
const RELOAD_MOVE_M = 3000;         // ou après un déplacement notable
const NOTIFIED_KEY = 'myco-danger-notified';

let state = { position: null, today: [], loadedAt: 0, loadedFrom: null, loading: false };
const listeners = new Set();
const emit = () => { state = { ...state }; listeners.forEach(fn => fn()); };
const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export function useNearbyDangers() { return useSyncExternalStore(subscribe, () => state); }

function notifiedSet() {
  try {
    const raw = JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '{}');
    const today = new Date().toDateString();
    return raw.day === today ? { day: today, ids: new Set(raw.ids) } : { day: today, ids: new Set() };
  } catch { return { day: new Date().toDateString(), ids: new Set() }; }
}
function saveNotified(n) {
  try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify({ day: n.day, ids: [...n.ids] })); } catch { /* ignoré */ }
}

async function alertUser(report, meters) {
  const t = typeInfo(report.type);
  const title = `${t.emoji} ${t.label} à ${formatDistance(meters)}`;
  const body = `Signalé ${whenLabel(report)}${report.comment ? ` : « ${report.comment} »` : ''}. Restez vigilant.`;
  toast.warning(title, body);
  try { navigator.vibrate?.([300, 150, 300]); } catch { /* ignoré */ }
  // Notification système si l'utilisateur l'a autorisée (visible même si l'onglet est en arrière-plan).
  try {
    if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      const reg = await navigator.serviceWorker?.getRegistration();
      reg?.showNotification(title, { body, tag: `myco-danger-${report.id}`, icon: '/icons/icon-192.png', data: { url: `/?danger=${report.id}` } });
    }
  } catch { /* ignoré */ }
}

function checkProximity() {
  const pos = state.position;
  if (!pos) return;
  const n = notifiedSet();
  let changed = false;
  for (const r of state.today) {
    if (!r.active || r.mine || n.ids.has(r.id)) continue;
    const d = distance(pos, r);
    if (d != null && d <= ALERT_RADIUS_M) {
      n.ids.add(r.id);
      changed = true;
      alertUser(r, d);
    }
  }
  if (changed) saveNotified(n);
}

async function reload(pos) {
  if (state.loading || !navigator.onLine) return;
  state.loading = true;
  try {
    const dLat = AROUND_KM / 111.32;
    const dLng = AROUND_KM / (111.32 * Math.cos((pos.lat * Math.PI) / 180));
    const { reports } = await fetchDangers(
      { south: pos.lat - dLat, west: pos.lng - dLng, north: pos.lat + dLat, east: pos.lng + dLng }, 0
    );
    state.today = reports;
    state.loadedAt = Date.now();
    state.loadedFrom = pos;
  } catch { /* hors-ligne : on garde la dernière liste */ }
  finally { state.loading = false; emit(); checkProximity(); }
}

/** À appeler à chaque nouvelle position connue (carte, sortie). */
export function notePosition(p) {
  if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return;
  if (!localStorage.getItem('token')) return;
  state.position = { lat: p.lat, lng: p.lng };
  const stale = Date.now() - state.loadedAt > REFRESH_MS;
  const moved = !state.loadedFrom || distance(state.loadedFrom, state.position) > RELOAD_MOVE_M;
  if (stale || moved) reload(state.position);
  else checkProximity();
  emit();
}

/** Après un nouveau signalement : l'ajouter tout de suite à la veille. */
export function addToday(report) {
  state.today = [report, ...state.today.filter(r => r.id !== report.id)];
  emit();
}
export function updateToday(report) {
  state.today = state.today.map(r => (r.id === report.id ? { ...r, ...report } : r));
  emit();
}
export function removeToday(id) {
  state.today = state.today.filter(r => r.id !== id);
  emit();
}
