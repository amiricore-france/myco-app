import { Router } from 'express';
import { getDb } from '../db.js';
import { authRequired } from '../middleware/auth.js';
const router = Router();

router.get('/', authRequired, async (req, res) => {
  const db = await getDb();
  res.json(await db.all(
    `SELECT f.*, s.name AS spot_name FROM finds f
     LEFT JOIN spots s ON s.id = f.spot_id
     WHERE f.user_id = ? ORDER BY f.found_at DESC LIMIT 500`, req.user.id));
});

router.post('/', authRequired, async (req, res) => {
  const { spot_id, species, weight_g, notes, found_at } = req.body;
  const db = await getDb();
  const r = await db.run(
    `INSERT INTO finds (user_id, spot_id, species, weight_g, notes, found_at)
     VALUES (?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
    req.user.id, spot_id || null, species || null, weight_g || null, notes || null, found_at || null
  );
  res.json(await db.get('SELECT * FROM finds WHERE id = ?', r.lastID));
});

router.delete('/:id', authRequired, async (req, res) => {
  const db = await getDb();
  const r = await db.run('DELETE FROM finds WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Introuvable' });
  res.json({ ok: true });
});

export default router;
