#!/usr/bin/env bash
# fix-revocation.sh — A1 (suppression franche) + B1 (trouvailles déliées)
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()   { echo -e "${GREEN}▶${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✖${NC} $1" >&2; exit 1; }

ROOT="$HOME/myco-app"
[ -d "$ROOT" ] || error "Dossier $ROOT introuvable"
cd "$ROOT"

# --- Backup ---
BACKUP="$ROOT/.backup-revocation-$(date +%s)"
mkdir -p "$BACKUP/server/src/routes" "$BACKUP/client/src/components" "$BACKUP/client/src/pages"
cp -f server/src/db.js                    "$BACKUP/server/src/" 2>/dev/null || true
cp -f server/src/routes/shares.js         "$BACKUP/server/src/routes/" 2>/dev/null || true
cp -f server/src/routes/spots.js          "$BACKUP/server/src/routes/" 2>/dev/null || true
cp -f client/src/pages/Spots.jsx          "$BACKUP/client/src/pages/" 2>/dev/null || true
cp -f server/myco.db                      "$BACKUP/server/" 2>/dev/null || true
log "Backup dans $BACKUP"

# ------------------------------------------------------------------
# 1. Migration : ajouter imported_from_share_id + import_owner_display
# ------------------------------------------------------------------
log "Migration base de donnees"

sqlite3 "$ROOT/server/myco.db" <<'SQL'
-- Ajoute la colonne sur spots si elle n'existe pas deja
PRAGMA table_info(spots);
SQL

HAS_COL=$(sqlite3 "$ROOT/server/myco.db" "PRAGMA table_info(spots);" | grep -c "imported_from_share_id" || true)

if [ "$HAS_COL" = "0" ]; then
  sqlite3 "$ROOT/server/myco.db" <<'SQL'
ALTER TABLE spots ADD COLUMN imported_from_share_id INTEGER;
ALTER TABLE spots ADD COLUMN import_owner_display TEXT;
SQL
  log "Colonnes ajoutees : imported_from_share_id, import_owner_display"
else
  warn "Colonnes deja presentes, on saute"
fi

# ------------------------------------------------------------------
# 2. db.js — ajouter les colonnes dans la definition (pour les fresh installs)
# ------------------------------------------------------------------
log "Mise a jour db.js"

python3 - <<'PYEOF'
p = 'server/src/db.js'
with open(p, 'r', encoding='utf-8') as f:
    content = f.read()

if 'imported_from_share_id' in content:
    print("deja present")
else:
    # Ajoute les 2 colonnes dans la table spots
    old = """      is_public INTEGER DEFAULT 0,
      share_token TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,"""
    new = """      is_public INTEGER DEFAULT 0,
      share_token TEXT UNIQUE,
      imported_from_share_id INTEGER,
      import_owner_display TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,"""
    if old in content:
        content = content.replace(old, new)
        with open(p, 'w', encoding='utf-8') as f:
            f.write(content)
        print("OK")
    else:
        # Fallback : insere avant la ligne FOREIGN KEY de spots
        idx = content.find('FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE')
        if idx > -1:
            content = content[:idx] + "      imported_from_share_id INTEGER,\n      import_owner_display TEXT,\n      " + content[idx:]
            with open(p, 'w', encoding='utf-8') as f:
                f.write(content)
            print("OK-fallback")
        else:
            print("FAIL")
PYEOF

# ------------------------------------------------------------------
# 3. shares.js — modifier accept + delete
# ------------------------------------------------------------------
log "Mise a jour shares.js"

cat > server/src/routes/shares.js <<'JS'
import { Router } from 'express';
import { getDb } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

