import { Router } from 'express';
import { nanoid } from 'nanoid';
import { getDb } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

router.get('/', authRequired, async (req, res) => {
  const db = await getDb();
  const spots = await db.all('SELECT * FROM spots WHERE user_id = ? ORDER BY created_at DESC', req.user.id);
  res.json(spots);
});

router.post('/', authRequired, async (req, res) => {
  const { name, description, lat, lng, radius_m, is_public } = req.body;
  if (!name || lat == null || lng == null) return res.status(400).json({ error: 'Nom, lat et lng requis' });

  const db = await getDb();
  const share_token = is_public ? nanoid(12) : null;
  const result = await db.run(
    `INSERT INTO spots (user_id, name, description, lat, lng, radius_m, is_public, share_token)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    req.user.id, name, description || null, lat, lng, radius_m || 50, is_public ? 1 : 0, share_token
  );
  const spot = await db.get('SELECT * FROM spots WHERE id = ?', result.lastID);
  res.json(spot);
});

router.put('/:id', authRequired, async (req, res) => {
  const db = await getDb();
  const spot = await db.get('SELECT * FROM spots WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  if (!spot) return res.status(404).json({ error: 'Spot introuvable' });

  const { name, description, radius_m, is_public } = req.body;
  await db.run(
    `UPDATE spots SET name = ?, description = ?, radius_m = ?, is_public = ?, share_token = ? WHERE id = ?`,
    name ?? spot.name,
    description ?? spot.description,
    radius_m ?? spot.radius_m,
    is_public != null ? (is_public ? 1 : 0) : spot.is_public,
    is_public && !spot.share_token ? nanoid(12) : spot.share_token,
    spot.id
  );
  const updated = await db.get('SELECT * FROM spots WHERE id = ?', spot.id);
  res.json(updated);
});

router.delete('/:id', authRequired, async (req, res) => {
  const db = await getDb();
  const result = await db.run('DELETE FROM spots WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Introuvable' });
  res.json({ ok: true });
});

// --- Spot public (sans auth) ---
router.get('/shared/:token', async (req, res) => {
  const db = await getDb();
  const spot = await db.get(
    `SELECT s.id, s.name, s.description, s.lat, s.lng, s.radius_m, s.created_at,
            u.name AS owner_name, u.email AS owner_email
     FROM spots s
     LEFT JOIN users u ON u.id = s.user_id
     WHERE s.share_token = ? AND s.is_public = 1`,
    req.params.token
  );
  if (!spot) return res.status(404).json({ error: 'Lien invalide ou expiré' });

  // On renvoie le nom d'utilisateur du propriétaire (mais pas son email)
  const owner = spot.owner_name || (spot.owner_email ? spot.owner_email.split('@')[0] : 'un utilisateur');
  delete spot.owner_email;
  res.json({ ...spot, owner_name: owner });
});

// --- Importer un coin partagé dans son propre compte ---
router.post('/import/:token', authRequired, async (req, res) => {
  const db = await getDb();

  const source = await db.get(
    'SELECT * FROM spots WHERE share_token = ? AND is_public = 1',
    req.params.token
  );
  if (!source) return res.status(404).json({ error: 'Lien invalide ou expiré' });
  if (source.user_id === req.user.id) {
    return res.status(400).json({ error: 'Ce coin est déjà dans votre compte' });
  }

  // Vérifie si l'utilisateur n'a pas déjà importé ce coin (même nom + coordonnées proches)
  const existing = await db.get(
    `SELECT id FROM spots
     WHERE user_id = ? AND name = ? AND ABS(lat - ?) < 0.0001 AND ABS(lng - ?) < 0.0001`,
    req.user.id, source.name, source.lat, source.lng
  );
  if (existing) {
    return res.status(409).json({ error: 'Vous avez déjà enregistré ce coin' });
  }

  // Crée une copie privée
  const result = await db.run(
    `INSERT INTO spots (user_id, name, description, lat, lng, radius_m, is_public, share_token)
     VALUES (?, ?, ?, ?, ?, ?, 0, NULL)`,
    req.user.id,
    source.name,
    source.description,
    source.lat,
    source.lng,
    source.radius_m
  );

  const newSpot = await db.get('SELECT * FROM spots WHERE id = ?', result.lastID);
  res.json(newSpot);
});

export default router;
