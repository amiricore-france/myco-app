import { useRef, useState } from 'react';
import SpeciesCard from './SpeciesCard.jsx';

// Mapping latin → français pour les espèces les plus communes en France.
// Sert uniquement à l'affichage : la source de vérité complète est dans data/species.json
const COMMON_NAMES = {
  'Boletus edulis': 'Cèpe de Bordeaux',
  'Boletus pinophilus': 'Cèpe des pins',
  'Boletus reticulatus': "Cèpe d'été",
  'Leccinum scabrum': 'Bolet rude',
  'Leccinum aurantiacum': 'Bolet orangé',
  'Xerocomus subtomentosus': 'Bolet moucheté',
  'Suillus luteus': 'Bolet jaune',
  'Suillus granulatus': 'Bolet granulé',
  'Cantharellus cibarius': 'Girolle',
  'Cantharellus tubaeformis': 'Chanterelle en tube',
  'Craterellus cornucopioides': 'Trompette de la mort',
  'Lactarius deliciosus': 'Lactaire délicieux',
  'Lactarius sanguifluus': 'Lactaire sanguin',
  'Russula emetica': 'Russule émétique (toxique)',
  'Russula virescens': 'Russule verdoyante',
  'Russula cyanoxantha': 'Russule charbonnière',
  'Amanita phalloides': 'Amanite phalloïde (MORTELLE)',
  'Amanita virosa': 'Amanite vireuse (MORTELLE)',
  'Amanita muscaria': 'Amanite tue-mouches (toxique)',
  'Amanita rubescens': 'Amanite rougissante',
  'Amanita caesarea': 'Amanite des Césars',
  'Amanita vaginata': 'Amanite vaginée',
  'Tricholoma equestre': 'Tricholome équestre (toxique)',
  'Tricholoma portentosum': 'Tricholome prétentieux',
  'Armillaria mellea': 'Armillaire couleur de miel',
  'Marasmius oreades': 'Marasme des Oréades',
  'Pleurotus ostreatus': 'Pleurote en huître',
  'Agaricus campestris': 'Rosé des prés',
  'Macrolepiota procera': 'Coulemelle (Lépiote élevée)',
  'Morchella esculenta': 'Morille comestible',
  'Morchella conica': 'Morille conique',
  'Gyromitra esculenta': 'Gyromitre (toxique)',
  'Coprinus comatus': 'Coprin chevelu',
  'Lycoperdon perlatum': 'Vesse-de-loup perlée',
  'Hydnum repandum': 'Pied-de-mouton',
  'Clitocybe nebularis': 'Clitocybe nébuleux',
  'Clitocybe dealbata': 'Clitocybe blanc (toxique)',
  'Paxillus involutus': 'Paxille enroulé (mortel)',
  'Cortinarius orellanus': 'Cortinaire des montagnes (MORTEL)',
  'Cortinarius rubellus': 'Cortinaire couleur de rouille (MORTEL)',
  'unknown species': 'Espèce inconnue',
};

function frenchName(latin) {
  return COMMON_NAMES[latin] || null;
}

function formatPct(score) {
  const pct = (score || 0) * 100;
  if (pct === 0) return '0 %';
  if (pct < 0.01) return '< 0,01 %';
  if (pct < 0.1) return pct.toFixed(3).replace('.', ',') + ' %';
  if (pct < 1) return pct.toFixed(2).replace('.', ',') + ' %';
  if (pct < 99.99) return pct.toFixed(1).replace('.', ',') + ' %';
  return pct.toFixed(2).replace('.', ',') + ' %';
}