// --- Envoyer un partage ---
router.post('/', authRequired, async (req, res) => {
  const { spot_id, to_email } = req.body;
  if (!spot_id || !to_email) return res.status(400).json({ error: 'spot_id et to_email requis' });

  const db = await getDb();
  const spot = await db.get('SELECT * FROM spots WHERE id = ? AND user_id = ?', spot_id, req.user.id);
  if (!spot) return res.status(404).json({ error: 'Coin introuvable ou non autorisé' });

  const dest = await db.get('SELECT id, email, name FROM users WHERE LOWER(email) = ?', to_email.trim().toLowerCase());
  if (!dest) return res.status(404).json({ error: 'Aucun utilisateur avec cet email' });
  if (dest.id === req.user.id) return res.status(400).json({ error: 'Impossible de partager avec vous-même' });

  const existing = await db.get(
    'SELECT id, status FROM spot_shares WHERE spot_id = ? AND from_user_id = ? AND to_user_id = ?',
    spot_id, req.user.id, dest.id
  );
  if (existing && existing.status !== 'declined') {
    return res.status(409).json({
      error: existing.status === 'pending' ? 'Un partage est déjà en attente pour cet utilisateur'
           : 'Cet utilisateur a déjà accepté ce coin'
    });
  }

  // Si un partage 'declined' existe, on le réinitialise en 'pending'
  if (existing && existing.status === 'declined') {
    await db.run(
      `UPDATE spot_shares SET status = 'pending', created_at = CURRENT_TIMESTAMP, responded_at = NULL WHERE id = ?`,
      existing.id
    );
    return res.json({
      id: existing.id, spot_id, to_user_id: dest.id, to_email: dest.email,
      to_display_name: dest.name || dest.email.split('@')[0],
      status: 'pending'
    });
  }

  const r = await db.run(
    `INSERT INTO spot_shares (spot_id, from_user_id, to_user_id, status) VALUES (?, ?, ?, 'pending')`,
    spot_id, req.user.id, dest.id
  );

  res.json({
    id: r.lastID, spot_id, to_user_id: dest.id, to_email: dest.email,
    to_display_name: dest.name || dest.email.split('@')[0],
    status: 'pending'
  });
});

// --- Liste reçus ---
router.get('/received', authRequired, async (req, res) => {
  const db = await getDb();
  const rows = await db.all(
    `SELECT sh.*, s.name AS spot_name, s.description AS spot_description,
            s.lat, s.lng, s.radius_m, u.email AS from_email, u.name AS from_name
     FROM spot_shares sh
     JOIN spots s ON s.id = sh.spot_id
     JOIN users u ON u.id = sh.from_user_id
     WHERE sh.to_user_id = ? ORDER BY sh.created_at DESC`,
    req.user.id
  );
  res.json(rows.map(r => ({ ...r, from_display_name: r.from_name || r.from_email.split('@')[0] })));
});

// --- Liste envoyés ---
router.get('/sent', authRequired, async (req, res) => {
  const db = await getDb();
  const rows = await db.all(
    `SELECT sh.*, s.name AS spot_name, u.email AS to_email, u.name AS to_name
     FROM spot_shares sh
     JOIN spots s ON s.id = sh.spot_id
     JOIN users u ON u.id = sh.to_user_id
     WHERE sh.from_user_id = ? AND sh.status != 'revoked'
     ORDER BY sh.created_at DESC`,
    req.user.id
  );
  res.json(rows.map(r => ({ ...r, to_display_name: r.to_name || r.to_email.split('@')[0] })));
});

// --- Compte en attente ---
router.get('/pending-count', authRequired, async (req, res) => {
  const db = await getDb();
  const row = await db.get(
    `SELECT COUNT(*) AS count FROM spot_shares WHERE to_user_id = ? AND status = 'pending'`,
    req.user.id
  );
  res.json({ count: row.count });
});

