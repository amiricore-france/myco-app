import express from 'express';
import { getDb } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { requirePremium } from '../lib/premium.js';
import { forecastForUser, notifyUser } from '../lib/alerts.js';
import { alertThreshold } from '../lib/flush.js';
import { isPushConfigured } from '../lib/push.js';

const router = express.Router();

// Indice de poussée de mes coins (Premium)
router.get('/forecast', authRequired, requirePremium, async (req, res) => {
  try {
    const spots = await forecastForUser(req.user.id);
    res.json({ threshold: alertThreshold(), generated_at: new Date().toISOString(), spots });
  } catch (e) {
    console.error('[alerts] forecast', e.message);
    res.status(502).json({ error: 'Météo momentanément indisponible' });
  }
});

// Clé publique VAPID pour l'abonnement push du navigateur
router.get('/push/public-key', (_req, res) => {
  res.json({ key: isPushConfigured() ? process.env.VAPID_PUBLIC_KEY : null });
});

router.post('/push/subscribe', authRequired, async (req, res) => {
  const sub = req.body?.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return res.status(400).json({ error: 'Abonnement push invalide' });
  }
  if (!/^https:\/\//.test(sub.endpoint) || sub.endpoint.length > 1000) {
    return res.status(400).json({ error: 'Abonnement push invalide' });
  }
  const db = await getDb();
  await db.run(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    req.user.id, sub.endpoint, sub.keys.p256dh, sub.keys.auth
  );
  await db.run('UPDATE users SET alert_push = 1 WHERE id = ?', req.user.id);
  res.json({ ok: true });
});

router.post('/push/unsubscribe', authRequired, async (req, res) => {
  const db = await getDb();
  if (req.body?.endpoint) {
    await db.run('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?', req.user.id, req.body.endpoint);
  }
  const left = await db.get('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = ?', req.user.id);
  if (!left.n) await db.run('UPDATE users SET alert_push = 0 WHERE id = ?', req.user.id);
  res.json({ ok: true });
});

// Alerte de test sur les canaux activés
router.post('/test', authRequired, requirePremium, async (req, res) => {
  const db = await getDb();
  const user = await db.get('SELECT id, email, email_verified, alert_email, alert_push FROM users WHERE id = ?', req.user.id);
  const forecast = await forecastForUser(req.user.id).catch(() => []);
  const sample = forecast.filter(f => f.score != null).slice(0, 3);
  const hits = sample.length ? sample
    : [{ name: 'Coin exemple', score: 72, level: 'bonne', reasons: ['alerte de démonstration'] }];
  const channels = await notifyUser(user, hits, { test: true });
  if (!channels) return res.status(400).json({ error: 'Aucun canal actif : activez l’e-mail (vérifié) ou les notifications.' });
  res.json({ ok: true, channels });
});

export default router;
