import { getDb } from '../db.js';
import { sendMail, appUrl } from './mailer.js';
import { sendPushToUser } from './push.js';

/**
 * Sécurité en sortie (« Sortie ») :
 *   - les proches reçoivent un lien de suivi en direct au départ ;
 *   - veille serveur (indépendante du téléphone) : rappel à l'heure de retour,
 *     alerte aux proches si le retour est dépassé, ou si plus aucune position
 *     n'arrive depuis longtemps ;
 *   - purge des traces après OUTING_RETENTION_DAYS jours (RGPD).
 *
 * La veille est essentielle : une appli web ne peut pas garantir l'envoi de
 * positions écran éteint. C'est le serveur qui donne l'alerte, pas le téléphone.
 */

const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : d);
export const GRACE_MIN = () => num(process.env.OUTING_GRACE_MIN, 30);
export const SILENCE_MIN = () => num(process.env.OUTING_SILENCE_MIN, 60);
const EXPIRE_HOURS = () => num(process.env.OUTING_EXPIRE_HOURS, 24);
const RETENTION_DAYS = () => num(process.env.OUTING_RETENTION_DAYS, 30);
const FOLLOW_TTL_HOURS = () => num(process.env.OUTING_FOLLOW_TTL_HOURS, 24);

export const nowIso = () => new Date().toISOString();
const minutesAgoIso = m => new Date(Date.now() - m * 60000).toISOString();

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function displayName(user) {
  return (user?.name || user?.email?.split('@')[0] || 'Un utilisateur de Myco').trim();
}

export function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris', weekday: 'long', hour: '2-digit', minute: '2-digit'
  });
}

export function followUrl(outing) {
  return `${appUrl()}/suivi/${outing.follow_token}`;
}