// --- Accepter : copie le coin et marque la reference au partage ---
router.post('/:id/accept', authRequired, async (req, res) => {
  const db = await getDb();
  const share = await db.get(
    `SELECT * FROM spot_shares WHERE id = ? AND to_user_id = ? AND status = 'pending'`,
    req.params.id, req.user.id
  );
  if (!share) return res.status(404).json({ error: 'Partage introuvable ou déjà traité' });

  const source = await db.get('SELECT * FROM spots WHERE id = ?', share.spot_id);
  if (!source) return res.status(404).json({ error: "Le coin source n'existe plus" });

  // Nom d'affichage du partageur
  const owner = await db.get('SELECT email, name FROM users WHERE id = ?', share.from_user_id);
  const ownerDisplay = owner?.name || owner?.email?.split('@')[0] || 'un utilisateur';

  // Copie chez le destinataire avec la référence au partage
  const result = await db.run(
    `INSERT INTO spots (user_id, name, description, lat, lng, radius_m, is_public, share_token,
                        imported_from_share_id, import_owner_display)
     VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)`,
    req.user.id, source.name, source.description, source.lat, source.lng, source.radius_m,
    share.id, ownerDisplay
  );

  await db.run(
    `UPDATE spot_shares SET status = 'accepted', responded_at = CURRENT_TIMESTAMP WHERE id = ?`,
    share.id
  );

  const newSpot = await db.get('SELECT * FROM spots WHERE id = ?', result.lastID);
  res.json({ ok: true, spot: newSpot });
});

// --- Refuser ---
router.post('/:id/decline', authRequired, async (req, res) => {
  const db = await getDb();
  const share = await db.get(
    `SELECT * FROM spot_shares WHERE id = ? AND to_user_id = ? AND status = 'pending'`,
    req.params.id, req.user.id
  );
  if (!share) return res.status(404).json({ error: 'Partage introuvable ou déjà traité' });

  await db.run(
    `UPDATE spot_shares SET status = 'declined', responded_at = CURRENT_TIMESTAMP WHERE id = ?`,
    share.id
  );
  res.json({ ok: true });
});

// --- Révoquer : A1 (supprime la copie) + B1 (délie les trouvailles) ---
router.delete('/:id', authRequired, async (req, res) => {
  const db = await getDb();
  const share = await db.get(
    'SELECT * FROM spot_shares WHERE id = ? AND from_user_id = ?',
    req.params.id, req.user.id
  );
  if (!share) return res.status(404).json({ error: 'Partage introuvable' });

  // A1 : si accepté, supprime la copie chez le destinataire
  if (share.status === 'accepted') {
    const copies = await db.all(
      'SELECT id FROM spots WHERE imported_from_share_id = ?',
      share.id
    );

    for (const copy of copies) {
      // B1 : délie les trouvailles (spot_id -> NULL)
      await db.run('UPDATE finds SET spot_id = NULL WHERE spot_id = ?', copy.id);
      // A1 : supprime la copie
      await db.run('DELETE FROM spots WHERE id = ?', copy.id);
    }
  }

  // Supprime le partage lui-même
  await db.run('DELETE FROM spot_shares WHERE id = ?', share.id);
  res.json({ ok: true });
});

export default router;
JS

# ------------------------------------------------------------------
# 4. spots.js — exposer imported_from_share_id dans la reponse
# ------------------------------------------------------------------
log "Mise a jour spots.js (exposer imported_from_share_id)"

python3 - <<'PYEOF'
p = 'server/src/routes/spots.js'
with open(p, 'r', encoding='utf-8') as f:
    content = f.read()

# La route GET / retourne deja SELECT * donc les nouvelles colonnes sont incluses automatiquement.
# On ne touche rien si SELECT * est present.
if 'SELECT * FROM spots WHERE user_id' in content:
    print("OK - SELECT * deja utilise, rien a changer")
else:
    print("WARN - verifier manuellement la route GET /")
PYEOF

# ------------------------------------------------------------------
# 5. Front : indicateur visuel dans Mes coins
# ------------------------------------------------------------------
log "Mise a jour client/src/pages/Spots.jsx (badge 'recu de X')"

