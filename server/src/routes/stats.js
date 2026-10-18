import { Router } from 'express';
import { getDb } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

router.get('/summary', authRequired, async (req, res) => {
  const db = await getDb();
  const uid = req.user.id;

  const total = await db.get(
    `SELECT COUNT(*) AS finds, COALESCE(SUM(weight_g),0) AS total_g FROM finds WHERE user_id = ?`, uid
  );
  const bySpecies = await db.all(
    `SELECT species, COUNT(*) AS count, COALESCE(SUM(weight_g),0) AS total_g
     FROM finds WHERE user_id = ? AND species IS NOT NULL
     GROUP BY species ORDER BY total_g DESC`, uid
  );
  const byMonth = await db.all(
    `SELECT strftime('%Y-%m', found_at) AS month, COUNT(*) AS count, COALESCE(SUM(weight_g),0) AS total_g
     FROM finds WHERE user_id = ? GROUP BY month ORDER BY month ASC`, uid
  );
  const spotsCount = await db.get('SELECT COUNT(*) AS spots FROM spots WHERE user_id = ?', uid);

  res.json({
    totals: { finds: total.finds, total_g: total.total_g, spots: spotsCount.spots },
    bySpecies,
    byMonth
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

// --- Podium : classement des cueillettes (mois ou année en cours) ---
router.get('/leaderboard', authRequired, async (req, res) => {
  try {
    const period = (req.query.period || 'month').toLowerCase();
    if (!['month', 'year'].includes(period)) {
      return res.status(400).json({ error: 'period doit être "month" ou "year"' });
    }

    const db = await getDb();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    const fmtMonth = `${year}-${month}`;
    // Filtres SQL sans alias (pour les sous-requêtes)
    const filterNoAlias = period === 'month'
      ? `strftime('%Y-%m', found_at) = '${fmtMonth}'`
      : `strftime('%Y', found_at) = '${year}'`;
    // Filtres SQL avec alias f (pour les requêtes avec JOIN)
    const filterAlias = period === 'month'
      ? `strftime('%Y-%m', f.found_at) = '${fmtMonth}'`
      : `strftime('%Y', f.found_at) = '${year}'`;

    // Top 10 parmi les utilisateurs opt-in
    const rows = await db.all(
      `SELECT u.id, u.email, u.name,
              COUNT(f.id) AS find_count,
              COALESCE(SUM(f.weight_g), 0) AS total_g
       FROM users u
       JOIN finds f ON f.user_id = u.id
       WHERE u.leaderboard_opt_in = 1
         AND ${filterAlias}
       GROUP BY u.id
       HAVING total_g > 0
       ORDER BY total_g DESC, find_count DESC
       LIMIT 10`
    );

    // Position de l'utilisateur courant
    let me = null;
    if (req.user?.id) {
      const meRow = await db.get(
        `SELECT u.id, u.name, u.email, u.leaderboard_opt_in,
                COUNT(f.id) AS find_count,
                COALESCE(SUM(f.weight_g), 0) AS total_g
         FROM users u
         LEFT JOIN finds f ON f.user_id = u.id AND ${filterAlias}
         WHERE u.id = ?
         GROUP BY u.id`,
        req.user.id
      );

      if (meRow) {
        // Calcule le rang (avec filtre sans alias)
        const myTotal = await db.get(
          `SELECT COALESCE(SUM(weight_g), 0) AS total_g
           FROM finds
           WHERE user_id = ? AND ${filterNoAlias}`,
          req.user.id
        );

        const rankRow = await db.get(
          `SELECT COUNT(*) + 1 AS rank
           FROM (
             SELECT u.id, COALESCE(SUM(f.weight_g), 0) AS total_g
             FROM users u
             JOIN finds f ON f.user_id = u.id
             WHERE u.leaderboard_opt_in = 1
               AND ${filterAlias}
             GROUP BY u.id
             HAVING total_g > 0
           ) AS t
           WHERE t.total_g > ?`,
          myTotal.total_g
        );

        me = {
          id: meRow.id,
          display_name: meRow.name || meRow.email.split('@')[0],
          total_g: meRow.total_g,
          find_count: meRow.find_count,
          rank: rankRow?.rank || null,
          opt_in: !!meRow.leaderboard_opt_in
        };
      }
    }

    const leaderboard = rows.map(r => ({
      id: r.id,
      display_name: r.name || r.email.split('@')[0],
      total_g: r.total_g,
      find_count: r.find_count
    }));

    res.json({
      period,
      year,
      month: period === 'month' ? Number(month) : null,
      leaderboard,
      me
    });
  } catch (e) {
    console.error('Erreur /leaderboard:', e.message);
    res.status(500).json({ error: 'Erreur serveur : ' + e.message });
  }
});

export default router;
