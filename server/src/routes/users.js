import { Router } from 'express';
import { getDb } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

router.get('/lookup', authRequired, async (req, res) => {
  const email = (req.query.email || '').trim().toLowerCase();
  if (!email || email.length < 3) {
    return res.status(400).json({ error: 'Email trop court' });
  }
  const db = await getDb();
  const user = await db.get(
    'SELECT id, email, name FROM users WHERE LOWER(email) = ?',
    email
  );
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  if (user.id === req.user.id) return res.status(400).json({ error: 'Vous ne pouvez pas vous partager un coin à vous-même' });

  const display_name = user.name || user.email.split('@')[0];
  res.json({ id: user.id, email: user.email, display_name });
});

export default router;
