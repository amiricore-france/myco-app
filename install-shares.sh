#!/usr/bin/env bash
# install-shares.sh — installe le module de partage de coins + top partageurs
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()   { echo -e "${GREEN}▶${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✖${NC} $1" >&2; exit 1; }

ROOT="$HOME/myco-app"
[ -d "$ROOT" ] || error "Dossier $ROOT introuvable"
[ -d "$ROOT/server/src" ] || error "$ROOT/server/src introuvable"
[ -d "$ROOT/client/src" ] || error "$ROOT/client/src introuvable"

cd "$ROOT"

# ------------------------------------------------------------------
# Backup rapide
# ------------------------------------------------------------------
BACKUP="$ROOT/.backup-$(date +%s)"
mkdir -p "$BACKUP/server/src/routes" "$BACKUP/client/src/components" "$BACKUP/client/src/pages"
cp -f server/src/db.js                "$BACKUP/server/src/" 2>/dev/null || true
cp -f server/src/index.js             "$BACKUP/server/src/" 2>/dev/null || true
cp -f server/src/routes/spots.js      "$BACKUP/server/src/routes/" 2>/dev/null || true
cp -f server/src/routes/stats.js      "$BACKUP/server/src/routes/" 2>/dev/null || true
cp -f client/src/App.jsx              "$BACKUP/client/src/" 2>/dev/null || true
cp -f client/src/components/Navbar.jsx     "$BACKUP/client/src/components/" 2>/dev/null || true
cp -f client/src/components/SpotEditor.jsx "$BACKUP/client/src/components/" 2>/dev/null || true
cp -f client/src/pages/Dashboard.jsx       "$BACKUP/client/src/pages/" 2>/dev/null || true
log "Backup dans $BACKUP"

# ------------------------------------------------------------------
# 1. server/src/db.js — ajouter table spot_shares
# ------------------------------------------------------------------
log "Mise à jour db.js (table spot_shares)"

if grep -q "spot_shares" server/src/db.js; then
  warn "spot_shares déjà présente dans db.js, on saute"
else
  # Insertion juste avant la fermeture du backtick final
  python3 - <<'PYEOF'
import re
p = 'server/src/db.js'
with open(p, 'r', encoding='utf-8') as f:
    content = f.read()

new_table = '''
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
'''

# Trouve le dernier ');' du bloc exec et insère avant la backtick fermante
marker = re.search(r"(CREATE TABLE IF NOT EXISTS finds[\s\S]*?\);\s*)`\)", content)
if marker:
    content = content[:marker.end(1)] + new_table + content[marker.end(1):]
    with open(p, 'w', encoding='utf-8') as f:
        f.write(content)
    print("OK")
else:
    # fallback : insère avant la dernière backtick du exec
    idx = content.rfind('`);')
    if idx == -1:
        print("FAIL")
    else:
        content = content[:idx] + new_table + content[idx:]
        with open(p, 'w', encoding='utf-8') as f:
            f.write(content)
        print("OK-fallback")
PYEOF
fi

# ------------------------------------------------------------------
# 2. server/src/routes/users.js — nouveau
# ------------------------------------------------------------------
log "Création server/src/routes/users.js"
cat > server/src/routes/users.js <<'JS'
import { Router } from 'express';
import { getDb } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

router.get('/lookup', authRequired, async (req, res) => {
  const email = (req.query.email || '').trim().toLowerCase();
  if (!email || email.length < 3) {
    return res.status(400).json({ error: 'Email trop court' });
  }
  const db = await getDb();
  const user = await db.get(
    'SELECT id, email, name FROM users WHERE LOWER(email) = ?',
    email
  );
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  if (user.id === req.user.id) return res.status(400).json({ error: 'Vous ne pouvez pas vous partager un coin à vous-même' });

  const display_name = user.name || user.email.split('@')[0];
  res.json({ id: user.id, email: user.email, display_name });
});

export default router;
JS

