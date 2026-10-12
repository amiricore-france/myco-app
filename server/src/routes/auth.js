import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db.js';
import { sign } from '../middleware/auth.js';
const router = Router();

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });
  const db = await getDb();
  const existing = await db.get('SELECT id FROM users WHERE email = ?', email);
  if (existing) return res.status(409).json({ error: 'Email deja utilise' });
  const hash = await bcrypt.hash(password, 10);
  const r = await db.run('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)', email, hash, name || null);
  const user = { id: r.lastID, email };
  res.json({ token: sign(user), user });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const db = await getDb();
  const user = await db.get('SELECT * FROM users WHERE email = ?', email);
  if (!user) return res.status(401).json({ error: 'Identifiants invalides' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Identifiants invalides' });
  res.json({ token: sign(user), user: { id: user.id, email: user.email, name: user.name } });
});

export default router;
