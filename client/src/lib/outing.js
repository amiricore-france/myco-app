import { useSyncExternalStore } from 'react';
import { api } from '../api.js';
import { distance } from './geo.js';

/**
 * Sortie en cours — enregistreur de trace « hors-ligne d'abord ».
 *
 * - Tout est d'abord stocké sur le téléphone (localStorage) : le retour au
 *   véhicule fonctionne sans réseau, avec les cartes hors-ligne.
 * - Le serveur est synchronisé dès que possible (création de la sortie,
 *   lots de positions, fin, SOS). La création est idempotente (client_id) :
 *   une sortie démarrée sans réseau est envoyée plus tard.
 * - Limite des applis web : écran éteint ou appli en arrière-plan, le
 *   téléphone suspend la géolocalisation. D'où l'option « écran allumé »
 *   (Wake Lock) et, côté serveur, la veille qui alerte les proches si plus
 *   rien n'arrive ou si l'heure de retour est dépassée.
 */

const KEY = 'myco-outing';
const SYNC_EVERY_MS = 60 * 1000;
const MIN_MOVE_M = 15;            // distance minimale entre deux points de trace
const HEARTBEAT_MS = 2 * 60 * 1000; // un point au moins toutes les 2 min (preuve de vie)
const MAX_ACCURACY_M = 60;        // au-delà, la position est affichée mais pas enregistrée
const CHUNK = 300;

let state = load();
const rt = {
  current: null,       // dernière position GPS {lat, lng, accuracy, t, heading, speed}
  watching: false,
  geoError: null,
  syncing: false,
  lastSyncAt: null,
  lastError: null,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  keepAwake: false,
  battery: null,
  notice: null         // message ponctuel (ex. sortie clôturée côté serveur)
};
let snapshot = build();
const listeners = new Set();
let watchId = null;
let syncTimer = null;
let wakeLock = null;
let wantAwake = false;

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
}
function persist() {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state));
    else localStorage.removeItem(KEY);
  } catch { /* stockage plein : la trace reste en mémoire */ }
}
function build() {
  return { outing: state, ...rt, pendingPoints: state ? state.track.length - state.sent : 0 };
}
function emit(save = false) {
  if (save) persist();
  snapshot = build();
  listeners.forEach(fn => fn());
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function getSnapshot() { return snapshot; }
export function useOuting() { return useSyncExternalStore(subscribe, getSnapshot); }

function currentUserId() {
  try { return JSON.parse(localStorage.getItem('user'))?.id ?? null; } catch { return null; }
}
function randomId() {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function followUrl(o = state) {
  return o?.followToken ? `${window.location.origin}/suivi/${o.followToken}` : null;
}

// ---------------------------------------------------------------------------
// Géolocalisation
// ---------------------------------------------------------------------------
function onFix(pos) {
  const c = pos.coords;
  const p = {
    lat: c.latitude, lng: c.longitude,
    accuracy: Math.round(c.accuracy),
    t: new Date(pos.timestamp || Date.now()).toISOString()
  };
  rt.current = { ...p, heading: Number.isFinite(c.heading) ? c.heading : null, speed: c.speed };
  rt.geoError = null;

  let added = false;
  if (state && !state.endedLocal && p.accuracy <= MAX_ACCURACY_M) {
    const last = state.track[state.track.length - 1];
    const d = last ? distance(last, p) : Infinity;
    const dt = last ? Date.parse(p.t) - Date.parse(last.t) : Infinity;
    if (d >= Math.max(MIN_MOVE_M, p.accuracy * 0.5) || dt >= HEARTBEAT_MS) {
      state.track.push(p);
      added = true;
    }
  }
  emit(added);
}

function onGeoError(err) {
  rt.geoError = err.code === 1
    ? 'Accès à la position refusé : autorisez la localisation pour Myco dans les réglages.'
    : 'Signal GPS faible ou indisponible. Restez à découvert quelques instants.';
  emit();
}

function startWatch() {
  if (watchId != null || !navigator.geolocation) return;
  watchId = navigator.geolocation.watchPosition(onFix, onGeoError, {
    enableHighAccuracy: true, maximumAge: 5000, timeout: 60000
  });
  rt.watching = true;
  emit();
}

function stopWatch() {
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  rt.watching = false;
}

/** Position unique (pour préparer la sortie). */
export function getPosition({ timeout = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Géolocalisation non disponible sur cet appareil'));
    navigator.geolocation.getCurrentPosition(
      pos => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy), t: new Date().toISOString() };
        rt.current = { ...p, heading: null, speed: null };
        emit();
        resolve(p);
      },
      err => reject(new Error(err.code === 1
        ? 'Accès à la position refusé : autorisez la localisation dans les réglages.'
        : 'Position indisponible pour le moment. Réessayez à découvert.')),
      { enableHighAccuracy: true, timeout, maximumAge: 10000 }
    );
  });
}

