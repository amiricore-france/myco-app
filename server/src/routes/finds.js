import { Router } from 'express';
import multer from 'multer';
import { nanoid } from 'nanoid';
import { getDb } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { UPLOADS_DIR, safeUnlinkUpload, stripUploadedFiles } from '../lib/uploads.js';

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = file.mimetype === 'image/png' ? 'png'
              : file.mimetype === 'image/webp' ? 'webp'
              : 'jpg';
    cb(null, `${Date.now()}-${nanoid(8)}.${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Fichier image requis'));
    }
    cb(null, true);
  }
});

function parsePhotos(json) {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

router.get('/', authRequired, async (req, res) => {
  const db = await getDb();
  const rows = await db.all(
    `SELECT f.*, s.name AS spot_name FROM finds f
     LEFT JOIN spots s ON s.id = f.spot_id
     WHERE f.user_id = ? ORDER BY f.found_at DESC LIMIT 500`,
    req.user.id
  );
  res.json(rows.map(r => ({ ...r, photos: parsePhotos(r.photos_json) })));
});

router.post('/', authRequired, upload.array('photos', 5), stripUploadedFiles, async (req, res) => {
  const { spot_id, species, weight_g, notes, found_at } = req.body;
  const uploadedPhotos = (req.files || []).map(f => `/uploads/${f.filename}`);

  const db = await getDb();
  const r = await db.run(
    `INSERT INTO finds (user_id, spot_id, species, weight_g, photos_json, notes, found_at)
     VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
    req.user.id,
    spot_id ? Number(spot_id) : null,
    species || null,
    weight_g ? Number(weight_g) : null,
    JSON.stringify(uploadedPhotos),
    notes || null,
    found_at || null
  );

  const find = await db.get('SELECT * FROM finds WHERE id = ?', r.lastID);
  res.json({ ...find, photos: parsePhotos(find.photos_json) });
});

// ⭐ NOUVELLE ROUTE — Modifier une cueillette
router.put('/:id', authRequired, async (req, res) => {
  const db = await getDb();
  const find = await db.get(
    'SELECT * FROM finds WHERE id = ? AND user_id = ?',
    req.params.id, req.user.id
  );
  if (!find) return res.status(404).json({ error: 'Cueillette introuvable' });

  const { species, weight_g, spot_id, notes } = req.body;

  await db.run(
    `UPDATE finds SET species = ?, weight_g = ?, spot_id = ?, notes = ? WHERE id = ?`,
    species !== undefined ? species : find.species,
    weight_g !== undefined ? (weight_g === null || weight_g === '' ? null : Number(weight_g)) : find.weight_g,
    spot_id !== undefined ? (spot_id === null || spot_id === '' ? null : Number(spot_id)) : find.spot_id,
    notes !== undefined ? notes : find.notes,
    find.id
  );

  const updated = await db.get('SELECT * FROM finds WHERE id = ?', find.id);
  res.json({ ...updated, photos: parsePhotos(updated.photos_json) });
});

router.post('/:id/photos', authRequired, upload.array('photos', 5), stripUploadedFiles, async (req, res) => {
  const db = await getDb();
  const find = await db.get(
    'SELECT * FROM finds WHERE id = ? AND user_id = ?',
    req.params.id, req.user.id
  );
  if (!find) return res.status(404).json({ error: 'Cueillette introuvable' });

  const existing = parsePhotos(find.photos_json);
  const added = (req.files || []).map(f => `/uploads/${f.filename}`);
  const all = [...existing, ...added].slice(0, 5);

  await db.run('UPDATE finds SET photos_json = ? WHERE id = ?', JSON.stringify(all), find.id);
  res.json({ ...find, photos: all });
});

router.delete('/:id/photos/:filename', authRequired, async (req, res) => {
  const db = await getDb();
  const find = await db.get(
    'SELECT * FROM finds WHERE id = ? AND user_id = ?',
    req.params.id, req.user.id
  );
  if (!find) return res.status(404).json({ error: 'Cueillette introuvable' });

  const url = `/uploads/${req.params.filename}`;
  const current = parsePhotos(find.photos_json);

  // Sécurité : on ne supprime le fichier que s'il appartient bien à cette cueillette.
  if (!current.includes(url)) {
    return res.status(404).json({ error: 'Photo introuvable pour cette cueillette' });
  }
  const photos = current.filter(p => p !== url);

  safeUnlinkUpload(url);

  await db.run('UPDATE finds SET photos_json = ? WHERE id = ?', JSON.stringify(photos), find.id);
  res.json({ ...find, photos });
});

router.delete('/:id', authRequired, async (req, res) => {
  const db = await getDb();
  const find = await db.get(
    'SELECT * FROM finds WHERE id = ? AND user_id = ?',
    req.params.id, req.user.id
  );
  if (!find) return res.status(404).json({ error: 'Cueillette introuvable' });

  for (const url of parsePhotos(find.photos_json)) {
    safeUnlinkUpload(url);
  }

  await db.run('DELETE FROM finds WHERE id = ?', find.id);
  res.json({ ok: true });
});

export default router;
