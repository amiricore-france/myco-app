import { existsSync, unlinkSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname, basename, resolve, sep } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Dossier uploads unique, partagé par toutes les routes.
export const UPLOADS_DIR = join(__dirname, '..', '..', 'uploads');
if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });

/**
 * Transforme une URL "/uploads/xxx.jpg" ou un nom de fichier en chemin absolu
 * SÛR, garanti à l'intérieur de UPLOADS_DIR. Retourne null si la cible sort
 * du dossier (tentative de traversée de chemin : "../", chemin absolu, etc.).
 */
export function safeUploadPath(nameOrUrl) {
  if (!nameOrUrl || typeof nameOrUrl !== 'string') return null;
  // On ne garde que le nom de fichier final : neutralise "../", "/", etc.
  const name = basename(nameOrUrl.replace(/^\/uploads\//, ''));
  if (!name || name === '.' || name === '..') return null;

  const resolved = resolve(UPLOADS_DIR, name);
  // Double garde : le chemin résolu doit rester sous UPLOADS_DIR.
  if (resolved !== UPLOADS_DIR && !resolved.startsWith(UPLOADS_DIR + sep)) {
    return null;
  }
  return resolved;
}

/**
 * Supprime un fichier d'upload en toute sécurité.
 * Ne fait rien (sans erreur) si le chemin est invalide ou le fichier absent.
 */
export function safeUnlinkUpload(nameOrUrl) {
  const filepath = safeUploadPath(nameOrUrl);
  if (!filepath) {
    console.warn('Chemin de fichier refusé (hors uploads):', nameOrUrl);
    return false;
  }
  try {
    if (existsSync(filepath)) unlinkSync(filepath);
    return true;
  } catch (e) {
    console.warn('Impossible de supprimer le fichier:', e.message);
    return false;
  }
}

/**
 * Réencode une image sans ses métadonnées (EXIF, dont la position GPS qui
 * révélerait l'emplacement d'un coin). L'orientation EXIF est appliquée aux
 * pixels avant suppression pour que la photo reste dans le bon sens.
 * Lève une erreur si le contenu n'est pas une image lisible.
 */
export function stripImageMetadata(input) {
  return sharp(input).rotate().toBuffer();
}

/**
 * Nettoie sur place les fichiers reçus par multer (req.files).
 * En cas d'image illisible, supprime tous les fichiers reçus et répond 400.
 */
export async function stripUploadedFiles(req, res, next) {
  const files = req.files || [];
  try {
    for (const f of files) {
      writeFileSync(f.path, await stripImageMetadata(f.path));
    }
    next();
  } catch (e) {
    console.warn('Image refusée:', e.message);
    for (const f of files) safeUnlinkUpload(f.filename);
    res.status(400).json({ error: 'Image illisible ou format non pris en charge (JPEG, PNG ou WebP).' });
  }
}
