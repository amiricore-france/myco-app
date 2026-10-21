import { Router } from 'express';
import { getDb } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { safeUnlinkUpload } from '../lib/uploads.js';

const router = Router();

// Lister les identifications de l'utilisateur
router.get('/', authRequired, async (req, res) => {
  const db = await getDb();
  const rows = await db.all(
    `SELECT i.*, s.name AS spot_name
     FROM identifications i
     LEFT JOIN spots s ON s.id = i.spot_id
     WHERE i.user_id = ?
     ORDER BY i.created_at DESC
     LIMIT 100`,
    req.user.id
  );

  const out = rows.map(r => ({
    ...r,
    alternatives: r.alternatives_json ? JSON.parse(r.alternatives_json) : []
  }));
  res.json(out);
});

// Récupérer une identification
router.get('/:id', authRequired, async (req, res) => {
  const db = await getDb();
  const row = await db.get(
    'SELECT * FROM identifications WHERE id = ? AND user_id = ?',
    req.params.id, req.user.id
  );
  if (!row) return res.status(404).json({ error: 'Identification introuvable' });
  res.json({
    ...row,
    alternatives: row.alternatives_json ? JSON.parse(row.alternatives_json) : []
  });
});

// Associer à un spot ou à une trouvaille
router.put('/:id', authRequired, async (req, res) => {
  const db = await getDb();
  const row = await db.get(
    'SELECT * FROM identifications WHERE id = ? AND user_id = ?',
    req.params.id, req.user.id
  );
  if (!row) return res.status(404).json({ error: 'Identification introuvable' });

  const { spot_id, find_id } = req.body;
  await db.run(
    'UPDATE identifications SET spot_id = ?, find_id = ? WHERE id = ?',
    spot_id !== undefined ? spot_id : row.spot_id,
    find_id !== undefined ? find_id : row.find_id,
    row.id
  );
  const updated = await db.get('SELECT * FROM identifications WHERE id = ?', row.id);
  res.json(updated);
});

// Supprimer (avec fichier photo)
router.delete('/:id', authRequired, async (req, res) => {
  const db = await getDb();
  const row = await db.get(
    'SELECT * FROM identifications WHERE id = ? AND user_id = ?',
    req.params.id, req.user.id
  );
  if (!row) return res.status(404).json({ error: 'Introuvable' });

  // Supprime le fichier photo si présent
  if (row.photo_url?.startsWith('/uploads/')) {
    safeUnlinkUpload(row.photo_url);
  }

  await db.run('DELETE FROM identifications WHERE id = ?', row.id);
  res.json({ ok: true });
});

export default router;
