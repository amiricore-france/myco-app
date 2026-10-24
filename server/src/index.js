import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { getDb } from './db.js';
import { UPLOADS_DIR } from './lib/uploads.js';
import authRoutes from './routes/auth.js';
import spotRoutes from './routes/spots.js';
import findRoutes from './routes/finds.js';
import statsRoutes from './routes/stats.js';
import aiRoutes from './routes/ai.js';
import speciesRoutes from './routes/species.js';
import identificationRoutes from './routes/identifications.js';
import sharesRoutes from './routes/shares.js';
import usersRoutes from './routes/users.js';
import billingRoutes, { stripeWebhook } from './routes/billing.js';
import alertsRoutes from './routes/alerts.js';

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// Derrière le reverse proxy OVH (Nginx) : nécessaire pour un rate-limit correct
// (IP réelle du client) et pour les cookies sécurisés éventuels.
if (isProd) app.set('trust proxy', 1);

// --- En-têtes de sécurité ---
app.use(helmet({
  // CSP désactivée : l'app charge des tuiles OpenStreetMap et des polices externes.
  // À réactiver avec une politique sur-mesure si besoin.
  contentSecurityPolicy: false,
  // Autorise le client (autre origine en dev) à afficher les photos de /uploads.
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// --- CORS ---
// En prod, on restreint à CLIENT_URL (séparer plusieurs origines par des virgules).
const allowedOrigins = (process.env.CLIENT_URL || '')
  .split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);                 // apps natives / curl
    if (!isProd) return cb(null, true);                 // tout autorisé en dev
    if (allowedOrigins.length === 0) return cb(null, true);
    return cb(null, allowedOrigins.includes(origin));
  }
}));

// Webhook Stripe : corps brut obligatoire pour vérifier la signature → avant express.json().
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

app.use(express.json({ limit: '12mb' }));

// --- Limitation de débit sur l'authentification (anti brute-force) ---
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 min
  max: 20,                    // 20 tentatives / IP / fenêtre
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans quelques minutes.' }
});
// S'applique au login, à l'inscription et aux routes de mot de passe.
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

// Fichiers statiques (photos)
app.use('/uploads', express.static(UPLOADS_DIR, {
  maxAge: '7d',
  fallthrough: false
}));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/spots', spotRoutes);
app.use('/api/finds', findRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/species', speciesRoutes);
app.use('/api/identifications', identificationRoutes);
app.use('/api/shares', sharesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/alerts', alertsRoutes);

const PORT = process.env.PORT || 4400;
getDb().then(() => {
  app.listen(PORT, () => console.log(`🌱 API sur http://0.0.0.0:${PORT}`));
});
