import { api } from '../api.js';

/** Notifications push des alertes de poussée (navigateur ou PWA installée). */

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Sur iPhone/iPad, le push n'existe que dans l'app installée sur l'écran d'accueil. */
export function needsInstallForPush() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
  return ios && !standalone;
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function enablePush() {
  if (!pushSupported()) throw new Error('Notifications non prises en charge par ce navigateur');
  const { key } = await api('/alerts/push/public-key');
  if (!key) throw new Error('Notifications pas encore configurées sur le serveur');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Autorisation refusée : réactivez les notifications dans les réglages du navigateur');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
  await api('/alerts/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } });
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (sub) {
    await api('/alerts/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  } else {
    await api('/alerts/push/unsubscribe', { method: 'POST', body: {} }).catch(() => {});
  }
}
