import { getDb } from '../db.js';

/**
 * Statut premium d'un utilisateur.
 *
 * Un compte est premium si :
 *   - son abonnement Stripe est actif (active / trialing), ou
 *   - premium_until est dans le futur (accès offert, période payée en cours
 *     après résiliation, geste commercial…), ou
 *   - PREMIUM_FOR_ALL=true (phase de lancement gratuite / tests).
 */
export const ACTIVE_STATUSES = ['active', 'trialing'];

export function premiumForAll() {
  return process.env.PREMIUM_FOR_ALL === 'true';
}

export function isPremiumUser(user) {
  if (!user) return false;
  if (premiumForAll()) return true;
  if (ACTIVE_STATUSES.includes(user.subscription_status)) return true;
  if (user.premium_until && new Date(user.premium_until) > new Date()) return true;
  return false;
}

/** Fragment SQL équivalent, pour les traitements par lot (table aliasée « u »). */
export function premiumSqlCondition() {
  if (premiumForAll()) return '1 = 1';
  return `(u.subscription_status IN ('active', 'trialing') OR (u.premium_until IS NOT NULL AND u.premium_until > datetime('now')))`;
}

/** Middleware : à placer après authRequired. */
export async function requirePremium(req, res, next) {
  const db = await getDb();
  const user = await db.get(
    'SELECT id, subscription_status, premium_until FROM users WHERE id = ?',
    req.user.id
  );
  if (!isPremiumUser(user)) {
    return res.status(402).json({ error: 'Fonctionnalité réservée à Myco Premium', premium_required: true });
  }
  next();
}
