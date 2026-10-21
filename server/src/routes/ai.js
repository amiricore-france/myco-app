import { Router } from 'express';
import multer from 'multer';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import { getDb } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { stripImageMetadata } from '../lib/uploads.js';

const router = Router();

// ---------------------------------------------------------------
// Configuration stockage photos
// ---------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = join(__dirname, '..', '..', 'uploads');
if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10 Mo
});

const DISCLAIMER = "⚠️ Suggestion IA — aucune garantie. Ne consommez jamais un champignon identifié uniquement par une application. En cas de doute, abstenez-vous.";
const WARNING = "En cas de doute, abstenez-vous. Une erreur peut être mortelle.";

// ---------------------------------------------------------------
// Sauvegarde de la photo sur disque
// ---------------------------------------------------------------
function savePhoto(buffer, mimetype) {
  const ext = mimetype === 'image/png' ? 'png'
            : mimetype === 'image/webp' ? 'webp'
            : 'jpg';
  const filename = `${Date.now()}-${nanoid(8)}.${ext}`;
  writeFileSync(join(UPLOADS_DIR, filename), buffer);
  return `/uploads/${filename}`;
}

// ---------------------------------------------------------------
// Provider DEMO — réponse factice mais réaliste
// ---------------------------------------------------------------
async function identifyWithDemo(buffer, mimetype) {
  await new Promise(r => setTimeout(r, 1500));

  const samples = [
    {
      identified: true,
      confidence: 0.78,
      primary_species: { latin: 'Boletus edulis', common_fr: 'Cèpe de Bordeaux' },
      alternatives: [
        { latin: 'Boletus reticulatus', common_fr: "Cèpe d'été", confidence: 0.12 },
        { latin: 'Boletus pinophilus', common_fr: 'Cèpe des pins', confidence: 0.06 }
      ],
      observed_features: [
        'Chapeau brun noisette, lisse, légèrement visqueux par temps humide',
        'Pied ventru blanchâtre orné d’un réseau fin',
        'Tubes blancs puis jaune olivâtre, pores fins',
        'Chair blanche immuable à la coupe'
      ],
      habitat_guess: 'Forêt de feuillus (chênes, châtaigniers), sol acide',
      reasoning: 'Morphologie typique du genre Boletus : réseau sur le pied, pores fins, chair immuable. Correspondance forte avec B. edulis.'
    },
    {
      identified: true,
      confidence: 0.62,
      primary_species: { latin: 'Cantharellus cibarius', common_fr: 'Girolle' },
      alternatives: [
        { latin: 'Cantharellus tubaeformis', common_fr: 'Chanterelle en tube', confidence: 0.21 },
        { latin: 'Hygrophoropsis aurantiaca', common_fr: 'Fausse girolle (toxique)', confidence: 0.09 }
      ],
      observed_features: [
        'Chapeau jaune d’or, lobes irréguliers',
        'Plis épais, fourchus, descendant sur le pied',
        'Odeur d’abricot caractéristique'
      ],
      habitat_guess: 'Forêt de feuillus ou mixte, sol acide',
      reasoning: 'Plis épais et fourchus (et non des lames) : caractère diagnostique. Attention à la confusion avec la fausse girolle qui a de vraies lames.'
    },
    {
      identified: true,
      confidence: 0.44,
      primary_species: { latin: 'Amanita phalloides', common_fr: 'Amanite phalloïde (MORTELLE)' },
      alternatives: [
        { latin: 'Amanita citrina', common_fr: 'Amanite citrine', confidence: 0.31 },
        { latin: 'Agaricus campestris', common_fr: 'Rosé des prés', confidence: 0.15 }
      ],
      observed_features: [
        'Chapeau vert olive à reflets métalliques',
        'Lames blanches libres',
        'Anneau membraneux, volve blanche en sac',
        '⚠️ ESPÈCE MORTELLE — 90% des intoxications mortelles en France'
      ],
      habitat_guess: 'Forêt de feuillus (chênes surtout)',
      reasoning: 'Association chapeau verdâtre + lames blanches + anneau + volve = faisceau d’arguments en faveur d’A. phalloides. NE PAS CONSOMMER.'
    }
  ];

  const pick = samples[Math.floor(Math.random() * samples.length)];
  return {
    provider: 'demo',
    inference_time_ms: 1500,
    ...pick,
    warning: WARNING,
    disclaimer: DISCLAIMER
  };
}

