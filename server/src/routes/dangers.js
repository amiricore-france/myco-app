import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getDb } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import {
  DANGER_TYPES, parisDay, shiftDay, notifyNearbySpotOwners, ABUSE_HIDE_THRESHOLD, RETENTION_DAYS
} from '../lib/dangers.js';

/**
 * Signalements de zones de danger — fonctionnalité gratuite, ouverte à tous les comptes.
 *
 *   GET    /api/dangers?bbox=sud,ouest,nord,est&days=0..365   signalements visibles
 *   POST   /api/dangers                                        signaler
 *   POST   /api/dangers/:id/confirm                            « toujours là »
 *   POST   /api/dangers/:id/abuse                              signalement abusif
 *   POST   /api/dangers/:id/end                                l'auteur le déclare terminé
 *   DELETE /api/dangers/:id                                    l'auteur le supprime (erreur)
 */

const router = Router();
router.use(authRequired);

const MAX_PER_DAY = 20;
const MAX_ROWS = 1000;
const createLimiter = rateLimit({ windowMs: 10 * 60e3, max: 15, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Trop de signalements en peu de temps. Réessayez dans quelques minutes.' } });

function cleanComment(v) {
  if (v == null) return null;
  // Retire les caractères de contrôle, compacte les espaces, 200 caractères au plus.
  const s = String(v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
  return s || null;
}

function serialize(r, userId, today) {
  const ageDays = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${r.day}T12:00:00Z`)) / 86400e3);
  return {
    id: r.id,
    type: r.type,
    lat: r.lat,
    lng: r.lng,
    comment: r.comment,
    day: r.day,
    created_at: r.created_at,
    ended_at: r.ended_at,
    confirmations: r.confirmations,
    age_days: ageDays,
    active: ageDays === 0 && !r.ended_at,
    mine: r.user_id === userId,
    voted: r.voted || null
  };
}

router.get('/', async (req, res) => {
  const parts = String(req.query.bbox || '').split(',').map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isFinite(n))) {
    return res.status(400).json({ error: 'Paramètre bbox attendu : sud,ouest,nord,est' });
  }
  const [south, west, north, east] = parts;
  if (north - south > 3 || east - west > 4) {
    return res.json({ today: parisDay(), reports: [], too_wide: true });
  }
  const days = Math.max(0, Math.min(RETENTION_DAYS(), Number(req.query.days) || 0));
  const today = parisDay();
  const db = await getDb();
  const rows = await db.all(
    `SELECT r.*,
            (SELECT GROUP_CONCAT(kind) FROM danger_votes v WHERE v.report_id = r.id AND v.user_id = ?) AS voted
       FROM danger_reports r
      WHERE r.hidden = 0 AND r.day >= ? AND r.day <= ?
        AND r.lat BETWEEN ? AND ? AND r.lng BETWEEN ? AND ?
      ORDER BY r.created_at DESC LIMIT ?`,
    req.user.id, shiftDay(today, -days), today, south, north, west, east, MAX_ROWS
  );
  res.json({ today, reports: rows.map(r => serialize(r, req.user.id, today)) });
});

router.get('/:id', async (req, res) => {
  const db = await getDb();
  const r = await db.get('SELECT * FROM danger_reports WHERE id = ? AND hidden = 0', req.params.id);
  if (!r) return res.status(404).json({ error: 'Signalement introuvable ou retiré' });
  res.json(serialize(r, req.user.id, parisDay()));
});

router.post('/', createLimiter, async (req, res) => {
  const { type } = req.body || {};
  const lat = Number(req.body?.lat), lng = Number(req.body?.lng);
  if (!DANGER_TYPES[type]) return res.status(400).json({ error: 'Type de danger inconnu' });
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ error: 'Position invalide' });
  }
  const comment = cleanComment(req.body?.comment);
  if (type === 'autre' && !comment) {
    return res.status(400).json({ error: 'Précisez le danger en quelques mots.' });
  }

  const db = await getDb();
  const today = parisDay();
  const count = await db.get('SELECT COUNT(*) AS n FROM danger_reports WHERE user_id = ? AND day = ?', req.user.id, today);
  if (count.n >= MAX_PER_DAY) return res.status(429).json({ error: 'Limite de signalements atteinte pour aujourd’hui.' });

  const now = new Date().toISOString();
  const r = await db.run(
    `INSERT INTO danger_reports (user_id, type, lat, lng, comment, day, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    req.user.id, type, lat, lng, comment, today, now
  );
  const report = await db.get('SELECT * FROM danger_reports WHERE id = ?', r.lastID);
  res.status(201).json(serialize(report, req.user.id, today));

  // Notifications aux propriétaires de coins proches, sans retarder la réponse.
  notifyNearbySpotOwners(report).catch(e => console.warn('[dangers] notification', e.message));
});

async function getVisible(req, res) {
  const db = await getDb();
  const r = await db.get('SELECT * FROM danger_reports WHERE id = ? AND hidden = 0', req.params.id);
  if (!r) { res.status(404).json({ error: 'Signalement introuvable ou retiré' }); return null; }
  return r;
}

router.post('/:id/confirm', async (req, res) => {
  const r = await getVisible(req, res); if (!r) return;
  const today = parisDay();
  if (r.day !== today || r.ended_at) return res.status(409).json({ error: 'Ce signalement n’est plus actif.' });
  if (r.user_id === req.user.id) return res.status(409).json({ error: 'Vous êtes l’auteur de ce signalement.' });
  const db = await getDb();
  const ins = await db.run(
    `INSERT OR IGNORE INTO danger_votes (report_id, user_id, kind, created_at) VALUES (?, ?, 'confirm', ?)`,
    r.id, req.user.id, new Date().toISOString()
  );
  if (ins.changes) await db.run('UPDATE danger_reports SET confirmations = confirmations + 1 WHERE id = ?', r.id);
  const updated = await db.get('SELECT * FROM danger_reports WHERE id = ?', r.id);
  res.json(serialize({ ...updated, voted: 'confirm' }, req.user.id, today));
});

router.post('/:id/abuse', async (req, res) => {
  const r = await getVisible(req, res); if (!r) return;
  if (r.user_id === req.user.id) return res.status(409).json({ error: 'Supprimez plutôt votre propre signalement.' });
  const db = await getDb();
  const ins = await db.run(
    `INSERT OR IGNORE INTO danger_votes (report_id, user_id, kind, created_at) VALUES (?, ?, 'abuse', ?)`,
    r.id, req.user.id, new Date().toISOString()
  );
  if (ins.changes) {
    await db.run(
      `UPDATE danger_reports SET abuse_count = abuse_count + 1,
              hidden = CASE WHEN abuse_count + 1 >= ? THEN 1 ELSE hidden END
        WHERE id = ?`,
      ABUSE_HIDE_THRESHOLD(), r.id
    );
    console.log(`[dangers] signalement ${r.id} déclaré abusif par l'utilisateur ${req.user.id}`);
  }
  res.json({ ok: true });
});

router.post('/:id/end', async (req, res) => {
  const r = await getVisible(req, res); if (!r) return;
  if (r.user_id !== req.user.id) return res.status(403).json({ error: 'Seul l’auteur peut clore ce signalement.' });
  const db = await getDb();
  await db.run('UPDATE danger_reports SET ended_at = COALESCE(ended_at, ?) WHERE id = ?', new Date().toISOString(), r.id);
  const updated = await db.get('SELECT * FROM danger_reports WHERE id = ?', r.id);
  res.json(serialize(updated, req.user.id, parisDay()));
});

router.delete('/:id', async (req, res) => {
  const db = await getDb();
  const r = await db.run('DELETE FROM danger_reports WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  if (!r.changes) return res.status(404).json({ error: 'Signalement introuvable' });
  res.json({ ok: true });
});

export default router;
