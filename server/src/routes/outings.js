import { Router } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { getDb } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { isMailerConfigured } from '../lib/mailer.js';
import {
  nowIso, displayName, decimate, followExpired, isOverdue,
  notifyStart, notifySos, notifySosCancel, notifyEnd, notifyExtended, notifySignalBack
} from '../lib/outings.js';

const router = Router();

const MAX_CONTACTS = 5;
const MAX_OUTINGS_PER_DAY = 10;
const MAX_POINTS_PER_CALL = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --- Validation ---
function coord(o) {
  if (!o || typeof o !== 'object') return null;
  const lat = Number(o.lat), lng = Number(o.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng, accuracy: Number.isFinite(Number(o.accuracy)) ? Math.round(Number(o.accuracy)) : null };
}
function isoOrNull(v, { minMs = -Infinity, maxMs = Infinity } = {}) {
  if (!v) return null;
  const t = new Date(v).getTime();
  if (!Number.isFinite(t) || t < minMs || t > maxMs) return undefined; // undefined = invalide
  return new Date(t).toISOString();
}
const DAY = 86400e3;

async function ownOuting(req, res) {
  const db = await getDb();
  const o = await db.get('SELECT * FROM outings WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  if (!o) { res.status(404).json({ error: 'Sortie introuvable' }); return null; }
  return o;
}

async function withDetails(o) {
  const db = await getDb();
  const contacts = await db.all('SELECT name, email FROM outing_contacts WHERE outing_id = ?', o.id);
  return { ...o, contacts };
}

// ---------------------------------------------------------------------------
// Vue publique pour les proches (sans compte) — lien non devinable
// ---------------------------------------------------------------------------
const followLimiter = rateLimit({ windowMs: 60e3, max: 30, standardHeaders: true, legacyHeaders: false });

router.get('/follow/:token', followLimiter, async (req, res) => {
  const token = String(req.params.token || '');
  if (!/^[a-f0-9]{32}$/.test(token)) return res.status(404).json({ error: 'Lien de suivi invalide' });
  const db = await getDb();
  const o = await db.get('SELECT * FROM outings WHERE follow_token = ?', token);
  if (!o) return res.status(404).json({ error: 'Lien de suivi invalide' });
  if (followExpired(o)) return res.status(410).json({ error: 'Ce suivi est terminé et le lien a expiré.' });

  const user = await db.get('SELECT name, email FROM users WHERE id = ?', o.user_id);
  const visible = !!o.share_live;
  const points = visible
    ? decimate(await db.all(
        'SELECT lat, lng, recorded_at AS t FROM outing_points WHERE outing_id = ? ORDER BY recorded_at', o.id))
    : [];

  res.set('Cache-Control', 'no-store');
  res.json({
    name: displayName(user),
    status: o.status,
    started_at: o.started_at,
    expected_return_at: o.expected_return_at,
    ended_at: o.ended_at,
    overdue: !!isOverdue(o),
    sos_at: o.sos_at,
    share_live: visible,
    start: o.start_lat != null ? { lat: o.start_lat, lng: o.start_lng } : null,
    car: o.car_lat != null ? { lat: o.car_lat, lng: o.car_lng } : null,
    last: visible && o.last_lat != null
      ? { lat: o.last_lat, lng: o.last_lng, accuracy: o.last_accuracy, at: o.last_at }
      : null,
    battery: visible ? o.battery : null,
    points,
    server_time: nowIso()
  });
});

// Tout le reste nécessite d'être connecté
router.use(authRequired);

// ---------------------------------------------------------------------------
// Proches à prévenir
// ---------------------------------------------------------------------------
router.get('/contacts', async (req, res) => {
  const db = await getDb();
  res.json(await db.all('SELECT id, name, email FROM emergency_contacts WHERE user_id = ? ORDER BY name', req.user.id));
});

router.post('/contacts', async (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 80);
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!name) return res.status(400).json({ error: 'Indiquez un prénom ou un nom.' });
  if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: 'Adresse e-mail invalide.' });

  const db = await getDb();
  const me = await db.get('SELECT email, email_verified FROM users WHERE id = ?', req.user.id);
  // Anti-abus : on n'envoie des e-mails à des tiers qu'au nom d'un compte vérifié.
  if (isMailerConfigured() && !me.email_verified) {
    return res.status(403).json({ error: 'Confirmez d’abord votre adresse e-mail (page Mon compte) pour ajouter des proches.' });
  }
  if (email === me.email.toLowerCase()) return res.status(400).json({ error: 'Indiquez l’adresse d’un proche, pas la vôtre.' });
  const { n } = await db.get('SELECT COUNT(*) AS n FROM emergency_contacts WHERE user_id = ?', req.user.id);
  if (n >= MAX_CONTACTS) return res.status(400).json({ error: `${MAX_CONTACTS} proches maximum.` });

  try {
    const r = await db.run('INSERT INTO emergency_contacts (user_id, name, email) VALUES (?, ?, ?)', req.user.id, name, email);
    res.json({ id: r.lastID, name, email });
  } catch {
    res.status(409).json({ error: 'Ce proche est déjà dans votre liste.' });
  }
});