cat > client/src/pages/Spots.jsx <<'JSX'
import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Spots() {
  const [spots, setSpots] = useState([]);
  const [finds, setFinds] = useState([]);

  useEffect(() => {
    api('/spots').then(setSpots).catch(() => {});
    api('/finds').then(setFinds).catch(() => {});
  }, []);

  async function remove(id) {
    if (!confirm('Supprimer ce coin ?')) return;
    await api(`/spots/${id}`, { method: 'DELETE' });
    setSpots(spots.filter(s => s.id !== id));
  }

  return (
    <div className="container">
      <h2>Mes coins ({spots.length})</h2>

      {spots.length === 0 && <p>Aucun coin enregistré pour l'instant.</p>}

      {spots.map(spot => {
        const spotFinds = finds.filter(f => f.spot_id === spot.id);
        const totalG = spotFinds.reduce((s, f) => s + (f.weight_g || 0), 0);
        const isImported = !!spot.imported_from_share_id;

        return (
          <div key={spot.id} className="card" style={{
            borderLeft: isImported ? '4px solid #8a6a00' : undefined
          }}>
            <div className="row between">
              <h3 style={{ margin: 0 }}>
                {spot.name}
                {isImported && (
                  <span style={{
                    marginLeft: '.5rem',
                    padding: '.15rem .55rem',
                    borderRadius: 6,
                    fontSize: '.75rem',
                    fontWeight: 600,
                    background: '#fff7e6',
                    color: '#8a5a00',
                    verticalAlign: 'middle'
                  }}>
                    🔗 reçu de {spot.import_owner_display || 'un utilisateur'}
                  </span>
                )}
              </h3>
              <button className="danger" onClick={() => remove(spot.id)}>Supprimer</button>
            </div>
            {spot.description && <p>{spot.description}</p>}
            <p style={{ fontSize: '.9rem', color: '#555' }}>
              📍 {spot.lat.toFixed(4)}, {spot.lng.toFixed(4)} — rayon {spot.radius_m} m<br />
              🍄 {spotFinds.length} trouvaille(s) — {(totalG / 1000).toFixed(2)} kg
            </p>
            {isImported && (
              <p style={{ fontSize: '.8rem', color: '#8a6a00', margin: '.25rem 0 0' }}>
                ⓘ Ce coin vous a été partagé. Son propriétaire peut le révoquer à tout moment.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
JSX

# ------------------------------------------------------------------
# 6. Front : message informatif dans la page Partages reçus acceptés
# ------------------------------------------------------------------
log "Mise a jour client/src/pages/Shares.jsx (message 'peut etre revoque')"

python3 - <<'PYEOF'
p = 'client/src/pages/Shares.jsx'
with open(p, 'r', encoding='utf-8') as f:
    content = f.read()

old = """              {sh.status === 'accepted' && <p style={{ color: '#2e6b3e', fontSize: '.9rem', margin: '.5rem 0 0' }}>✓ Ajouté à vos coins</p>}"""
new = """              {sh.status === 'accepted' && (
                <div style={{ marginTop: '.5rem' }}>
                  <p style={{ color: '#2e6b3e', fontSize: '.9rem', margin: 0 }}>
                    ✓ Ajouté à vos coins
                  </p>
                  <p style={{ color: '#8a6a00', fontSize: '.8rem', margin: '.25rem 0 0' }}>
                    ⓘ Le partageur peut révoquer ce partage à tout moment : le coin disparaîtra alors
                    de vos coins (vos trouvailles seront conservées mais détachées du coin).
                  </p>
                </div>
              )}"""

if old in content:
    content = content.replace(old, new)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(content)
    print("OK")
else:
    print("WARN - pattern non trouve, ajoutez le message manuellement")
PYEOF

# ------------------------------------------------------------------
# 7. Fin
# ------------------------------------------------------------------
echo ""
log "✅ Correction de la révocation installée"
echo ""
echo "  Redémarrez Node :"
echo "    cd ~/myco-app && ./start-dev.sh"
echo ""
echo "  Comportement attendu :"
echo "  - Révocation d'un partage accepté → le coin disparaît chez le destinataire"
echo "  - Les trouvailles du destinataire sont conservées mais détachées"
echo "  - Un badge '🔗 reçu de X' apparaît sur les coins importés"
echo ""