// ---------------------------------------------------------------
// Provider BioCLIP (Python local, port 5000)
// ---------------------------------------------------------------
async function identifyWithBioCLIP(buffer, mimetype) {
  const url = process.env.BIOCLIP_URL || 'http://127.0.0.1:5000';
  const boundary = '----MycoBoundary' + Math.random().toString(16).slice(2);
  const filename = 'upload.jpg';

  const preamble = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${mimetype}\r\n\r\n`
  );
  const epilogue = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([preamble, buffer, epilogue]);

  const res = await fetch(`${url}/identify`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length
    },
    body
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`BioCLIP a repondu ${res.status}: ${txt.slice(0, 300)}`);
  }

  const data = await res.json();
  data.disclaimer = DISCLAIMER;
  if (!data.warning) data.warning = WARNING;
  return data;
}

// ---------------------------------------------------------------
// Provider OpenAI GPT-4o
// ---------------------------------------------------------------
async function identifyWithOpenAI(buffer, mimetype) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY manquant");

  const dataUrl = `data:${mimetype};base64,${buffer.toString('base64')}`;

  const systemPrompt = `Tu es un assistant d'identification de champignons. Tu aides a titre PEDAGOGIQUE uniquement.
Regles :
1. Propose l'espece la plus probable et 2-4 alternatives.
2. Donne les caracteres observables (chapeau, lames, pied, anneau, volve, habitat).
3. Ne dis JAMAIS qu'un champignon est comestible.
4. Termine par un avertissement.
Reponds UNIQUEMENT en JSON valide :
{"identified":bool,"confidence":0.0-1.0,"primary_species":{"latin":"","common_fr":""},"alternatives":[{"latin":"","common_fr":"","confidence":0.0}],"observed_features":[],"habitat_guess":null,"reasoning":"","warning":""}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: [
          { type: 'text', text: 'Identifie ce champignon. Reponds en JSON strict.' },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } }
        ]}
      ],
      max_tokens: 800,
      temperature: 0.2,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`OpenAI ${response.status}: ${txt.slice(0, 300)}`);
  }

  const json = await response.json();
  const parsed = JSON.parse(json.choices[0].message.content);
  parsed.provider = 'openai';
  parsed.disclaimer = DISCLAIMER;
  if (!parsed.warning) parsed.warning = WARNING;
  return parsed;
}

// ---------------------------------------------------------------
// Route principale
// ---------------------------------------------------------------
router.post('/identify', authRequired, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucune photo fournie' });

    // Retire les métadonnées (GPS…) avant envoi au fournisseur IA et sauvegarde.
    try {
      req.file.buffer = await stripImageMetadata(req.file.buffer);
    } catch {
      return res.status(400).json({ error: 'Image illisible ou format non pris en charge (JPEG, PNG ou WebP).' });
    }

    const provider = (process.env.AI_PROVIDER || 'demo').toLowerCase();
    let result;

    if (provider === 'demo') {
      result = await identifyWithDemo(req.file.buffer, req.file.mimetype);
    } else if (provider === 'bioclip') {
      result = await identifyWithBioCLIP(req.file.buffer, req.file.mimetype);
    } else if (provider === 'openai') {
      result = await identifyWithOpenAI(req.file.buffer, req.file.mimetype);
    } else {
      return res.status(500).json({ error: `AI_PROVIDER inconnu : ${provider}` });
    }

    // ---- Sauvegarde photo + identification ----
    try {
      const photoUrl = savePhoto(req.file.buffer, req.file.mimetype);
      const db = await getDb();

      const r = await db.run(
        `INSERT INTO identifications
         (user_id, spot_id, provider, photo_url, primary_latin, primary_common_fr,
          confidence, alternatives_json, inference_time_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        req.user.id,
        req.body.spot_id ? Number(req.body.spot_id) : null,
        result.provider || provider,
        photoUrl,
        result.primary_species?.latin || null,
        result.primary_species?.common_fr || null,
        result.confidence || null,
        JSON.stringify(result.alternatives || []),
        result.inference_time_ms || null
      );

      result.identification_id = r.lastID;
      result.photo_url = photoUrl;
    } catch (e) {
      console.error('Erreur sauvegarde identification:', e.message);
      // On n'échoue pas la requête, on renvoie quand même le résultat
    }

    res.json(result);
  } catch (err) {
    console.error('Erreur identification:', err.message);
    res.status(502).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// Status
// ---------------------------------------------------------------
router.get('/status', async (_req, res) => {
  const provider = (process.env.AI_PROVIDER || 'demo').toLowerCase();
  let bio = { reachable: false };

  if (provider === 'bioclip') {
    try {
      const r = await fetch((process.env.BIOCLIP_URL || 'http://127.0.0.1:5000') + '/health');
      bio = await r.json();
      bio.reachable = true;
    } catch { /* silencieux */ }
  }

  res.json({
    active_provider: provider,
    bioclip: bio,
    openai_configured: !!process.env.OPENAI_API_KEY,
    demo_active: provider === 'demo',
    disclaimer_required: true
  });
});

export default router;
