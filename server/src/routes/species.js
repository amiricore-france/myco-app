import { Router } from 'express';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const router = Router();

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '..', '..', '..', 'data', 'species.json');

let CACHE = null;

async function loadSpecies() {
  if (CACHE) return CACHE;
  const raw = await readFile(DATA_PATH, 'utf8');
  CACHE = JSON.parse(raw);
  return CACHE;
}

// Liste complète (public, sans auth — utile aussi pour le mode hors-ligne)
router.get('/', async (_req, res) => {
  try {
    const species = await loadSpecies();
    res.json(species);
  } catch (e) {
    console.error('Erreur lecture species.json:', e.message);
    res.status(500).json({ error: 'Impossible de charger la liste des espèces' });
  }
});

// Fiche d'une espèce par nom latin
router.get('/:latin', async (req, res) => {
  try {
    const species = await loadSpecies();
    const latin = decodeURIComponent(req.params.latin);
    const found = species.find(s => s.latin.toLowerCase() === latin.toLowerCase());
    if (!found) return res.status(404).json({ error: 'Espèce non trouvée' });
    res.json(found);
  } catch (e) {
    console.error('Erreur:', e.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
