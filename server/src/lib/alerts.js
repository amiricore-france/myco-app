import { getDb } from '../db.js';
import { cellOf, getWeatherForSpots } from './weather.js';
import { computeFlushScore, alertThreshold } from './flush.js';
import { premiumSqlCondition } from './premium.js';
import { sendMail, appUrl } from './mailer.js';
import { sendPushToUser } from './push.js';

const MAX_SPOTS = 300;
const COOLDOWN_DAYS = Number(process.env.FLUSH_ALERT_COOLDOWN_DAYS || 7);

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/** Indice de poussée de chaque coin de l'utilisateur, trié du plus favorable au moins favorable. */
export async function forecastForUser(userId) {
  const db = await getDb();
  const spots = await db.all(
    'SELECT id, name, lat, lng FROM spots WHERE user_id = ? ORDER BY id DESC LIMIT ?',
    userId, MAX_SPOTS
  );
  const weather = await getWeatherForSpots(spots);
  return spots.map(s => {
    const w = weather.get(cellOf(s.lat, s.lng));
    return w
      ? { spot_id: s.id, name: s.name, lat: s.lat, lng: s.lng, ...computeFlushScore(w) }
      : { spot_id: s.id, name: s.name, lat: s.lat, lng: s.lng, score: null, level: 'inconnu', reasons: ['météo indisponible'] };
  }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

/** Envoie le récapitulatif d'alertes (e-mail et/ou push) à un utilisateur. */
export async function notifyUser(user, hits, { test = false } = {}) {
  const list = hits.slice(0, 10);
  const title = test
    ? 'Myco — alerte de test'
    : list.length === 1
      ? `Conditions ${list[0].level}s sur « ${list[0].name} »`
      : `Conditions favorables sur ${list.length} de vos coins`;
  const url = `${appUrl()}/dashboard`;
  let channels = 0;

  if (user.alert_email && user.email_verified) {
    const lines = list.map(h => `• ${h.name} : ${h.level} (${h.score}/100) — ${h.reasons.slice(0, 2).join(', ')}`);
    const text = `${title}\n\n${lines.join('\n')}\n\nVoir le détail : ${url}\n\n` +
      `Indication fondée sur la météo uniquement, sans garantie de poussée. ` +
      `Ne consommez jamais un champignon sans identification certaine par un pharmacien ou un mycologue.\n\n` +
      `Gérer les alertes : ${appUrl()}/profile#alertes`;
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto">
        <h2 style="color:#16a34a">🍄 ${esc(title)}</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          ${list.map(h => `
            <tr style="border-bottom:1px solid #e7e5e4">
              <td style="padding:8px 0"><strong>${esc(h.name)}</strong><br>
                <span style="color:#78716c">${esc(h.reasons.slice(0, 2).join(', '))}</span></td>
              <td style="padding:8px 0;text-align:right;white-space:nowrap">
                <strong style="color:#15803d">${h.score}/100</strong><br>
                <span style="color:#78716c">${esc(h.level)}</span></td>
            </tr>`).join('')}
        </table>
        <p><a href="${url}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Voir mes coins</a></p>
        <p style="color:#78716c;font-size:12px">Indication fondée sur la météo uniquement, sans garantie de poussée.
          Ne consommez jamais un champignon sans identification certaine par un pharmacien ou un mycologue.<br>
          <a href="${appUrl()}/profile#alertes" style="color:#78716c">Gérer mes alertes</a></p>
      </div>`;
    try { await sendMail({ to: user.email, subject: title, html, text }); channels++; }
    catch (e) { console.warn(`[alerts] e-mail ${user.id} : ${e.message}`); }
  }

  if (user.alert_push) {
    const body = list.map(h => `${h.name} : ${h.score}/100`).join(' · ');
    const sent = await sendPushToUser(user.id, { title, body, url: '/dashboard', tag: 'myco-poussee' });
    if (sent) channels++;
  }
  return channels;
}

/** Traitement quotidien : à lancer par le timer systemd (voir jobs/flush-alerts.js). */
export async function runDailyAlerts({ dryRun = false } = {}) {
  const db = await getDb();
  const threshold = alertThreshold();
  const users = await db.all(
    `SELECT u.id, u.email, u.email_verified, u.alert_email, u.alert_push FROM users u
     WHERE ${premiumSqlCondition()} AND (u.alert_email = 1 OR u.alert_push = 1)`
  );
  let notified = 0;
  for (const user of users) {
    const forecast = await forecastForUser(user.id);
    const hits = [];
    for (const f of forecast) {
      if (f.score == null || f.score < threshold) continue;
      const recent = await db.get(
        `SELECT 1 FROM flush_alerts WHERE user_id = ? AND spot_id = ? AND sent_at > datetime('now', ?)`,
        user.id, f.spot_id, `-${COOLDOWN_DAYS} days`
      );
      if (!recent) hits.push(f);
    }
    if (!hits.length) continue;
    console.log(`[alerts] user ${user.id} : ${hits.length} coin(s) au-dessus de ${threshold}`);
    if (dryRun) continue;
    const channels = await notifyUser(user, hits);
    if (channels > 0) {
      for (const h of hits) {
        await db.run('INSERT INTO flush_alerts (user_id, spot_id, score) VALUES (?, ?, ?)', user.id, h.spot_id, h.score);
      }
      notified++;
    }
  }
  return { users: users.length, notified };
}