async function readBattery() {
  try {
    if (!navigator.getBattery) return;
    const b = await navigator.getBattery();
    rt.battery = Math.round(b.level * 100);
  } catch { /* non pris en charge (iPhone, Firefox) */ }
}

// ---------------------------------------------------------------------------
// Écran allumé (Wake Lock)
// ---------------------------------------------------------------------------
export function wakeLockSupported() { return 'wakeLock' in navigator; }

export async function setKeepAwake(on) {
  wantAwake = on;
  if (on) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      rt.keepAwake = true;
      wakeLock.addEventListener('release', () => { rt.keepAwake = false; emit(); });
    } catch { rt.keepAwake = false; }
  } else {
    try { await wakeLock?.release(); } catch { /* déjà relâché */ }
    wakeLock = null;
    rt.keepAwake = false;
  }
  emit();
}

// ---------------------------------------------------------------------------
// Synchronisation serveur
// ---------------------------------------------------------------------------
function queuePatch(patch) {
  state.pendingPatch = { ...(state.pendingPatch || {}), ...patch };
}

function clearLocal(notice = null) {
  stopWatch();
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = null;
  if (wantAwake) setKeepAwake(false);
  state = null;
  rt.notice = notice;
  emit(true);
}

function isEndedError(e) { return /terminée|introuvable/i.test(e?.message || ''); }

export async function sync() {
  if (!state || rt.syncing) return;
  if (!navigator.onLine) { rt.online = false; emit(); return; }
  rt.syncing = true;
  emit();
  try {
    await readBattery();
    const s = state;
    // Terminée avant d'avoir jamais atteint le serveur : personne n'a été prévenu, rien à envoyer.
    if (!s.serverId && s.pendingEnd) {
      clearLocal('Sortie terminée.');
      return;
    }
    if (!s.serverId) {
      const o = await api('/outings', {
        method: 'POST',
        body: {
          client_id: s.clientId, started_at: s.startedAt,
          start: s.start, car: s.car, expected_return_at: s.expectedReturnAt,
          contact_ids: s.contactIds, share_live: s.shareLive, alert_on_silence: s.alertOnSilence
        }
      });
      s.serverId = o.id;
      s.followToken = o.follow_token;
      s.contacts = o.contacts || [];
      persist();
    }
    if (s.pendingPatch) {
      const patch = s.pendingPatch;
      await api(`/outings/${s.serverId}`, { method: 'PATCH', body: patch });
      if (s.pendingPatch === patch) s.pendingPatch = null;
      persist();
    }
    if (s.pendingSos) {
      await api(`/outings/${s.serverId}/sos`, { method: 'POST', body: s.pendingSos });
      s.pendingSos = null;
      s.sosSent = true;
      persist();
    }
    if (s.pendingSosCancel) {
      await api(`/outings/${s.serverId}/sos/cancel`, { method: 'POST' });
      s.pendingSosCancel = false;
      persist();
    }
    // Positions : transmises seulement si le partage est actif (ou SOS).
    if (s.shareLive) {
      while (s.sent < s.track.length) {
        const chunk = s.track.slice(s.sent, s.sent + CHUNK);
        await api(`/outings/${s.serverId}/points`, { method: 'POST', body: { points: chunk, battery: rt.battery } });
        s.sent += chunk.length;
        persist();
      }
    }
    if (s.pendingEnd) {
      await api(`/outings/${s.serverId}/end`, { method: 'POST' });
      clearLocal('Sortie terminée : vos proches ont été prévenus de votre retour.');
    }
    rt.lastSyncAt = new Date().toISOString();
    rt.lastError = null;
    rt.online = true;
  } catch (e) {
    if (state?.serverId && isEndedError(e)) {
      clearLocal('Cette sortie avait déjà été clôturée (autre appareil ou délai dépassé).');
    } else {
      rt.lastError = e.message;
    }
  } finally {
    rt.syncing = false;
    emit();
  }
}