export default function AiIdentify({ onSpeciesSuggested }) {
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [justAdded, setJustAdded] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [openSpecies, setOpenSpecies] = useState(null);
  const inputRef = useRef(null);
  const cameraRef = useRef(null);

  function handleFile(f) {
    if (!f) return;
    setFile(f);
    setResult(null);
    setError('');
    setJustAdded(false);
    setOpenSpecies(null);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target.result);
    reader.readAsDataURL(f);
  }

  function onFileInput(e) { handleFile(e.target.files?.[0]); }
  function onCameraInput(e) { handleFile(e.target.files?.[0]); }

  async function analyze() {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('photo', file);

      const token = localStorage.getItem('token');
      const res = await fetch('/api/ai/identify', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erreur inconnue' }));
        throw new Error(err.error || 'Erreur');
      }

      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setPreview(null);
    setFile(null);
    setResult(null);
    setError('');
    setJustAdded(false);
    setOpenSpecies(null);
  }

  function useSuggestion() {
    if (!result?.primary_species?.latin || !onSpeciesSuggested) return;

    onSpeciesSuggested(result.primary_species.latin);
    setJustAdded(true);

    setTimeout(() => {
      const el = document.getElementById('add-find-form');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);

    setTimeout(() => setJustAdded(false), 2000);
  }

  return (
    <div className="card" style={{ borderLeft: '4px solid #2e6b3e' }}>
      <h3 style={{ marginTop: 0 }}>🔬 Analyse IA d'une photo</h3>

      {/* Avertissement AVANT toute action — conformité ANSES */}
      <div style={{
        padding: '.6rem .9rem',
        background: '#fdeaea',
        border: '1px solid #e6a0a0',
        borderRadius: 8,
        marginBottom: '.9rem',
        fontSize: '.85rem',
        color: '#8a2020'
      }}>
        <strong>⚠️ À lire avant de commencer</strong><br />
        L'IA suggère une espèce, <strong>jamais une garantie</strong>. Ne consommez JAMAIS un
        champignon identifié uniquement par une application. L'ANSES a documenté 50 % d'erreurs
        dans ce type d'outil.
      </div>

      <div className="row" style={{ marginBottom: '.75rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => cameraRef.current?.click()}>
          📷 Prendre une photo
        </button>
        <button type="button" className="secondary" onClick={() => inputRef.current?.click()}>
          🖼️ Importer une image
        </button>
        {(file || result) && (
          <button type="button" className="secondary" onClick={reset}>Réinitialiser</button>
        )}
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onCameraInput}
        style={{ display: 'none' }}
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onFileInput}
        style={{ display: 'none' }}
      />

      {preview && (
        <div style={{ marginBottom: '1rem' }}>
          <img
            src={preview}
            alt="Aperçu"
            onClick={() => setZoom(true)}
            style={{
              maxWidth: '100%', maxHeight: 320, borderRadius: 8,
              display: 'block', cursor: 'zoom-in'
            }}
          />
        </div>
      )}

      {file && !result && (
        <button type="button" onClick={analyze} disabled={loading}>
          {loading ? '⏳ Analyse en cours…' : "🔬 Analyser avec l'IA"}
        </button>
      )}

      {error && <p style={{ color: 'crimson', marginTop: '1rem' }}>{error}</p>}

      {result && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{
            padding: '.75rem 1rem',
            background: '#fff7e6',
            border: '1px solid #f0c674',
            borderRadius: 8,
            marginBottom: '1rem'
          }}>
            <strong style={{ color: '#8a5a00' }}>⚠️ {result.disclaimer}</strong>
          </div>

          <p style={{ fontSize: '.8rem', color: '#888', marginTop: '-.5rem' }}>
            Moteur : <code>{result.provider}</code>
            {result.inference_time_ms && ` — ${result.inference_time_ms} ms`}
          </p>

          {result.identified === false ? (
            <p><em>Identification impossible : {result.reasoning}</em></p>
          ) : (
            <>
              <h4 style={{ margin: '.5rem 0' }}>
                Espèce probable :{' '}
                <button
                  type="button"
                  onClick={() => setOpenSpecies(result.primary_species.latin)}
                  style={{
                    background: 'none', border: 'none', padding: 0, margin: 0,
                    color: '#2e6b3e', textDecoration: 'underline', cursor: 'pointer',
                    font: 'inherit', fontStyle: 'italic'
                  }}
                >
                  {result.primary_species.latin}
                </button>
                {frenchName(result.primary_species?.latin) && (
                  <> — {frenchName(result.primary_species.latin)}</>
                )}
              </h4>
              <p style={{ color: '#666', fontSize: '.9rem' }}>
                Confiance : {formatPct(result.confidence)}
              </p>

              {result.alternatives?.length > 0 && (
                <>
                  <strong>Alternatives :</strong>
                  <ul>
                    {result.alternatives.map((a, i) => {
                      const fr = frenchName(a.latin);
                      return (
                        <li key={i}>
                          <button
                            type="button"
                            onClick={() => setOpenSpecies(a.latin)}
                            style={{
                              background: 'none', border: 'none', padding: 0, margin: 0,
                              color: '#2e6b3e', textDecoration: 'underline', cursor: 'pointer',
                              font: 'inherit', fontStyle: 'italic'
                            }}
                          >
                            {a.latin}
                          </button>
                          {fr && ` — ${fr}`} ({formatPct(a.confidence)})
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}

              {result.observed_features?.length > 0 && (
                <>
                  <strong>Caractères observés :</strong>
                  <ul>
                    {result.observed_features.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </>
              )}

              {result.reasoning && (
                <p style={{ fontSize: '.9rem', color: '#555' }}>
                  <strong>Raisonnement :</strong> {result.reasoning}
                </p>
              )}

              {onSpeciesSuggested && result.primary_species?.latin && (
                <button
                  type="button"
                  onClick={useSuggestion}
                  disabled={justAdded}
                  style={{
                    marginTop: '.5rem',
                    background: justAdded ? '#2e6b3e' : undefined,
                    opacity: justAdded ? 0.85 : 1
                  }}
                >
                  {justAdded
                    ? '✓ Espèce ajoutée au formulaire'
                    : '➕ Utiliser cette espèce pour une trouvaille'}
                </button>
              )}

              {openSpecies && (
                <SpeciesCard latin={openSpecies} onClose={() => setOpenSpecies(null)} />
              )}
            </>
          )}
        </div>
      )}

      {zoom && preview && (
        <div
          onClick={() => setZoom(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, cursor: 'zoom-out', padding: '2rem'
          }}
        >
          <img
            src={preview}
            alt="Aperçu agrandi"
            style={{ maxWidth: '95%', maxHeight: '95%', borderRadius: 8 }}
          />
        </div>
      )}
    </div>
  );
}
