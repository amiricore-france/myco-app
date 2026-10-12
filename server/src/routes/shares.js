import { Router } from 'express';
import { getDb } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

// --- Envoyer un partage ---
router.post('/', authRequired, async (req, res) => {
  const { spot_id, to_email } = req.body;
  if (!spot_id || !to_email) return res.status(400).json({ error: 'spot_id et to_email requis' });

  const db = await getDb();
  const spot = await db.get('SELECT * FROM spots WHERE id = ? AND user_id = ?', spot_id, req.user.id);
  if (!spot) return res.status(404).json({ error: 'Coin introuvable ou non autorisé' });

  const dest = await db.get('SELECT id, email, name FROM users WHERE LOWER(email) = ?', to_email.trim().toLowerCase());
  if (!dest) return res.status(404).json({ error: 'Aucun utilisateur avec cet email' });
  if (dest.id === req.user.id) return res.status(400).json({ error: 'Impossible de partager avec vous-même' });

  const existing = await db.get(
    'SELECT id, status FROM spot_shares WHERE spot_id = ? AND from_user_id = ? AND to_user_id = ?',
    spot_id, req.user.id, dest.id
  );
  if (existing && existing.status !== 'declined') {
    return res.status(409).json({
      error: existing.status === 'pending' ? 'Un partage est déjà en attente pour cet utilisateur'
           : 'Cet utilisateur a déjà accepté ce coin'
    });
  }

  // Si un partage 'declined' existe, on le réinitialise en 'pending'
  if (existing && existing.status === 'declined') {
    await db.run(
      `UPDATE spot_shares SET status = 'pending', created_at = CURRENT_TIMESTAMP, responded_at = NULL WHERE id = ?`,
      existing.id
    );
    return res.json({
      id: existing.id, spot_id, to_user_id: dest.id, to_email: dest.email,
      to_display_name: dest.name || dest.email.split('@')[0],
      status: 'pending'
    });
  }

  const r = await db.run(
    `INSERT INTO spot_shares (spot_id, from_user_id, to_user_id, status) VALUES (?, ?, ?, 'pending')`,
    spot_id, req.user.id, dest.id
  );

  res.json({
    id: r.lastID, spot_id, to_user_id: dest.id, to_email: dest.email,
    to_display_name: dest.name || dest.email.split('@')[0],
    status: 'pending'
  });
});

// --- Liste reçus ---
router.get('/received', authRequired, async (req, res) => {
  const db = await getDb();
  const rows = await db.all(
    `SELECT sh.*, s.name AS spot_name, s.description AS spot_description,
            s.lat, s.lng, s.radius_m, u.email AS from_email, u.name AS from_name
     FROM spot_shares sh
     JOIN spots s ON s.id = sh.spot_id
     JOIN users u ON u.id = sh.from_user_id
     WHERE sh.to_user_id = ? ORDER BY sh.created_at DESC`,
    req.user.id
  );
  res.json(rows.map(r => ({ ...r, from_display_name: r.from_name || r.from_email.split('@')[0] })));
});

// --- Liste envoyés ---
router.get('/sent', authRequired, async (req, res) => {
  const db = await getDb();
  const rows = await db.all(
    `SELECT sh.*, s.name AS spot_name, u.email AS to_email, u.name AS to_name
     FROM spot_shares sh
     JOIN spots s ON s.id = sh.spot_id
     JOIN users u ON u.id = sh.to_user_id
     WHERE sh.from_user_id = ? AND sh.status != 'revoked'
     ORDER BY sh.created_at DESC`,
    req.user.id
  );
  res.json(rows.map(r => ({ ...r, to_display_name: r.to_name || r.to_email.split('@')[0] })));
});

// --- Compte en attente ---
router.get('/pending-count', authRequired, async (req, res) => {
  const db = await getDb();
  const row = await db.get(
    `SELECT COUNT(*) AS count FROM spot_shares WHERE to_user_id = ? AND status = 'pending'`,
    req.user.id
  );
  res.json({ count: row.count });
});

// --- Accepter : copie le coin et marque la reference au partage ---
router.post('/:id/accept', authRequired, async (req, res) => {
  const db = await getDb();
  const share = await db.get(
    `SELECT * FROM spot_shares WHERE id = ? AND to_user_id = ? AND status = 'pending'`,
    req.params.id, req.user.id
  );
  if (!share) return res.status(404).json({ error: 'Partage introuvable ou déjà traité' });

  const source = await db.get('SELECT * FROM spots WHERE id = ?', share.spot_id);
  if (!source) return res.status(404).json({ error: "Le coin source n'existe plus" });

  // Nom d'affichage du partageur
  const owner = await db.get('SELECT email, name FROM users WHERE id = ?', share.from_user_id);
  const ownerDisplay = owner?.name || owner?.email?.split('@')[0] || 'un utilisateur';

  // Copie chez le destinataire avec la référence au partage
  const result = await db.run(
    `INSERT INTO spots (user_id, name, description, lat, lng, radius_m, is_public, share_token,
                        imported_from_share_id, import_owner_display)
     VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)`,
    req.user.id, source.name, source.description, source.lat, source.lng, source.radius_m,
    share.id, ownerDisplay
  );

  await db.run(
    `UPDATE spot_shares SET status = 'accepted', responded_at = CURRENT_TIMESTAMP WHERE id = ?`,
    share.id
  );

  const newSpot = await db.get('SELECT * FROM spots WHERE id = ?', result.lastID);
  res.json({ ok: true, spot: newSpot });
});

// --- Refuser ---
router.post('/:id/decline', authRequired, async (req, res) => {
  const db = await getDb();
  const share = await db.get(
    `SELECT * FROM spot_shares WHERE id = ? AND to_user_id = ? AND status = 'pending'`,
    req.params.id, req.user.id
  );
  if (!share) return res.status(404).json({ error: 'Partage introuvable ou déjà traité' });

  await db.run(
    `UPDATE spot_shares SET status = 'declined', responded_at = CURRENT_TIMESTAMP WHERE id = ?`,
    share.id
  );
  res.json({ ok: true });
});

// --- Révoquer : A1 (supprime la copie) + B1 (délie les trouvailles) ---
router.delete('/:id', authRequired, async (req, res) => {
  const db = await getDb();
  const share = await db.get(
    'SELECT * FROM spot_shares WHERE id = ? AND from_user_id = ?',
    req.params.id, req.user.id
  );
  if (!share) return res.status(404).json({ error: 'Partage introuvable' });

  // A1 : si accepté, supprime la copie chez le destinataire
  if (share.status === 'accepted') {
    const copies = await db.all(
      'SELECT id FROM spots WHERE imported_from_share_id = ?',
      share.id
    );

    for (const copy of copies) {
      // B1 : délie les trouvailles (spot_id -> NULL)
      await db.run('UPDATE finds SET spot_id = NULL WHERE spot_id = ?', copy.id);
      // A1 : supprime la copie
      await db.run('DELETE FROM spots WHERE id = ?', copy.id);
    }
  }

  // Supprime le partage lui-même
  await db.run('DELETE FROM spot_shares WHERE id = ?', share.id);
  res.json({ ok: true });
});

export default router;
