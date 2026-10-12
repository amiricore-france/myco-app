import { Router } from 'express';
import { getDb } from '../db.js';
import { authRequired } from '../middleware/auth.js';
const router = Router();

router.get('/summary', authRequired, async (req, res) => {
  const db = await getDb();
  const uid = req.user.id;
  const total = await db.get(`SELECT COUNT(*) AS finds, COALESCE(SUM(weight_g),0) AS total_g FROM finds WHERE user_id = ?`, uid);
  const bySpecies = await db.all(
    `SELECT species, COUNT(*) AS count, COALESCE(SUM(weight_g),0) AS total_g
     FROM finds WHERE user_id = ? AND species IS NOT NULL GROUP BY species ORDER BY total_g DESC`, uid);
  const byMonth = await db.all(
    `SELECT strftime('%Y-%m', found_at) AS month, COUNT(*) AS count, COALESCE(SUM(weight_g),0) AS total_g
     FROM finds WHERE user_id = ? GROUP BY month ORDER BY month ASC`, uid);
  const spotsCount = await db.get('SELECT COUNT(*) AS spots FROM spots WHERE user_id = ?', uid);
  res.json({
    totals: { finds: total.finds, total_g: total.total_g, spots: spotsCount.spots },
    bySpecies, byMonth
  });
});


router.get('/top-sharers', authRequired, async (_req, res) => {
  const db = await getDb();
  const rows = await db.all(
    `SELECT u.id, u.email, u.name, COUNT(sh.id) AS share_count
     FROM users u
     JOIN spot_shares sh ON sh.from_user_id = u.id AND sh.status = 'accepted'
     GROUP BY u.id
     ORDER BY share_count DESC, u.id ASC
     LIMIT 10`
  );
  res.json(rows.map(r => ({
    id: r.id,
    display_name: r.name || r.email.split('@')[0],
    share_count: r.share_count
  })));
});

export default router;