router.delete('/contacts/:id', async (req, res) => {
  const db = await getDb();
  await db.run('DELETE FROM emergency_contacts WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Sorties
// ---------------------------------------------------------------------------
router.get('/active', async (req, res) => {
  const db = await getDb();
  const o = await db.get(
    `SELECT * FROM outings WHERE user_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1`, req.user.id);
  res.json(o ? await withDetails(o) : null);
});

// Démarrer (idempotent sur client_id : le téléphone peut renvoyer la même
// sortie créée hors-ligne autant de fois que nécessaire).
router.post('/', async (req, res) => {
  const b = req.body || {};
  const clientId = String(b.client_id || '');
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(clientId)) return res.status(400).json({ error: 'client_id invalide' });

  const db = await getDb();
  const existing = await db.get('SELECT * FROM outings WHERE user_id = ? AND client_id = ?', req.user.id, clientId);
  if (existing) return res.json(await withDetails(existing));

  const now = Date.now();
  const startedAt = isoOrNull(b.started_at, { minMs: now - DAY, maxMs: now + 5 * 60e3 }) || nowIso();
  const expected = isoOrNull(b.expected_return_at, { minMs: now - DAY, maxMs: now + 2 * DAY });
  if (expected === undefined) return res.status(400).json({ error: 'Heure de retour invalide (48 h maximum).' });
  const start = coord(b.start);
  const car = coord(b.car);

  const { n } = await db.get(
    `SELECT COUNT(*) AS n FROM outings WHERE user_id = ? AND created_at >= datetime('now', '-1 day')`, req.user.id);
  if (n >= MAX_OUTINGS_PER_DAY) return res.status(429).json({ error: 'Trop de sorties démarrées aujourd’hui.' });

  // Une seule sortie active à la fois : on clôt silencieusement les précédentes.
  await db.run(
    `UPDATE outings SET status = 'ended', ended_at = ? WHERE user_id = ? AND status = 'active'`, nowIso(), req.user.id);

  const token = crypto.randomBytes(16).toString('hex');
  const r = await db.run(
    `INSERT INTO outings (user_id, client_id, follow_token, status, share_live, alert_on_silence,
                          started_at, expected_return_at, start_lat, start_lng, car_lat, car_lng,
                          last_lat, last_lng, last_accuracy, last_at)
     VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    req.user.id, clientId, token, b.share_live === false ? 0 : 1, b.alert_on_silence === false ? 0 : 1,
    startedAt, expected, start?.lat ?? null, start?.lng ?? null, car?.lat ?? null, car?.lng ?? null,
    start?.lat ?? null, start?.lng ?? null, start?.accuracy ?? null, start ? startedAt : null
  );
  const id = r.lastID;

  // Proches choisis (copie figée : supprimer un proche plus tard n'altère pas la sortie)
  const ids = Array.isArray(b.contact_ids) ? b.contact_ids.map(Number).filter(Number.isInteger).slice(0, MAX_CONTACTS) : [];
  if (ids.length) {
    const rows = await db.all(
      `SELECT name, email FROM emergency_contacts WHERE user_id = ? AND id IN (${ids.map(() => '?').join(',')})`,
      req.user.id, ...ids);
    for (const c of rows) {
      await db.run('INSERT OR IGNORE INTO outing_contacts (outing_id, name, email) VALUES (?, ?, ?)', id, c.name, c.email);
    }
  }

  const outing = await db.get('SELECT * FROM outings WHERE id = ?', id);
  const details = await withDetails(outing);
  if (details.contacts.length) notifyStart(outing).catch(e => console.warn('[outings] départ :', e.message));
  res.json(details);
});

// Envoi d'un lot de positions (trace) — appelé régulièrement par le téléphone
router.post('/:id/points', async (req, res) => {
  const o = await ownOuting(req, res); if (!o) return;
  if (o.status !== 'active') return res.status(409).json({ error: 'Sortie terminée', status: o.status });

  const raw = Array.isArray(req.body?.points) ? req.body.points.slice(0, MAX_POINTS_PER_CALL) : [];
  const now = Date.now();
  const pts = [];
  for (const p of raw) {
    const c = coord(p);
    const t = isoOrNull(p?.t, { minMs: now - 2 * DAY, maxMs: now + 5 * 60e3 });
    if (c && t) pts.push({ ...c, t });
  }
  const db = await getDb();
  for (const p of pts) {
    await db.run('INSERT OR IGNORE INTO outing_points (outing_id, lat, lng, accuracy, recorded_at) VALUES (?, ?, ?, ?, ?)',
      o.id, p.lat, p.lng, p.accuracy, p.t);
  }
  const battery = Number.isInteger(req.body?.battery) && req.body.battery >= 0 && req.body.battery <= 100 ? req.body.battery : null;

  // Dernière position = la plus récente reçue (les lots hors-ligne peuvent arriver en retard)
  const newest = pts.reduce((a, p) => (!a || p.t > a.t ? p : a), null);
  if (newest && (!o.last_at || newest.t >= o.last_at)) {
    await db.run(
      `UPDATE outings SET last_lat = ?, last_lng = ?, last_accuracy = ?, last_at = ?, battery = COALESCE(?, battery) WHERE id = ?`,
      newest.lat, newest.lng, newest.accuracy, newest.t, battery, o.id);
  } else if (battery != null) {
    await db.run('UPDATE outings SET battery = ? WHERE id = ?', battery, o.id);
  }

  // Les proches avaient été prévenus d'un silence : on les rassure (une fois).
  if (pts.length && o.silence_notified_at && !o.silence_recovered_at) {
    await db.run('UPDATE outings SET silence_recovered_at = ? WHERE id = ?', nowIso(), o.id);
    notifySignalBack(o).catch(() => {});
  }
  res.json({ ok: true, accepted: pts.length });
});

// Modifier : véhicule, heure de retour, partage
router.patch('/:id', async (req, res) => {
  const o = await ownOuting(req, res); if (!o) return;
  if (o.status !== 'active') return res.status(409).json({ error: 'Sortie terminée' });
  const b = req.body || {};
  const db = await getDb();
  const sets = [], vals = [];

  if ('car' in b) {
    const car = b.car === null ? null : coord(b.car);
    if (b.car !== null && !car) return res.status(400).json({ error: 'Position du véhicule invalide' });
    sets.push('car_lat = ?', 'car_lng = ?'); vals.push(car?.lat ?? null, car?.lng ?? null);
  }
  let extended = false;
  if ('expected_return_at' in b) {
    const now = Date.now();
    const exp = isoOrNull(b.expected_return_at, { minMs: now - 60e3, maxMs: now + 2 * DAY });
    if (exp === undefined) return res.status(400).json({ error: 'Heure de retour invalide (dans le futur, 48 h maximum).' });
    sets.push('expected_return_at = ?', 'reminder_sent_at = NULL', 'overdue_notified_at = NULL');
    vals.push(exp);
    extended = !!o.overdue_notified_at;
  }
  if ('share_live' in b) { sets.push('share_live = ?'); vals.push(b.share_live ? 1 : 0); }
  if ('alert_on_silence' in b) { sets.push('alert_on_silence = ?'); vals.push(b.alert_on_silence ? 1 : 0); }
  if (!sets.length) return res.status(400).json({ error: 'Rien à modifier' });

  await db.run(`UPDATE outings SET ${sets.join(', ')} WHERE id = ?`, ...vals, o.id);
  const updated = await db.get('SELECT * FROM outings WHERE id = ?', o.id);
  // Les proches avaient reçu l'alerte « pas rentré » : on les rassure.
  if (extended && updated.expected_return_at) notifyExtended(updated).catch(() => {});
  res.json(await withDetails(updated));
});

// Appel à l'aide
router.post('/:id/sos', async (req, res) => {
  const o = await ownOuting(req, res); if (!o) return;
  if (o.status !== 'active') return res.status(409).json({ error: 'Sortie terminée' });
  const db = await getDb();
  const pos = coord(req.body);
  const now = nowIso();
  if (pos) {
    await db.run('UPDATE outings SET last_lat = ?, last_lng = ?, last_accuracy = ?, last_at = ? WHERE id = ?',
      pos.lat, pos.lng, pos.accuracy, now, o.id);
    await db.run('INSERT OR IGNORE INTO outing_points (outing_id, lat, lng, accuracy, recorded_at) VALUES (?, ?, ?, ?, ?)',
      o.id, pos.lat, pos.lng, pos.accuracy, now);
  }
  // Anti-rafale : pas plus d'un envoi toutes les 5 minutes
  const recent = o.sos_at && Date.now() - new Date(o.sos_at).getTime() < 5 * 60e3;
  await db.run('UPDATE outings SET sos_at = ?, share_live = 1 WHERE id = ?', now, o.id);
  const updated = await db.get('SELECT * FROM outings WHERE id = ?', o.id);
  const notified = recent ? 0 : await notifySos(updated);
  res.json({ ok: true, notified, throttled: !!recent });
});

router.post('/:id/sos/cancel', async (req, res) => {
  const o = await ownOuting(req, res); if (!o) return;
  if (!o.sos_at) return res.json({ ok: true });
  const db = await getDb();
  await db.run('UPDATE outings SET sos_at = NULL WHERE id = ?', o.id);
  notifySosCancel(o).catch(() => {});
  res.json({ ok: true });
});

// Terminer (« je suis rentré »)
router.post('/:id/end', async (req, res) => {
  const o = await ownOuting(req, res); if (!o) return;
  if (o.status !== 'active') return res.json({ ok: true, status: o.status });
  const db = await getDb();
  await db.run(`UPDATE outings SET status = 'ended', ended_at = ?, sos_at = NULL WHERE id = ?`, nowIso(), o.id);
  notifyEnd(o).catch(() => {});
  res.json({ ok: true, status: 'ended' });
});

export default router;