function mapsUrl(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

function lastKnown(o) {
  if (o.last_lat != null) return { lat: o.last_lat, lng: o.last_lng, at: o.last_at };
  if (o.start_lat != null) return { lat: o.start_lat, lng: o.start_lng, at: o.started_at };
  return null;
}

function mailLayout(title, color, bodyHtml) {
  return `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;color:#1c1917">
      <h2 style="color:${color};margin-bottom:8px">${title}</h2>
      ${bodyHtml}
      <p style="color:#78716c;font-size:12px;margin-top:24px">
        Message envoyé par Myco (myco.app-fair.fr) car vous avez été désigné(e) comme proche à prévenir.
        Le lien de suivi expire ${FOLLOW_TTL_HOURS()} h après la fin de la sortie.
      </p>
    </div>`;
}

function button(href, label, color = '#16a34a') {
  return `<p><a href="${href}" style="display:inline-block;background:${color};color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${label}</a></p>`;
}

function positionBlock(o) {
  const p = lastKnown(o);
  if (!p) return { html: '<p>Aucune position n’a encore été reçue.</p>', text: 'Aucune position reçue.' };
  const when = fmtTime(p.at);
  const coords = `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
  const car = o.car_lat != null ? `\nVéhicule garé : ${o.car_lat.toFixed(5)}, ${o.car_lng.toFixed(5)} (${mapsUrl(o.car_lat, o.car_lng)})` : '';
  return {
    text: `Dernière position connue (${when}) : ${coords}\n${mapsUrl(p.lat, p.lng)}${car}`,
    html: `<p><strong>Dernière position connue</strong> (${esc(when)}) :<br>
             <a href="${mapsUrl(p.lat, p.lng)}">${coords}</a></p>
           ${o.car_lat != null ? `<p><strong>Véhicule garé</strong> : <a href="${mapsUrl(o.car_lat, o.car_lng)}">${o.car_lat.toFixed(5)}, ${o.car_lng.toFixed(5)}</a></p>` : ''}`
  };
}

async function contactsOf(outingId) {
  const db = await getDb();
  return db.all('SELECT name, email FROM outing_contacts WHERE outing_id = ?', outingId);
}

/** E-mail à chaque proche + notification push si le proche a lui-même un compte Myco. */
async function sendToContacts(outing, { subject, text, html, push }) {
  const db = await getDb();
  const contacts = await contactsOf(outing.id);
  let sent = 0;
  for (const c of contacts) {
    try { await sendMail({ to: c.email, subject, text, html }); sent++; }
    catch (e) { console.warn(`[outings] e-mail à ${c.email} : ${e.message}`); }
    if (push) {
      const u = await db.get('SELECT id FROM users WHERE LOWER(email) = ?', c.email.toLowerCase());
      if (u) await sendPushToUser(u.id, push).catch(() => {});
    }
  }
  return sent;
}

async function ownerOf(outing) {
  const db = await getDb();
  return db.get('SELECT id, email, name, email_verified FROM users WHERE id = ?', outing.user_id);
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function notifyStart(outing) {
  const user = await ownerOf(outing);
  const who = displayName(user);
  const link = followUrl(outing);
  const ret = outing.expected_return_at ? fmtTime(outing.expected_return_at) : null;
  const text = `${who} part en cueillette avec Myco et vous a désigné(e) comme proche à prévenir.\n\n` +
    `Suivre sa position en direct : ${link}\n` +
    (ret ? `Retour prévu : ${ret}. Si ${who} n'a pas signalé son retour ${GRACE_MIN()} min après, vous recevrez une alerte.\n` : '') +
    `\nAucune action n'est nécessaire pour l'instant.`;
  const html = mailLayout(`🍄 ${esc(who)} part en cueillette`, '#16a34a', `
    <p>${esc(who)} vous a désigné(e) comme proche à prévenir pendant sa sortie.</p>
    ${button(link, 'Suivre sa position en direct')}
    ${ret ? `<p>Retour prévu : <strong>${esc(ret)}</strong>. S’il ou elle n’a pas signalé son retour ${GRACE_MIN()} min après, vous recevrez une alerte.</p>` : ''}
    <p style="color:#57534e">Aucune action n’est nécessaire pour l’instant.</p>`);
  return sendToContacts(outing, { subject: `${who} part en cueillette — lien de suivi`, text, html });
}

export async function notifySos(outing) {
  const user = await ownerOf(outing);
  const who = displayName(user);
  const pos = positionBlock(outing);
  const link = followUrl(outing);
  const text = `ALERTE : ${who} a déclenché un appel à l'aide depuis Myco.\n\n${pos.text}\n\nSuivi en direct : ${link}\n\n` +
    `Essayez de l'appeler. Sans réponse, appelez le 112 et communiquez la position ci-dessus.`;
  const html = mailLayout(`🆘 ${esc(who)} demande de l’aide`, '#b91c1c', `
    <p><strong>${esc(who)} a déclenché un appel à l’aide depuis Myco.</strong></p>
    ${pos.html}
    ${button(link, 'Voir sa position en direct', '#b91c1c')}
    <p>Essayez de l’appeler. Sans réponse, <strong>appelez le 112</strong> et communiquez la position ci-dessus.</p>`);
  return sendToContacts(outing, {
    subject: `🆘 ${who} demande de l'aide — Myco`, text, html,
    push: { title: `🆘 ${who} demande de l'aide`, body: 'Ouvrez pour voir sa position', url: `/suivi/${outing.follow_token}`, tag: `sos-${outing.id}` }
  });
}

export async function notifyEnd(outing) {
  const user = await ownerOf(outing);
  const who = displayName(user);
  const text = `${who} a terminé sa sortie et signale être bien rentré(e). Le suivi est arrêté.`;
  const html = mailLayout(`✅ ${esc(who)} est bien rentré(e)`, '#16a34a',
    `<p>${esc(who)} a terminé sa sortie. Le suivi de position est arrêté.</p>`);
  return sendToContacts(outing, { subject: `${who} est bien rentré(e) — Myco`, text, html });
}

async function notifyOverdue(outing) {
  const user = await ownerOf(outing);
  const who = displayName(user);
  const pos = positionBlock(outing);
  const link = followUrl(outing);
  const text = `${who} devait rentrer de sa cueillette vers ${fmtTime(outing.expected_return_at)} et n'a pas signalé son retour.\n\n` +
    `${pos.text}\n\nSuivi : ${link}\n\nCe n'est peut-être qu'un oubli : essayez d'abord de l'appeler. ` +
    `Sans nouvelles, appelez le 112 et communiquez la position ci-dessus.`;
  const html = mailLayout(`⚠️ ${esc(who)} n’a pas signalé son retour`, '#ca8a04', `
    <p>${esc(who)} devait rentrer vers <strong>${esc(fmtTime(outing.expected_return_at))}</strong> et n’a pas encore terminé sa sortie dans Myco.</p>
    ${pos.html}
    ${button(link, 'Voir sa position', '#ca8a04')}
    <p>Ce n’est peut-être qu’un oubli : essayez d’abord de l’appeler. Sans nouvelles, <strong>appelez le 112</strong> et communiquez la position ci-dessus.</p>`);
  return sendToContacts(outing, {
    subject: `⚠️ ${who} n'a pas signalé son retour — Myco`, text, html,
    push: { title: `⚠️ ${who} n'est pas rentré(e)`, body: 'Retour prévu dépassé', url: `/suivi/${outing.follow_token}`, tag: `overdue-${outing.id}` }
  });
}

async function notifySilence(outing) {
  const user = await ownerOf(outing);
  const who = displayName(user);
  const pos = positionBlock(outing);
  const link = followUrl(outing);
  const text = `Myco ne reçoit plus la position de ${who} depuis plus de ${SILENCE_MIN()} minutes.\n\n` +
    `C'est fréquent en forêt (pas de réseau) ou si l'écran du téléphone est éteint : pas d'inquiétude à ce stade.\n\n${pos.text}\n\nSuivi : ${link}`;
  const html = mailLayout(`📡 Plus de position de ${esc(who)}`, '#0284c7', `
    <p>Myco ne reçoit plus la position de ${esc(who)} depuis plus de ${SILENCE_MIN()} minutes.</p>
    <p style="color:#57534e">C’est fréquent en forêt (pas de réseau) ou écran éteint : pas d’inquiétude à ce stade. Vous serez prévenu(e) quand le signal reviendra, et alerté(e) si l’heure de retour est dépassée.</p>
    ${pos.html}
    ${button(link, 'Voir le suivi', '#0284c7')}`);
  return sendToContacts(outing, { subject: `Plus de position de ${who} depuis ${SILENCE_MIN()} min — Myco`, text, html });
}

export async function notifySignalBack(outing) {
  const user = await ownerOf(outing);
  const who = displayName(user);
  const link = followUrl(outing);
  const text = `Bonne nouvelle : Myco reçoit à nouveau la position de ${who}.\n\nSuivi : ${link}`;
  const html = mailLayout(`📍 Signal retrouvé pour ${esc(who)}`, '#16a34a',
    `<p>Myco reçoit à nouveau la position de ${esc(who)}.</p>${button(link, 'Voir le suivi')}`);
  return sendToContacts(outing, { subject: `Signal retrouvé pour ${who} — Myco`, text, html });
}

async function remindOwner(outing) {
  const user = await ownerOf(outing);
  const msg = `Heure de retour dépassée. Terminez ou prolongez votre sortie, sinon vos proches seront prévenus dans ${GRACE_MIN()} min.`;
  await sendPushToUser(user.id, { title: 'Êtes-vous bien rentré(e) ?', body: msg, url: '/sortie', tag: `remind-${outing.id}` }).catch(() => {});
  if (user.email_verified) {
    const link = `${appUrl()}/sortie`;
    await sendMail({
      to: user.email,
      subject: 'Êtes-vous bien rentré(e) ? — Myco',
      text: `${msg}\n\n${link}`,
      html: mailLayout('Êtes-vous bien rentré(e) ?', '#ca8a04', `<p>${esc(msg)}</p>${button(link, 'Ouvrir ma sortie', '#ca8a04')}`)
    }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Veille périodique
// ---------------------------------------------------------------------------

export async function checkOutings({ log = false } = {}) {
  const db = await getDb();
  const now = nowIso();
  const stats = { reminded: 0, overdue: 0, silence: 0, expired: 0, purged: 0 };

  // 1. Rappel au cueilleur à l'heure de retour prévue
  for (const o of await db.all(
    `SELECT * FROM outings WHERE status = 'active' AND expected_return_at IS NOT NULL
       AND expected_return_at <= ? AND reminder_sent_at IS NULL`, now)) {
    await db.run('UPDATE outings SET reminder_sent_at = ? WHERE id = ?', now, o.id);
    await remindOwner(o);
    stats.reminded++;
  }

  // 2. Retour dépassé + délai de grâce → alerte aux proches (une fois)
  for (const o of await db.all(
    `SELECT * FROM outings WHERE status = 'active' AND expected_return_at IS NOT NULL
       AND expected_return_at <= ? AND overdue_notified_at IS NULL`, minutesAgoIso(GRACE_MIN()))) {
    await db.run('UPDATE outings SET overdue_notified_at = ? WHERE id = ?', now, o.id);
    await notifyOverdue(o);
    stats.overdue++;
  }

  // 3. Silence prolongé (plus aucune position) → information aux proches (une fois)
  for (const o of await db.all(
    `SELECT * FROM outings WHERE status = 'active' AND share_live = 1 AND alert_on_silence = 1
       AND silence_notified_at IS NULL AND overdue_notified_at IS NULL AND sos_at IS NULL
       AND COALESCE(last_at, started_at) <= ?`, minutesAgoIso(SILENCE_MIN()))) {
    await db.run('UPDATE outings SET silence_notified_at = ? WHERE id = ?', now, o.id);
    await notifySilence(o);
    stats.silence++;
  }

  // 4. Sorties oubliées : clôturées EXPIRE_HOURS après l'heure de retour
  //    (ou 12 h après le départ si aucune heure de retour n'a été donnée).
  const cutoff = new Date(Date.now() - EXPIRE_HOURS() * 3600e3).toISOString();
  const cutoffNoReturn = new Date(Date.now() - (12 + EXPIRE_HOURS()) * 3600e3).toISOString();
  const r = await db.run(
    `UPDATE outings SET status = 'expired', ended_at = ?
     WHERE status = 'active' AND (
       (expected_return_at IS NOT NULL AND expected_return_at <= ?) OR
       (expected_return_at IS NULL AND started_at <= ?))`, now, cutoff, cutoffNoReturn);
  stats.expired = r.changes || 0;

  // 5. Purge des traces anciennes (le résumé de la sortie est conservé)
  const purgeBefore = new Date(Date.now() - RETENTION_DAYS() * 86400e3).toISOString();
  const p = await db.run(
    `DELETE FROM outing_points WHERE outing_id IN
       (SELECT id FROM outings WHERE status != 'active' AND ended_at <= ?)`, purgeBefore);
  stats.purged = p.changes || 0;

  if (log && Object.values(stats).some(Boolean)) console.log('[outings]', stats);
  return stats;
}

let timer = null;
export function startOutingWatchdog() {
  if (timer || process.env.OUTING_WATCHDOG === 'off') return;
  const every = num(process.env.OUTING_WATCHDOG_SECONDS, 120) * 1000;
  const run = () => checkOutings({ log: true }).catch(e => console.error('[outings] veille :', e.message));
  timer = setInterval(run, every);
  timer.unref?.();
  setTimeout(run, 5000).unref?.();
  console.log(`🛟 Veille des sorties active (toutes les ${every / 1000} s)`);
}

// ---------------------------------------------------------------------------
// Vue publique (proches)
// ---------------------------------------------------------------------------

/** Réduit une trace à n points max (garde le premier et le dernier). */
export function decimate(points, max = 600) {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const out = [];
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)]);
  return out;
}

export function followExpired(o) {
  if (o.status === 'active') return false;
  const end = new Date(o.ended_at || o.started_at).getTime();
  return Date.now() - end > FOLLOW_TTL_HOURS() * 3600e3;
}

export function isOverdue(o) {
  return o.status === 'active' && o.expected_return_at && new Date(o.expected_return_at) < new Date();
}

export async function notifyExtended(outing) {
  const user = await ownerOf(outing);
  const who = displayName(user);
  const ret = fmtTime(outing.expected_return_at);
  const link = followUrl(outing);
  const text = `${who} a donné de ses nouvelles et prolonge sa sortie. Nouveau retour prévu : ${ret}.\n\nSuivi : ${link}`;
  const html = mailLayout(`👍 ${esc(who)} a donné de ses nouvelles`, '#16a34a',
    `<p>${esc(who)} prolonge sa sortie. Nouveau retour prévu : <strong>${esc(ret)}</strong>.</p>${button(link, 'Voir le suivi')}`);
  return sendToContacts(outing, { subject: `${who} a donné de ses nouvelles — Myco`, text, html });
}

export async function notifySosCancel(outing) {
  const user = await ownerOf(outing);
  const who = displayName(user);
  const text = `${who} a annulé son appel à l'aide : tout va bien.`;
  const html = mailLayout(`✅ Fausse alerte`, '#16a34a', `<p>${esc(who)} a annulé son appel à l’aide : tout va bien.</p>`);
  return sendToContacts(outing, {
    subject: `Fausse alerte : ${who} va bien — Myco`, text, html,
    push: { title: `${who} va bien`, body: 'Appel à l’aide annulé', url: `/suivi/${outing.follow_token}`, tag: `sos-${outing.id}` }
  });
}