function startSyncLoop() {
  if (syncTimer) return;
  syncTimer = setInterval(sync, SYNC_EVERY_MS);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
export function startOuting({ start, car, expectedReturnAt, contactIds = [], contacts = [], shareLive = true, alertOnSilence = true }) {
  state = {
    userId: currentUserId(),
    clientId: randomId(),
    serverId: null,
    followToken: null,
    startedAt: new Date().toISOString(),
    expectedReturnAt: expectedReturnAt || null,
    start: start ? { lat: start.lat, lng: start.lng, accuracy: start.accuracy } : null,
    car: car ? { lat: car.lat, lng: car.lng } : null,
    shareLive, alertOnSilence, contactIds, contacts,
    sosAt: null, pendingSos: null, pendingSosCancel: false, sosSent: false,
    track: start ? [{ lat: start.lat, lng: start.lng, accuracy: start.accuracy, t: new Date().toISOString() }] : [],
    sent: 0,
    pendingPatch: null,
    pendingEnd: false,
    endedLocal: false
  };
  rt.notice = null;
  emit(true);
  startWatch();
  startSyncLoop();
  return sync();
}

export function setCar(p) {
  if (!state) return;
  state.car = p ? { lat: p.lat, lng: p.lng } : null;
  queuePatch({ car: state.car });
  emit(true);
  sync();
}

export function setExpectedReturn(iso) {
  if (!state) return;
  state.expectedReturnAt = iso;
  queuePatch({ expected_return_at: iso });
  emit(true);
  sync();
}

export function setShareLive(on) {
  if (!state) return;
  state.shareLive = !!on;
  queuePatch({ share_live: !!on });
  emit(true);
  sync();
}

export function sos() {
  if (!state) return;
  const p = rt.current || state.track[state.track.length - 1] || state.start;
  state.sosAt = new Date().toISOString();
  state.shareLive = true; // le serveur active aussi le partage
  state.pendingSos = p ? { lat: p.lat, lng: p.lng, accuracy: p.accuracy } : {};
  state.pendingSosCancel = false;
  state.sosSent = false;
  emit(true);
  return sync();
}

export function cancelSos() {
  if (!state) return;
  state.sosAt = null;
  if (state.pendingSos) state.pendingSos = null; // jamais parti : rien à annuler côté serveur
  else state.pendingSosCancel = true;
  emit(true);
  return sync();
}

export function endOuting() {
  if (!state) return;
  state.endedLocal = true;
  state.pendingEnd = true;
  stopWatch();
  if (wantAwake) setKeepAwake(false);
  emit(true);
  return sync();
}

/** Arrête l'écoute GPS (déconnexion) sans effacer la sortie. */
export function suspendTracking() {
  stopWatch();
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = null;
  emit();
}

export function dismissNotice() { rt.notice = null; emit(); }

/** Au démarrage de l'appli / à la connexion : reprend la sortie en cours. */
export async function resumeOuting() {
  const uid = currentUserId();
  if (!uid) return;
  if (state && state.userId !== uid) return; // sortie d'un autre compte sur cet appareil : on n'y touche pas

  if (state) {
    if (!state.endedLocal) startWatch();
    startSyncLoop();
  }
  // Réconciliation avec le serveur (sortie démarrée ailleurs, clôturée, données effacées…)
  try {
    const o = await api('/outings/active', { silent401: true });
    if (!state && o) {
      state = {
        userId: uid, clientId: o.client_id, serverId: o.id, followToken: o.follow_token,
        startedAt: o.started_at, expectedReturnAt: o.expected_return_at,
        start: o.start_lat != null ? { lat: o.start_lat, lng: o.start_lng } : null,
        car: o.car_lat != null ? { lat: o.car_lat, lng: o.car_lng } : null,
        shareLive: !!o.share_live, alertOnSilence: !!o.alert_on_silence,
        contactIds: [], contacts: o.contacts || [],
        sosAt: o.sos_at, pendingSos: null, pendingSosCancel: false, sosSent: !!o.sos_at,
        track: [], sent: 0, pendingPatch: null, pendingEnd: false, endedLocal: false
      };
      emit(true);
      startWatch();
      startSyncLoop();
    } else if (state?.serverId && !state.pendingEnd && (!o || o.id !== state.serverId)) {
      clearLocal('Cette sortie avait déjà été clôturée (autre appareil ou délai dépassé).');
      return;
    }
  } catch { /* hors-ligne : on continue en local */ }
  if (state) sync();
}

// --- Événements globaux ---
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { rt.online = true; emit(); sync(); });
  window.addEventListener('offline', () => { rt.online = false; emit(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (wantAwake && !rt.keepAwake) setKeepAwake(true);
    if (state) sync();
  });
}
