import webpush from 'web-push';
import { getDb } from '../db.js';

/**
 * Notifications push Web (VAPID).
 *   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY : générées une fois avec
 *     npx web-push generate-vapid-keys
 *   VAPID_SUBJECT : mailto:contact@app-fair.fr (contact en cas d'abus)
 */

const configured = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (configured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:contact@app-fair.fr',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export function isPushConfigured() {
  return configured;
}

/** Envoie une notification à tous les appareils d'un utilisateur. Renvoie le nombre d'envois réussis. */
export async function sendPushToUser(userId, payload) {
  if (!configured) return 0;
  const db = await getDb();
  const subs = await db.all('SELECT * FROM push_subscriptions WHERE user_id = ?', userId);
  let ok = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 24 * 3600 }
      );
      ok++;
    } catch (e) {
      // 404/410 : l'abonnement n'existe plus (appli désinstallée, permission retirée)
      if (e.statusCode === 404 || e.statusCode === 410) {
        await db.run('DELETE FROM push_subscriptions WHERE id = ?', s.id);
      } else {
        console.warn(`[push] échec user ${userId} : ${e.statusCode || e.message}`);
      }
    }
  }
  return ok;
}
