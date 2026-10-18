import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

let db;
export async function getDb() {
  if (db) return db;
  db = await open({ filename: './myco.db', driver: sqlite3.Database });
  await db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      leaderboard_opt_in INTEGER DEFAULT 0,
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
`);
  return db;
}
