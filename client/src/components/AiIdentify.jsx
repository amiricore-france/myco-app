import { useRef, useState } from 'react';
import {
  Camera, ImageIcon, Loader2, RotateCcw, Sparkles, X, Plus,
  AlertTriangle, Info
} from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import SpeciesCard from './SpeciesCard.jsx';

// Mapping latin → français (affichage local, source de vérité : data/species.json)
const COMMON_NAMES = {
  'Boletus edulis': 'Cèpe de Bordeaux',
  'Boletus pinophilus': 'Cèpe des pins',
  'Boletus reticulatus': "Cèpe d'été",
  'Leccinum scabrum': 'Bolet rude',
  'Leccinum aurantiacum': 'Bolet orangé',
  'Cantharellus cibarius': 'Girolle',
  'Cantharellus tubaeformis': 'Chanterelle en tube',
  'Craterellus cornucopioides': 'Trompette de la mort',
  'Lactarius deliciosus': 'Lactaire délicieux',
  'Russula virescens': 'Russule verdoyante',
  'Amanita phalloides': 'Amanite phalloïde (MORTELLE)',
  'Amanita muscaria': 'Amanite tue-mouches (toxique)',
  'Amanita rubescens': 'Amanite rougissante',
  'Marasmius oreades': 'Marasme des Oréades',
  'Agaricus campestris': 'Rosé des prés',
  'Macrolepiota procera': 'Coulemelle (Lépiote élevée)',
  'Morchella esculenta': 'Morille comestible',
  'Gyromitra esculenta': 'Gyromitre (toxique)',
  'Coprinus comatus': 'Coprin chevelu',
  'Lycoperdon perlatum': 'Vesse-de-loup perlée',
  'Hydnum repandum': 'Pied-de-mouton',
  'Pleurotus ostreatus': 'Pleurote en huître',
  'Paxillus involutus': 'Paxille enroulé (mortel)',
  'Cortinarius orellanus': 'Cortinaire des montagnes (MORTEL)',
  'unknown species': 'Espèce inconnue',
};

