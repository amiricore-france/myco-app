import { existsSync, unlinkSync, mkdirSync } from 'fs';
import { join, dirname, basename, resolve, sep } from 'path';
import { fileURLToPath } from 'url';

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
