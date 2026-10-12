import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './db.js';
import authRoutes from './routes/auth.js';
import spotRoutes from './routes/spots.js';
import findRoutes from './routes/finds.js';
import statsRoutes from './routes/stats.js';
import aiRoutes from './routes/ai.js';
import speciesRoutes from './routes/species.js';
import identificationRoutes from './routes/identifications.js';
import sharesRoutes from './routes/shares.js';
import usersRoutes from './routes/users.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = join(__dirname, '..', 'uploads');
if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json({ limit: '12mb' }));

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

const PORT = process.env.PORT || 4400;
getDb().then(() => {
  app.listen(PORT, () => console.log(`🌱 API sur http://localhost:${PORT}`));
});