const frenchName = latin => COMMON_NAMES[latin] || null;

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

  const onFileInput = e => handleFile(e.target.files?.[0]);
  const onCameraInput = e => handleFile(e.target.files?.[0]);

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
    <div className="mb-4 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 bg-neutral-50 px-5 py-4 sm:px-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
          <Sparkles className="h-5 w-5 text-primary-600" />
          Analyse IA d'une photo
        </h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          Prenez ou importez une photo. L'IA suggère une espèce — <strong>jamais une garantie</strong>.
        </p>
      </div>

      {/* Bandeau ANSES — toujours visible */}
      <div className="mx-5 mt-4 flex items-start gap-3 rounded-lg border border-danger-200 bg-danger-50 p-3.5 text-sm text-danger-900 sm:mx-6">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div>
          <strong>À lire avant de commencer</strong>
          <p className="mt-0.5 text-danger-800">
            Ne consommez JAMAIS un champignon identifié uniquement par une application.
            L'ANSES a documenté 50 % d'erreurs dans ce type d'outil.
          </p>
        </div>
      </div>

      {/* Zone d'action / upload */}
      <div className="p-5 sm:p-6">
        {/* Boutons d'action */}
        {!preview && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              size="xl"
              onClick={() => cameraRef.current?.click()}
              className="w-full"
            >
              <Camera className="h-5 w-5" />
              Prendre une photo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xl"
              onClick={() => inputRef.current?.click()}
              className="w-full"
            >
              <ImageIcon className="h-5 w-5" />
              Importer une image
            </Button>
          </div>
        )}

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

        {/* Aperçu photo */}
        {preview && (
          <div className="space-y-3">
            <div className="relative inline-block">
              <img
                src={preview}
                alt="Aperçu"
                onClick={() => setZoom(true)}
                className="block max-h-80 max-w-full cursor-zoom-in rounded-lg border border-neutral-200 object-contain"
              />
              <button
                type="button"
                onClick={reset}
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900/70 text-white backdrop-blur hover:bg-neutral-900"
                aria-label="Retirer la photo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!result && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  size="lg"
                  onClick={analyze}
                  disabled={loading}
                  className="w-full sm:w-auto"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Analyse en cours…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5" />
                      Analyser avec l'IA
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  onClick={reset}
                  disabled={loading}
                >
                  <RotateCcw className="h-4 w-4" />
                  Réinitialiser
                </Button>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-900">
            {error}
          </div>
        )}

        {/* Résultat */}
        {result && (
          <div className="mt-5 space-y-4">
            {/* Bandeau disclaimer fourni par l'API */}
            <div className="flex items-start gap-3 rounded-lg border border-warning-300 bg-warning-50 p-3.5 text-sm text-warning-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{result.disclaimer}</span>
            </div>

            {/* Meta moteur */}
            <p className="text-xs text-neutral-500">
              Moteur : <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px]">{result.provider}</code>
              {result.inference_time_ms && ` — ${result.inference_time_ms} ms`}
            </p>

            {result.identified === false ? (
              <div className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3.5 text-sm text-neutral-700">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <em>Identification impossible : {result.reasoning}</em>
              </div>
            ) : (
              <>
                {/* Espèce probable */}
                <div>
                  <div className="mb-1 text-sm font-semibold text-neutral-700">
                    Espèce probable
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenSpecies(result.primary_species.latin)}
                    className="text-xl font-semibold italic text-primary-700 underline-offset-2 hover:underline"
                  >
                    {result.primary_species.latin}
                  </button>
                  {frenchName(result.primary_species?.latin) && (
                    <span className="ml-2 text-lg text-neutral-700">
                      — {frenchName(result.primary_species.latin)}
                    </span>
                  )}

                  <div className="mt-2 flex items-center gap-3">
                    <Progress
                      value={(result.confidence || 0) * 100}
                      className="h-1.5 max-w-xs flex-1"
                    />
                    <span className="font-mono text-sm tabular-nums text-neutral-600">
                      {formatPct(result.confidence)}
                    </span>
                  </div>
                </div>

                {/* Alternatives */}
                {result.alternatives?.length > 0 && (
                  <div>
                    <div className="mb-2 text-sm font-semibold text-neutral-700">
                      Alternatives
                    </div>
                    <ul className="space-y-1.5 text-sm">
                      {result.alternatives.map((a, i) => {
                        const fr = frenchName(a.latin);
                        return (
                          <li key={i} className="flex items-baseline justify-between gap-3">
                            <span>
                              <button
                                type="button"
                                onClick={() => setOpenSpecies(a.latin)}
                                className="italic text-primary-700 underline-offset-2 hover:underline"
                              >
                                {a.latin}
                              </button>
                              {fr && <span className="text-neutral-600"> — {fr}</span>}
                            </span>
                            <span className="flex-shrink-0 font-mono text-xs tabular-nums text-neutral-500">
                              {formatPct(a.confidence)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Caractères observés */}
                {result.observed_features?.length > 0 && (
                  <div>
                    <div className="mb-1.5 text-sm font-semibold text-neutral-700">
                      Caractères observés
                    </div>
                    <ul className="list-disc space-y-0.5 pl-5 text-sm text-neutral-600">
                      {result.observed_features.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  </div>
                )}

                {/* Raisonnement */}
                {result.reasoning && (
                  <p className="text-sm text-neutral-600">
                    <strong className="text-neutral-800">Raisonnement :</strong> {result.reasoning}
                  </p>
                )}

                {/* Bouton d'ajout */}
                {onSpeciesSuggested && result.primary_species?.latin && (
                  <Button
                    type="button"
                    onClick={useSuggestion}
                    disabled={justAdded}
                    size="lg"
                    variant={justAdded ? 'secondary' : 'default'}
                    className="w-full sm:w-auto"
                  >
                    {justAdded ? (
                      <>✓ Espèce ajoutée au formulaire</>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Utiliser cette espèce pour une cueillette
                      </>
                    )}
                  </Button>
                )}
              </>
            )}

            {/* Fiche espèce détaillée */}
            {openSpecies && (
              <SpeciesCard latin={openSpecies} onClose={() => setOpenSpecies(null)} />
            )}
          </div>
        )}
      </div>

      {/* Zoom plein écran */}
      {zoom && preview && (
        <div
          onClick={() => setZoom(false)}
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/85 p-4"
        >
          <img
            src={preview}
            alt="Aperçu agrandi"
            className="max-h-[95vh] max-w-[95vw] rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setZoom(false)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur hover:bg-white/30"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
