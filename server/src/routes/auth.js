import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDb } from '../db.js';
import { sign, authRequired } from '../middleware/auth.js';
import { isPremiumUser, premiumForAll } from '../lib/premium.js';
import { cancelSubscriptionNow } from './billing.js';
import { sendVerificationEmail, sendResetEmail, isMailerConfigured } from '../lib/mailer.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

function validEmail(email) {
  return typeof email === 'string' && email.length <= 254 && EMAIL_RE.test(email);
}
function passwordError(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
    return `Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.`;
  }
  if (password.length > 200) return 'Mot de passe trop long.';
  return null;
}
function newToken() {
  return crypto.randomBytes(32).toString('hex');
}
function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    leaderboard_opt_in: u.leaderboard_opt_in || 0,
    email_verified: u.email_verified || 0
  };
}

// --- Inscription ---
router.post('/register', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const { password, name } = req.body;

  if (!validEmail(email)) return res.status(400).json({ error: 'Adresse e-mail invalide.' });
  const pwErr = passwordError(password);
  if (pwErr) return res.status(400).json({ error: pwErr });

  const db = await getDb();
  const existing = await db.get('SELECT id FROM users WHERE LOWER(email) = ?', email);
  if (existing) return res.status(409).json({ error: 'Email déjà utilisé' });

  const hash = await bcrypt.hash(password, 10);
  const verification_token = newToken();
  const result = await db.run(
    // alert_email = 0 : les alertes de poussée sont à activer par l'utilisateur (opt-in).
    `INSERT INTO users (email, password_hash, name, verification_token, verification_sent_at, alert_email)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 0)`,
    email, hash, (name || '').trim() || null, verification_token
  );

  // Envoi de l'e-mail de vérification (non bloquant : on connecte quand même).
  try { await sendVerificationEmail(email, verification_token); }
  catch (e) { console.error('Envoi e-mail de vérification échoué:', e.message); }

  const user = await db.get('SELECT * FROM users WHERE id = ?', result.lastID);
  res.json({ token: sign(user), user: publicUser(user), email_sent: isMailerConfigured() });
});

// --- Connexion ---
router.post('/login', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const { password } = req.body;
  const db = await getDb();
  const user = await db.get('SELECT * FROM users WHERE LOWER(email) = ?', email);
  if (!user) return res.status(401).json({ error: 'Identifiants invalides' });

  const ok = await bcrypt.compare(password || '', user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Identifiants invalides' });

  res.json({ token: sign(user), user: publicUser(user) });
});

// --- Profil ---
router.get('/profile', authRequired, async (req, res) => {
  const db = await getDb();
  const user = await db.get(
    `SELECT id, email, name, leaderboard_opt_in, email_verified, created_at,
            subscription_status, premium_until, stripe_customer_id, alert_email, alert_push, danger_push
     FROM users WHERE id = ?`,
    req.user.id
  );
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  const { stripe_customer_id, ...rest } = user;
  res.json({
    ...rest,
    is_premium: isPremiumUser(user),
    premium_for_all: premiumForAll(),
    has_billing_account: !!stripe_customer_id
  });
});

router.put('/profile', authRequired, async (req, res) => {
  const { name, leaderboard_opt_in, alert_email, danger_push } = req.body;
  const db = await getDb();

  const updates = [];
  const params = [];
  if (name !== undefined) { updates.push('name = ?'); params.push((name || '').trim() || null); }
  if (leaderboard_opt_in !== undefined) {
    updates.push('leaderboard_opt_in = ?'); params.push(leaderboard_opt_in ? 1 : 0);
  }
  if (alert_email !== undefined) { updates.push('alert_email = ?'); params.push(alert_email ? 1 : 0); }
  if (danger_push !== undefined) { updates.push('danger_push = ?'); params.push(danger_push ? 1 : 0); }
  if (updates.length === 0) return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });

  params.push(req.user.id);
  await db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, ...params);

  const updated = await db.get(
    'SELECT id, email, name, leaderboard_opt_in, email_verified, alert_email, alert_push, danger_push FROM users WHERE id = ?',
    req.user.id
  );
  res.json(updated);
});

