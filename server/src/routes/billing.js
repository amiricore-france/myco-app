import express from 'express';
import Stripe from 'stripe';
import { getDb } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { appUrl } from '../lib/mailer.js';

/**
 * Abonnement Myco Premium via Stripe.
 *
 * Variables d'environnement :
 *   STRIPE_SECRET_KEY        sk_test_… puis sk_live_…
 *   STRIPE_WEBHOOK_SECRET    whsec_… (fourni par Stripe pour l'URL du webhook)
 *   STRIPE_PRICE_MONTHLY     price_… (tarif mensuel récurrent)
 *   STRIPE_PRICE_YEARLY      price_… (tarif annuel récurrent, optionnel)
 *   PRICE_MONTHLY_LABEL      libellé affiché, ex. « 2,99 € / mois »
 *   PRICE_YEARLY_LABEL       libellé affiché, ex. « 19 € / an »
 *
 * Aucune donnée bancaire ne transite par Myco : le paiement se fait sur la page
 * Stripe Checkout, la gestion (carte, résiliation, factures) dans le portail Stripe.
 */

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export function billingEnabled() {
  return !!(stripe && process.env.STRIPE_PRICE_MONTHLY);
}

const router = express.Router();

// --- Configuration publique (affichage des offres côté client) ---
router.get('/config', (_req, res) => {
  res.json({
    enabled: billingEnabled(),
    monthly: process.env.STRIPE_PRICE_MONTHLY
      ? { label: process.env.PRICE_MONTHLY_LABEL || 'Mensuel' } : null,
    yearly: process.env.STRIPE_PRICE_YEARLY
      ? { label: process.env.PRICE_YEARLY_LABEL || 'Annuel' } : null
  });
});

async function getOrCreateCustomer(db, user) {
  if (user.stripe_customer_id) return user.stripe_customer_id;
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name || undefined,
    metadata: { myco_user_id: String(user.id) }
  });
  await db.run('UPDATE users SET stripe_customer_id = ? WHERE id = ?', customer.id, user.id);
  return customer.id;
}

// --- Démarrer un abonnement : renvoie l'URL de la page Stripe Checkout ---
router.post('/checkout', authRequired, async (req, res) => {
  if (!billingEnabled()) return res.status(503).json({ error: 'Paiement pas encore disponible' });
  const interval = req.body?.interval === 'yearly' ? 'yearly' : 'monthly';
  const price = interval === 'yearly' ? process.env.STRIPE_PRICE_YEARLY : process.env.STRIPE_PRICE_MONTHLY;
  if (!price) return res.status(400).json({ error: 'Offre indisponible' });

  const db = await getDb();
  const user = await db.get('SELECT * FROM users WHERE id = ?', req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  if (['active', 'trialing'].includes(user.subscription_status)) {
    return res.status(409).json({ error: 'Vous êtes déjà abonné(e) à Myco Premium' });
  }

  try {
    const customer = await getOrCreateCustomer(db, user);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: String(user.id),
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      locale: 'fr',
      subscription_data: { metadata: { myco_user_id: String(user.id) } },
      success_url: `${appUrl()}/profile?premium=ok#premium`,
      cancel_url: `${appUrl()}/profile?premium=annule#premium`
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error('[billing] checkout', e.message);
    res.status(502).json({ error: 'Impossible de contacter le service de paiement' });
  }
});

// --- Portail client Stripe (carte, factures, résiliation) ---
router.post('/portal', authRequired, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Paiement pas encore disponible' });
  const db = await getDb();
  const user = await db.get('SELECT stripe_customer_id FROM users WHERE id = ?', req.user.id);
  if (!user?.stripe_customer_id) return res.status(404).json({ error: 'Aucun abonnement associé à ce compte' });
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${appUrl()}/profile#premium`
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error('[billing] portal', e.message);
    res.status(502).json({ error: 'Impossible de contacter le service de paiement' });
  }
});

// --- Webhook Stripe ---
// Monté dans index.js AVANT express.json() : la signature se vérifie sur le corps brut.

function periodEnd(sub) {
  // Selon la version d'API Stripe, la fin de période est sur l'abonnement
  // ou sur ses lignes (items).
  const ts = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

async function applySubscription(sub) {
  const db = await getDb();
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  let user = await db.get('SELECT id FROM users WHERE stripe_customer_id = ?', customerId);
  if (!user && sub.metadata?.myco_user_id) {
    user = await db.get('SELECT id FROM users WHERE id = ?', Number(sub.metadata.myco_user_id));
    if (user) await db.run('UPDATE users SET stripe_customer_id = ? WHERE id = ?', customerId, user.id);
  }
  if (!user) {
    console.warn(`[billing] abonnement ${sub.id} sans utilisateur Myco associé`);
    return;
  }
  // premium_until = fin de la période payée : un abonné qui résilie garde
  // l'accès jusqu'au terme de ce qu'il a payé.
  await db.run(
    `UPDATE users SET stripe_subscription_id = ?, subscription_status = ?, premium_until = ? WHERE id = ?`,
    sub.id, sub.status, periodEnd(sub), user.id
  );
}

export async function stripeWebhook(req, res) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).end();
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (e) {
    console.warn('[billing] signature webhook invalide :', e.message);
    return res.status(400).send('Signature invalide');
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object;
        if (s.mode === 'subscription' && s.subscription) {
          const db = await getDb();
          if (s.client_reference_id && s.customer) {
            await db.run(
              'UPDATE users SET stripe_customer_id = ? WHERE id = ? AND stripe_customer_id IS NULL',
              s.customer, Number(s.client_reference_id)
            );
          }
          const sub = await stripe.subscriptions.retrieve(s.subscription);
          await applySubscription(sub);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await applySubscription(event.data.object);
        break;
      default:
        break;
    }
    res.json({ received: true });
  } catch (e) {
    console.error('[billing] traitement webhook', event.type, e.message);
    res.status(500).end(); // Stripe réessaiera
  }
}

/** Résilie immédiatement l'abonnement (suppression de compte). */
export async function cancelSubscriptionNow(subscriptionId) {
  if (!stripe || !subscriptionId) return;
  try { await stripe.subscriptions.cancel(subscriptionId); }
  catch (e) {
    if (e.code !== 'resource_missing') throw e;
  }
}

export default router;