# ------------------------------------------------------------------
# 3. server/src/routes/shares.js — nouveau
# ------------------------------------------------------------------
log "Création server/src/routes/shares.js"
cat > server/src/routes/shares.js <<'JS'
import { Router } from 'express';
import { getDb } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

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
  if (existing) {
    return res.status(409).json({
      error: existing.status === 'pending' ? 'Un partage est déjà en attente pour cet utilisateur'
           : existing.status === 'accepted' ? 'Cet utilisateur a déjà accepté ce coin'
           : 'Vous avez déjà partagé ce coin avec cet utilisateur (refusé)'
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

router.get('/sent', authRequired, async (req, res) => {
  const db = await getDb();
  const rows = await db.all(
    `SELECT sh.*, s.name AS spot_name, u.email AS to_email, u.name AS to_name
     FROM spot_shares sh
     JOIN spots s ON s.id = sh.spot_id
     JOIN users u ON u.id = sh.to_user_id
     WHERE sh.from_user_id = ? ORDER BY sh.created_at DESC`,
    req.user.id
  );
  res.json(rows.map(r => ({ ...r, to_display_name: r.to_name || r.to_email.split('@')[0] })));
});

router.get('/pending-count', authRequired, async (req, res) => {
  const db = await getDb();
  const row = await db.get(
    `SELECT COUNT(*) AS count FROM spot_shares WHERE to_user_id = ? AND status = 'pending'`,
    req.user.id
  );
  res.json({ count: row.count });
});

router.post('/:id/accept', authRequired, async (req, res) => {
  const db = await getDb();
  const share = await db.get(
    `SELECT * FROM spot_shares WHERE id = ? AND to_user_id = ? AND status = 'pending'`,
    req.params.id, req.user.id
  );
  if (!share) return res.status(404).json({ error: 'Partage introuvable ou déjà traité' });

  const source = await db.get('SELECT * FROM spots WHERE id = ?', share.spot_id);
  if (!source) return res.status(404).json({ error: "Le coin source n'existe plus" });

  const result = await db.run(
    `INSERT INTO spots (user_id, name, description, lat, lng, radius_m, is_public, share_token)
     VALUES (?, ?, ?, ?, ?, ?, 0, NULL)`,
    req.user.id, source.name, source.description, source.lat, source.lng, source.radius_m
  );

  await db.run(
    `UPDATE spot_shares SET status = 'accepted', responded_at = CURRENT_TIMESTAMP WHERE id = ?`,
    share.id
  );

  const newSpot = await db.get('SELECT * FROM spots WHERE id = ?', result.lastID);
  res.json({ ok: true, spot: newSpot });
});

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

router.delete('/:id', authRequired, async (req, res) => {
  const db = await getDb();
  const share = await db.get(
    'SELECT * FROM spot_shares WHERE id = ? AND from_user_id = ?',
    req.params.id, req.user.id
  );
  if (!share) return res.status(404).json({ error: 'Partage introuvable' });

  await db.run('DELETE FROM spot_shares WHERE id = ?', share.id);
  res.json({ ok: true });
});

export default router;
JS

# ------------------------------------------------------------------
# 4. server/src/routes/stats.js — ajouter /top-sharers
# ------------------------------------------------------------------
log "Ajout /top-sharers dans stats.js"
if grep -q "top-sharers" server/src/routes/stats.js; then
  warn "top-sharers déjà présent, on saute"
else
  python3 - <<'PYEOF'
p = 'server/src/routes/stats.js'
with open(p, 'r', encoding='utf-8') as f:
    content = f.read()

addition = '''
router.get('/top-sharers', authRequired, async (_req, res) => {
  const db = await getDb();
  const rows = await db.all(
    `SELECT u.id, u.email, u.name, COUNT(sh.id) AS share_count
     FROM users u
     JOIN spot_shares sh ON sh.from_user_id = u.id AND sh.status = 'accepted'
     GROUP BY u.id
     ORDER BY share_count DESC, u.id ASC
     LIMIT 10`
  );
  res.json(rows.map(r => ({
    id: r.id,
    display_name: r.name || r.email.split('@')[0],
    share_count: r.share_count
  })));
});

'''

# Insère avant "export default router;"
idx = content.rfind('export default router;')
if idx == -1:
    print("FAIL")
else:
    content = content[:idx] + addition + content[idx:]
    with open(p, 'w', encoding='utf-8') as f:
        f.write(content)
    print("OK")
PYEOF
fi

# ------------------------------------------------------------------
# 5. server/src/index.js — monter shares + users
# ------------------------------------------------------------------
log "Mise à jour server/src/index.js"
if grep -q "sharesRoutes" server/src/index.js; then
  warn "sharesRoutes déjà monté, on saute"
else
  python3 - <<'PYEOF'
p = 'server/src/index.js'
with open(p, 'r', encoding='utf-8') as f:
    content = f.read()

# Ajoute les imports après identificationRoutes
if "import identificationRoutes" in content:
    content = content.replace(
        "import identificationRoutes from './routes/identifications.js';",
        "import identificationRoutes from './routes/identifications.js';\nimport sharesRoutes from './routes/shares.js';\nimport usersRoutes from './routes/users.js';"
    )
else:
    # fallback : ajoute après le dernier import
    idx = content.rfind("import ")
    end = content.find("\n", idx) + 1
    content = content[:end] + "import sharesRoutes from './routes/shares.js';\nimport usersRoutes from './routes/users.js';\n" + content[end:]

# Ajoute les app.use
if "app.use('/api/identifications'" in content:
    content = content.replace(
        "app.use('/api/identifications', identificationRoutes);",
        "app.use('/api/identifications', identificationRoutes);\napp.use('/api/shares', sharesRoutes);\napp.use('/api/users', usersRoutes);"
    )
else:
    content = content.replace(
        "app.get('/health'",
        "app.use('/api/shares', sharesRoutes);\napp.use('/api/users', usersRoutes);\napp.get('/health'"
    )

with open(p, 'w', encoding='utf-8') as f:
    f.write(content)
print("OK")
PYEOF
fi

# ------------------------------------------------------------------
# 6. client/src/components/ShareSpotPanel.jsx — nouveau
# ------------------------------------------------------------------
log "Création client/src/components/ShareSpotPanel.jsx"
cat > client/src/components/ShareSpotPanel.jsx <<'JSX'
import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function ShareSpotPanel({ spot }) {
  const [sent, setSent] = useState([]);
  const [email, setEmail] = useState('');
  const [found, setFound] = useState(null);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function loadSent() {
    try {
      const all = await api('/shares/sent');
      setSent(all.filter(s => s.spot_id === spot.id));
    } catch (e) { console.error(e); }
  }

  useEffect(() => { loadSent(); }, [spot.id]);

  useEffect(() => {
    setFound(null); setErr(''); setMsg('');
    const value = email.trim().toLowerCase();
    if (value.length < 3 || !value.includes('@')) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const u = await api(`/users/lookup?email=${encodeURIComponent(value)}`, { silent401: true });
        setFound(u);
      } catch (e) {
        if (e.message.includes('introuvable')) setErr('Aucun utilisateur inscrit avec cet email');
        else if (e.message.includes('vous-même')) setErr('Vous ne pouvez pas vous partager un coin à vous-même');
      } finally { setSearching(false); }
    }, 400);
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [email]);

  async function send() {
    if (!found) return;
    setSending(true); setErr(''); setMsg('');
    try {
      await api('/shares', { method: 'POST', body: { spot_id: spot.id, to_email: found.email } });
      setMsg(`Demande de partage envoyée à ${found.display_name}`);
      setEmail(''); setFound(null);
      loadSent();
      window.dispatchEvent(new CustomEvent('shares:changed'));
    } catch (e) { setErr(e.message); }
    finally { setSending(false); }
  }

  async function revoke(id) {
    if (!confirm('Révoquer ce partage ?')) return;
    try {
      await api(`/shares/${id}`, { method: 'DELETE' });
      loadSent();
      window.dispatchEvent(new CustomEvent('shares:changed'));
    } catch (e) { setErr(e.message); }
  }

  return (
    <div style={{ padding: '.9rem', background: '#f9faf7', border: '1px solid #dfe5db', borderRadius: 8, marginBottom: '.75rem' }}>
      <strong>👥 Partager ce coin avec un autre utilisateur</strong>
      <p style={{ fontSize: '.8rem', color: '#666', margin: '.25rem 0 .75rem' }}>
        Le destinataire recevra une demande qu'il pourra accepter ou refuser.
      </p>

      <div className="row" style={{ flexWrap: 'wrap' }}>
        <input
          type="email"
          placeholder="email@exemple.fr"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <button type="button" onClick={send} disabled={!found || sending}>
          {sending ? '⏳ Envoi…' : '📤 Envoyer'}
        </button>
      </div>

      {searching && <p style={{ fontSize: '.8rem', color: '#888', margin: '.25rem 0 0' }}>Recherche…</p>}
      {found && !searching && (
        <p style={{ fontSize: '.85rem', color: '#2e6b3e', margin: '.35rem 0 0' }}>
          ✓ Trouvé : <strong>{found.display_name}</strong> ({found.email})
        </p>
      )}
      {err && <p style={{ color: 'crimson', margin: '.35rem 0 0', fontSize: '.85rem' }}>{err}</p>}
      {msg && <p style={{ color: '#2e6b3e', margin: '.35rem 0 0', fontSize: '.85rem' }}>✓ {msg}</p>}

      {sent.length > 0 && (
        <div style={{ marginTop: '1rem', paddingTop: '.75rem', borderTop: '1px solid #e3e8df' }}>
          <strong style={{ fontSize: '.85rem' }}>Partages en cours pour ce coin :</strong>
          <ul style={{ margin: '.5rem 0 0', paddingLeft: '1.2rem', fontSize: '.85rem' }}>
            {sent.map(s => (
              <li key={s.id} style={{ marginBottom: '.35rem' }}>
                <strong>{s.to_display_name}</strong> ({s.to_email}) —{' '}
                <span style={{
                  color: s.status === 'accepted' ? '#2e6b3e'
                       : s.status === 'declined' ? '#b23b3b'
                       : '#8a6a00'
                }}>
                  {s.status === 'pending' ? '⏳ en attente'
                   : s.status === 'accepted' ? '✓ accepté'
                   : '✗ refusé'}
                </span>{' '}
                <button
                  type="button"
                  className="secondary"
                  onClick={() => revoke(s.id)}
                  style={{ padding: '.1rem .4rem', fontSize: '.75rem', marginLeft: '.25rem' }}
                >
                  Révoquer
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
JSX

# ------------------------------------------------------------------
# 7. client/src/components/SpotEditor.jsx — intégrer ShareSpotPanel
# ------------------------------------------------------------------
log "Mise à jour client/src/components/SpotEditor.jsx"
cat > client/src/components/SpotEditor.jsx <<'JSX'
import { useState } from 'react';
import { api } from '../api.js';
import ShareSpotPanel from './ShareSpotPanel.jsx';

export default function SpotEditor({ spot, onUpdated, onDeleted, onCancel }) {
  const [name, setName] = useState(spot.name);
  const [description, setDescription] = useState(spot.description || '');
  const [radius, setRadius] = useState(spot.radius_m || 50);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function save(e) {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      const updated = await api(`/spots/${spot.id}`, {
        method: 'PUT',
        body: { name, description, radius_m: Number(radius) }
      });
      onUpdated(updated);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!confirm(`Supprimer le coin "${spot.name}" ?`)) return;
    try {
      await api(`/spots/${spot.id}`, { method: 'DELETE' });
      onDeleted(spot.id);
    } catch (e) { setErr(e.message); }
  }

  return (
    <div className="card" style={{ borderLeft: '4px solid #2e6b3e' }}>
      <div className="row between" style={{ marginBottom: '.5rem' }}>
        <h3 style={{ margin: 0 }}>✏️ Modifier le coin</h3>
        <button className="secondary" type="button" onClick={onCancel}>✕</button>
      </div>

      <p style={{ fontSize: '.85rem', color: '#666', marginTop: 0 }}>
        📍 {spot.lat.toFixed(5)}, {spot.lng.toFixed(5)}
      </p>

      <form onSubmit={save}>
        <label>
          <span>Nom du coin *</span>
          <input required value={name} onChange={e => setName(e.target.value)} />
        </label>
        <label>
          <span>Description</span>
          <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} />
        </label>
        <label>
          <span>Rayon (m)</span>
          <input type="number" min="10" max="1000" value={radius} onChange={e => setRadius(e.target.value)} />
        </label>

        {err && <p style={{ color: 'crimson' }}>{err}</p>}

        <div className="row" style={{ marginTop: '1rem', flexWrap: 'wrap' }}>
          <button type="submit" disabled={saving}>
            {saving ? '⏳ Enregistrement…' : '💾 Enregistrer'}
          </button>
          <button type="button" className="secondary" onClick={onCancel}>Annuler</button>
          <button type="button" className="danger" onClick={remove}>🗑 Supprimer</button>
        </div>
      </form>

      <div style={{ marginTop: '1.25rem' }}>
        <ShareSpotPanel spot={spot} />
      </div>
    </div>
  );
}
JSX

# ------------------------------------------------------------------
# 8. client/src/pages/Shares.jsx — nouveau
# ------------------------------------------------------------------
log "Création client/src/pages/Shares.jsx"
cat > client/src/pages/Shares.jsx <<'JSX'
import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Shares() {
  const [tab, setTab] = useState('received');
  const [received, setReceived] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([api('/shares/received'), api('/shares/sent')]);
      setReceived(r); setSent(s);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function accept(id) {
    try { await api(`/shares/${id}/accept`, { method: 'POST' }); await load(); window.dispatchEvent(new CustomEvent('shares:changed')); }
    catch (e) { setError(e.message); }
  }
  async function decline(id) {
    if (!confirm('Refuser ce partage ?')) return;
    try { await api(`/shares/${id}/decline`, { method: 'POST' }); await load(); window.dispatchEvent(new CustomEvent('shares:changed')); }
    catch (e) { setError(e.message); }
  }
  async function revoke(id) {
    if (!confirm('Révoquer ce partage ?')) return;
    try { await api(`/shares/${id}`, { method: 'DELETE' }); await load(); window.dispatchEvent(new CustomEvent('shares:changed')); }
    catch (e) { setError(e.message); }
  }

  function statusBadge(status) {
    const map = {
      pending:  { label: '⏳ En attente', color: '#8a6a00', bg: '#fff7e6' },
      accepted: { label: '✓ Accepté',    color: '#2e6b3e', bg: '#e7f4ea' },
      declined: { label: '✗ Refusé',     color: '#b23b3b', bg: '#fbe8e8' }
    };
    const s = map[status] || map.pending;
    return <span style={{ padding: '.15rem .55rem', borderRadius: 6, fontSize: '.8rem', fontWeight: 600, color: s.color, background: s.bg }}>{s.label}</span>;
  }

  if (loading) return <div className="container">Chargement…</div>;

  const pendingCount = received.filter(r => r.status === 'pending').length;

  return (
    <div className="container">
      <h2>Partages de coins</h2>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <div className="row" style={{ marginBottom: '1rem' }}>
        <button type="button" onClick={() => setTab('received')} className={tab === 'received' ? '' : 'secondary'}>
          📥 Reçus {pendingCount > 0 && `(${pendingCount} en attente)`}
        </button>
        <button type="button" onClick={() => setTab('sent')} className={tab === 'sent' ? '' : 'secondary'}>
          📤 Envoyés
        </button>
      </div>

      {tab === 'received' && (
        received.length === 0
          ? <div className="card"><p style={{ color: '#666' }}>Aucun partage reçu pour l'instant.</p></div>
          : received.map(sh => (
            <div key={sh.id} className="card" style={{
              borderLeft: sh.status === 'pending' ? '4px solid #f0c674'
                        : sh.status === 'accepted' ? '4px solid #2e6b3e'
                        : '4px solid #b23b3b'
            }}>
              <div className="row between">
                <h3 style={{ margin: 0 }}>🍄 {sh.spot_name}</h3>
                {statusBadge(sh.status)}
              </div>
              <p style={{ color: '#666', fontSize: '.9rem', margin: '.35rem 0' }}>
                De <strong>{sh.from_display_name}</strong> ({sh.from_email}) — {new Date(sh.created_at).toLocaleDateString('fr-FR')}
              </p>
              {sh.spot_description && <p style={{ fontSize: '.9rem' }}>{sh.spot_description}</p>}
              <p style={{ fontSize: '.85rem', color: '#666' }}>
                📍 {sh.lat.toFixed(5)}, {sh.lng.toFixed(5)} — rayon {sh.radius_m} m
              </p>
              {sh.status === 'pending' && (
                <div className="row" style={{ marginTop: '.5rem' }}>
                  <button onClick={() => accept(sh.id)}>✓ Accepter et ajouter à mes coins</button>
                  <button className="secondary" onClick={() => decline(sh.id)}>✗ Refuser</button>
                </div>
              )}
              {sh.status === 'accepted' && <p style={{ color: '#2e6b3e', fontSize: '.9rem', margin: '.5rem 0 0' }}>✓ Ajouté à vos coins</p>}
            </div>
          ))
      )}

      {tab === 'sent' && (
        sent.length === 0
          ? <div className="card"><p style={{ color: '#666' }}>Vous n'avez encore partagé aucun coin. Allez sur la carte, ouvrez un coin, et cliquez sur « Partager ».</p></div>
          : sent.map(sh => (
            <div key={sh.id} className="card">
              <div className="row between">
                <h3 style={{ margin: 0 }}>🍄 {sh.spot_name}</h3>
                {statusBadge(sh.status)}
              </div>
              <p style={{ color: '#666', fontSize: '.9rem', margin: '.35rem 0' }}>
                Envoyé à <strong>{sh.to_display_name}</strong> ({sh.to_email}) — {new Date(sh.created_at).toLocaleDateString('fr-FR')}
              </p>
              <div className="row" style={{ marginTop: '.5rem' }}>
                <button className="danger" onClick={() => revoke(sh.id)}>Révoquer</button>
              </div>
            </div>
          ))
      )}
    </div>
  );
}
JSX

# ------------------------------------------------------------------
# 9. client/src/components/Navbar.jsx — badge
# ------------------------------------------------------------------
log "Mise à jour Navbar.jsx (badge partages)"
cat > client/src/components/Navbar.jsx <<'JSX'
import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);

  async function refreshCount() {
    if (!user) return setPendingCount(0);
    try {
      const data = await api('/shares/pending-count', { silent401: true });
      setPendingCount(data.count || 0);
    } catch { setPendingCount(0); }
  }

  useEffect(() => { refreshCount(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const t = setInterval(refreshCount, 30000);
    function onChange() { refreshCount(); }
    window.addEventListener('shares:changed', onChange);
    return () => { clearInterval(t); window.removeEventListener('shares:changed', onChange); };
  }, [user]);

  return (
    <nav>
      <strong>🍄 Myco</strong>
      {user && (
        <>
          <NavLink to="/">Carte</NavLink>
          <NavLink to="/spots">Mes coins</NavLink>
          <NavLink to="/shares">
            Partages{pendingCount > 0 && (
              <span style={{
                marginLeft: '.35rem', background: '#f0c674', color: '#5a3c00',
                borderRadius: '50%', padding: '.05rem .4rem',
                fontSize: '.75rem', fontWeight: 700
              }}>{pendingCount}</span>
            )}
          </NavLink>
          <NavLink to="/dashboard">Tableau de bord</NavLink>
        </>
      )}
      <div className="spacer" />
      {user ? (
        <>
          <span style={{ opacity: 0.8 }}>{user.email}</span>
          <button className="secondary" onClick={() => { logout(); navigate('/login'); }}>
            Déconnexion
          </button>
        </>
      ) : (
        <NavLink to="/login">Connexion</NavLink>
      )}
    </nav>
  );
}
JSX

# ------------------------------------------------------------------
# 10. client/src/App.jsx — route /shares
# ------------------------------------------------------------------
log "Mise à jour App.jsx (route /shares)"
cat > client/src/App.jsx <<'JSX'
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Navbar from './components/Navbar.jsx';
import Login from './pages/Login.jsx';
import MapPage from './pages/Map.jsx';
import Spots from './pages/Spots.jsx';
import Dashboard from './pages/Dashboard.jsx';
import SharedSpot from './pages/SharedSpot.jsx';
import Shares from './pages/Shares.jsx';

function Private({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="container">Chargement…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/shared/:token" element={<SharedSpot />} />
        <Route path="/" element={<Private><MapPage /></Private>} />
        <Route path="/spots" element={<Private><Spots /></Private>} />
        <Route path="/shares" element={<Private><Shares /></Private>} />
        <Route path="/dashboard" element={<Private><Dashboard /></Private>} />
        <Route path="*" element={<Navigate to="/"