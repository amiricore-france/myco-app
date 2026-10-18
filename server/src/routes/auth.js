import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db.js';
import { sign, authRequired } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

  const db = await getDb();
  const existing = await db.get('SELECT id FROM users WHERE email = ?', email);
  if (existing) return res.status(409).json({ error: 'Email déjà utilisé' });

  const hash = await bcrypt.hash(password, 10);
  const result = await db.run(
    'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
    email, hash, name || null
  );
  const user = { id: result.lastID, email };
  res.json({ token: sign(user), user });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const db = await getDb();
  const user = await db.get('SELECT * FROM users WHERE email = ?', email);
  if (!user) return res.status(401).json({ error: 'Identifiants invalides' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Identifiants invalides' });

  res.json({
    token: sign(user),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      leaderboard_opt_in: user.leaderboard_opt_in || 0
    }
  });
});

// --- Récupérer le profil ---
router.get('/profile', authRequired, async (req, res) => {
  const db = await getDb();
  const user = await db.get(
    'SELECT id, email, name, leaderboard_opt_in, created_at FROM users WHERE id = ?',
    req.user.id
  );
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json(user);
});

// --- Mettre à jour le profil ---
router.put('/profile', authRequired, async (req, res) => {
  const { name, leaderboard_opt_in } = req.body;
  const db = await getDb();

  const updates = [];
  const params = [];

  if (name !== undefined) {
    updates.push('name = ?');
    params.push(name);
  }
  if (leaderboard_opt_in !== undefined) {
    updates.push('leaderboard_opt_in = ?');
    params.push(leaderboard_opt_in ? 1 : 0);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
  }

  params.push(req.user.id);
  await db.run(
    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
    ...params
  );

  const updated = await db.get(
    'SELECT id, email, name, leaderboard_opt_in FROM users WHERE id = ?',
    req.user.id
  );
  res.json(updated);
});

export default router;
