import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const DB_FILE = process.env.DATABASE_FILE || './myco.db';

let db;

/**
 * Ajoute une colonne si elle n'existe pas déjà (migration douce pour les
 * bases existantes — ex. celle qui tourne déjà sur l'Optiplex).
 */
async function ensureColumn(table, column, definition) {
  const cols = await db.all(`PRAGMA table_info(${table})`);
  if (!cols.some(c => c.name === column)) {
    await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export async function getDb() {
  if (db) return db;
  db = await open({ filename: DB_FILE, driver: sqlite3.Database });
  await db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      leaderboard_opt_in INTEGER DEFAULT 0,
      email_verified INTEGER DEFAULT 0,
      verification_token TEXT,
      verification_sent_at DATETIME,
      reset_token TEXT,
      reset_token_expires DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS spots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      radius_m INTEGER DEFAULT 50,
      is_public INTEGER DEFAULT 0,
      share_token TEXT UNIQUE,
      imported_from_share_id INTEGER,
      import_owner_display TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS finds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      spot_id INTEGER,
      species TEXT,
      weight_g INTEGER,
      photos_json TEXT DEFAULT '[]',
      notes TEXT,
      found_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (spot_id) REFERENCES spots(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS identifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      spot_id INTEGER,
      find_id INTEGER,
      provider TEXT NOT NULL,
      photo_url TEXT NOT NULL,
      primary_latin TEXT,
      primary_common_fr TEXT,
      confidence REAL,
      alternatives_json TEXT,
      inference_time_ms INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (spot_id) REFERENCES spots(id) ON DELETE SET NULL,
      FOREIGN KEY (find_id) REFERENCES finds(id) ON DELETE SET NULL
    );
  
    CREATE TABLE IF NOT EXISTS spot_shares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      spot_id INTEGER NOT NULL,
      from_user_id INTEGER NOT NULL,
      to_user_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      responded_at DATETIME,
      FOREIGN KEY (spot_id) REFERENCES spots(id) ON DELETE CASCADE,
      FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_shares_to_user ON spot_shares(to_user_id, status);
    CREATE INDEX IF NOT EXISTS idx_shares_from_user ON spot_shares(from_user_id, status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_shares_unique
      ON spot_shares(spot_id, from_user_id, to_user_id);

    -- Premium : abonnements push (navigateurs / PWA installées)
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      endpoint TEXT UNIQUE NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);

    -- Premium : alertes de poussée déjà envoyées (anti-doublon)
    CREATE TABLE IF NOT EXISTS flush_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      spot_id INTEGER NOT NULL,
      score INTEGER NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (spot_id) REFERENCES spots(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_flush_alerts ON flush_alerts(user_id, spot_id, sent_at);

    -- Cache météo par maille (~10 km) pour limiter les appels à l'API
    CREATE TABLE IF NOT EXISTS weather_cache (
      cell TEXT PRIMARY KEY,
      fetched_at DATETIME NOT NULL,
      data_json TEXT NOT NULL
    );
`);

  // --- Migrations douces pour les bases déjà existantes ---
  await ensureColumn('users', 'email_verified', 'INTEGER DEFAULT 0');
  await ensureColumn('users', 'verification_token', 'TEXT');
  await ensureColumn('users', 'verification_sent_at', 'DATETIME');
  await ensureColumn('users', 'reset_token', 'TEXT');
  await ensureColumn('users', 'reset_token_expires', 'DATETIME');

  // Premium (Stripe) et préférences d'alertes
  await ensureColumn('users', 'stripe_customer_id', 'TEXT');
  await ensureColumn('users', 'stripe_subscription_id', 'TEXT');
  await ensureColumn('users', 'subscription_status', 'TEXT');
  await ensureColumn('users', 'premium_until', 'DATETIME');
  await ensureColumn('users', 'alert_email', 'INTEGER DEFAULT 1');
  await ensureColumn('users', 'alert_push', 'INTEGER DEFAULT 0');

  return db;
}