// --- Changer de mot de passe (connecté) ---
router.put('/password', authRequired, async (req, res) => {
  const { current_password, new_password } = req.body;
  const pwErr = passwordError(new_password);
  if (pwErr) return res.status(400).json({ error: pwErr });

  const db = await getDb();
  const user = await db.get('SELECT * FROM users WHERE id = ?', req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  const ok = await bcrypt.compare(current_password || '', user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });

  const hash = await bcrypt.hash(new_password, 10);
  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', hash, user.id);
  res.json({ ok: true });
});

// --- Supprimer son compte (connecté) ---
router.delete('/account', authRequired, async (req, res) => {
  const { password } = req.body;
  const db = await getDb();
  const user = await db.get('SELECT * FROM users WHERE id = ?', req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  const ok = await bcrypt.compare(password || '', user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Mot de passe incorrect' });

  // Un abonnement en cours doit être résilié, sinon Stripe continuerait de prélever.
  if (user.stripe_subscription_id && !['canceled', 'incomplete_expired'].includes(user.subscription_status)) {
    try { await cancelSubscriptionNow(user.stripe_subscription_id); }
    catch (e) {
      console.error('[billing] résiliation à la suppression du compte', e.message);
      return res.status(502).json({ error: 'Impossible de résilier votre abonnement pour le moment. Réessayez, ou résiliez-le depuis « Gérer mon abonnement ».' });
    }
  }

  // ON DELETE CASCADE supprime spots, finds, identifications et partages liés.
  await db.run('DELETE FROM users WHERE id = ?', user.id);
  res.json({ ok: true });
});

// --- Vérification d'e-mail ---
router.get('/verify-email', async (req, res) => {
  const token = (req.query.token || '').toString();
  if (!token) return res.status(400).json({ error: 'Jeton manquant' });

  const db = await getDb();
  const user = await db.get('SELECT * FROM users WHERE verification_token = ?', token);
  if (!user) return res.status(400).json({ error: 'Lien de vérification invalide ou déjà utilisé' });

  await db.run(
    'UPDATE users SET email_verified = 1, verification_token = NULL WHERE id = ?',
    user.id
  );
  res.json({ ok: true });
});

// --- Renvoyer l'e-mail de vérification (connecté) ---
router.post('/resend-verification', authRequired, async (req, res) => {
  const db = await getDb();
  const user = await db.get('SELECT * FROM users WHERE id = ?', req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  if (user.email_verified) return res.json({ ok: true, already: true });

  const token = newToken();
  await db.run(
    'UPDATE users SET verification_token = ?, verification_sent_at = CURRENT_TIMESTAMP WHERE id = ?',
    token, user.id
  );
  try { await sendVerificationEmail(user.email, token); }
  catch (e) { console.error('Renvoi e-mail de vérification échoué:', e.message); }
  res.json({ ok: true, email_sent: isMailerConfigured() });
});

// --- Mot de passe oublié ---
router.post('/forgot-password', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const db = await getDb();
  const user = await db.get('SELECT * FROM users WHERE LOWER(email) = ?', email);

  // Réponse identique que l'e-mail existe ou non (anti-énumération de comptes).
  if (user) {
    const token = newToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h
    await db.run(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
      token, expires, user.id
    );
    try { await sendResetEmail(user.email, token); }
    catch (e) { console.error('Envoi e-mail de réinitialisation échoué:', e.message); }
  }
  res.json({ ok: true });
});

// --- Réinitialiser le mot de passe ---
router.post('/reset-password', async (req, res) => {
  const { token, new_password } = req.body;
  if (!token) return res.status(400).json({ error: 'Jeton manquant' });
  const pwErr = passwordError(new_password);
  if (pwErr) return res.status(400).json({ error: pwErr });

  const db = await getDb();
  const user = await db.get('SELECT * FROM users WHERE reset_token = ?', token);
  if (!user || !user.reset_token_expires || new Date(user.reset_token_expires) < new Date()) {
    return res.status(400).json({ error: 'Lien invalide ou expiré' });
  }

  const hash = await bcrypt.hash(new_password, 10);
  await db.run(
    'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
    hash, user.id
  );
  res.json({ ok: true });
});

export default router;
