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

    -- Sécurité en sortie : proches à prévenir (non-utilisateurs possibles)
    CREATE TABLE IF NOT EXISTS emergency_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_unique ON emergency_contacts(user_id, email);

    -- Sorties : point de départ, véhicule, dernière position, suivi par les proches.
    -- Les dates sont en UTC ISO 8601 (comparables en texte).
    CREATE TABLE IF NOT EXISTS outings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      client_id TEXT NOT NULL,
      follow_token TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',      -- active | ended | expired
      share_live INTEGER NOT NULL DEFAULT 1,      -- position transmise au serveur et visible des proches
      alert_on_silence INTEGER NOT NULL DEFAULT 1,
      started_at TEXT NOT NULL,
      expected_return_at TEXT,
      ended_at TEXT,
      start_lat REAL, start_lng REAL,
      car_lat REAL, car_lng REAL,
      last_lat REAL, last_lng REAL, last_accuracy REAL, last_at TEXT,
      battery INTEGER,
      sos_at TEXT,
      reminder_sent_at TEXT,
      overdue_notified_at TEXT,
      silence_notified_at TEXT,
      silence_recovered_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_outings_client ON outings(user_id, client_id);
    CREATE INDEX IF NOT EXISTS idx_outings_status ON outings(status);

    CREATE TABLE IF NOT EXISTS outing_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      outing_id INTEGER NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      accuracy REAL,
      recorded_at TEXT NOT NULL,
      FOREIGN KEY (outing_id) REFERENCES outings(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_points_unique ON outing_points(outing_id, recorded_at);

    -- Signalements de danger (chasse, travaux…) : actifs le jour même (heure de Paris),
    -- puis conservés DANGER_RETENTION_DAYS jours comme historique. L'auteur n'est jamais
    -- montré aux autres ; user_id sert à la modération et passe à NULL si le compte est supprimé.
    CREATE TABLE IF NOT EXISTS danger_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      type TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      comment TEXT,
      day TEXT NOT NULL,
      created_at TEXT NOT NULL,
      ended_at TEXT,
      confirmations INTEGER NOT NULL DEFAULT 0,
      abuse_count INTEGER NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_danger_day ON danger_reports(day);
    CREATE INDEX IF NOT EXISTS idx_danger_pos ON danger_reports(lat, lng);

    CREATE TABLE IF NOT EXISTS danger_votes (
      report_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (report_id, user_id, kind),
      FOREIGN KEY (report_id) REFERENCES danger_reports(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Notifications « danger près de vos coins » déjà envoyées (plafond quotidien)
    CREATE TABLE IF NOT EXISTS danger_push_log (
      user_id INTEGER NOT NULL,
      report_id INTEGER NOT NULL,
      sent_at TEXT NOT NULL,
      PRIMARY KEY (user_id, report_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (report_id) REFERENCES danger_reports(id) ON DELETE CASCADE
    );

    -- Proches prévenus pour une sortie donnée (copie figée nom/e-mail)
    CREATE TABLE IF NOT EXISTS outing_contacts (
      outing_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      PRIMARY KEY (outing_id, email),
      FOREIGN KEY (outing_id) REFERENCES outings(id) ON DELETE CASCADE
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
  await ensureColumn('users', 'alert_email', 'INTEGER DEFAULT 0');
  await ensureColumn('users', 'alert_push', 'INTEGER DEFAULT 0');
  // Notification push quand un danger est signalé à moins d'1 km d'un de mes coins
  await ensureColumn('users', 'danger_push', 'INTEGER DEFAULT 1');

  return db;
}
