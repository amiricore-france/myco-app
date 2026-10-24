import { getDb } from '../db.js';
import { sendPushToUser } from './push.js';

/**
 * Signalements de zones de danger.
 *   - Un signalement est ACTIF le jour même (heure de Paris), sauf si son auteur
 *     le déclare terminé ou s'il est masqué par la modération.
 *   - Il reste ensuite visible en HISTORIQUE pendant DANGER_RETENTION_DAYS jours
 *     (365 par défaut), puis il est supprimé.
 *   - L'auteur n'est jamais affiché aux autres utilisateurs.
 */

export const DANGER_TYPES = {
  chasse:      { label: 'Partie de chasse' },
  travaux:     { label: 'Travaux forestiers' },
  promeneurs:  { label: 'Promeneurs nombreux' },
  suspect:     { label: 'Comportement suspect' },
  animaux:     { label: 'Animaux errants' },
  autre:       { label: 'Autre danger' }
};

export const ALERT_RADIUS_M = 1000;
const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : d);
export const RETENTION_DAYS = () => num(process.env.DANGER_RETENTION_DAYS, 365);
export const ABUSE_HIDE_THRESHOLD = () => num(process.env.DANGER_ABUSE_THRESHOLD, 3);
const MAX_PUSH_PER_USER_PER_DAY = () => num(process.env.DANGER_PUSH_MAX_PER_DAY, 5);

/** Date du jour à Paris, au format AAAA-MM-JJ (le « jour même » des signalements). */
export function parisDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(date);
}

/** Décale un jour AAAA-MM-JJ de n jours (n négatif = passé). */
export function shiftDay(day, n) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function distanceM(a, b) {
  const R = 6371000, rad = x => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const fmtDistance = m => (m < 100 ? 'moins de 100 m' : `${Math.round(m / 50) * 50} m`);

/**
 * Prévient (notification push) les utilisateurs qui ont un coin à moins d'1 km
 * du signalement. Ils doivent avoir activé les notifications sur un appareil
 * et laissé l'option « dangers près de mes coins » active. Plafond quotidien
 * par destinataire, pour qu'un signaleur malveillant ne puisse pas les inonder.
 */
export async function notifyNearbySpotOwners(report) {
  const db = await getDb();
  const dLat = ALERT_RADIUS_M / 111320;
  const dLng = ALERT_RADIUS_M / (111320 * Math.cos((report.lat * Math.PI) / 180));
  const rows = await db.all(
    `SELECT s.user_id, s.name, s.lat, s.lng FROM spots s
       JOIN users u ON u.id = s.user_id
      WHERE s.lat BETWEEN ? AND ? AND s.lng BETWEEN ? AND ?
        AND u.danger_push = 1 AND u.alert_push = 1
        AND (? IS NULL OR s.user_id != ?)`,
    report.lat - dLat, report.lat + dLat, report.lng - dLng, report.lng + dLng,
    report.user_id, report.user_id
  );

  // Coin le plus proche pour chaque utilisateur
  const best = new Map();
  for (const s of rows) {
    const d = distanceM(report, s);
    if (d > ALERT_RADIUS_M) continue;
    const cur = best.get(s.user_id);
    if (!cur || d < cur.d) best.set(s.user_id, { name: s.name, d });
  }

  const label = DANGER_TYPES[report.type]?.label || 'Danger';
  const since = new Date(Date.now() - 24 * 3600e3).toISOString();
  let sent = 0;
  for (const [userId, spot] of best) {
    const count = await db.get(
      'SELECT COUNT(*) AS n FROM danger_push_log WHERE user_id = ? AND sent_at > ?', userId, since
    );
    if (count.n >= MAX_PUSH_PER_USER_PER_DAY()) continue;
    const ok = await sendPushToUser(userId, {
      title: `⚠️ ${label} signalé près de « ${spot.name} »`,
      body: `Aujourd’hui, à ${fmtDistance(spot.d)} de votre coin.${report.comment ? ` « ${report.comment.slice(0, 80)} »` : ''}`,
      url: `/?danger=${report.id}`,
      tag: `myco-danger-${report.id}`
    });
    if (ok) {
      await db.run('INSERT OR IGNORE INTO danger_push_log (user_id, report_id, sent_at) VALUES (?, ?, ?)',
        userId, report.id, new Date().toISOString());
      sent++;
    }
  }
  return sent;
}

/** Supprime l'historique au-delà de la durée de conservation. */
export async function purgeDangerReports() {
  const db = await getDb();
  const limit = shiftDay(parisDay(), -RETENTION_DAYS());
  const r = await db.run('DELETE FROM danger_reports WHERE day < ?', limit);
  await db.run(`DELETE FROM danger_push_log WHERE sent_at < ?`, new Date(Date.now() - 7 * 86400e3).toISOString());
  return r.changes || 0;
}
