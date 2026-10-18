import { useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { api } from '../api.js';
import { toast } from '../lib/toast-store';
import { useConfirm } from '../hooks/useConfirm';

const COMMON_NAMES = {
  'Boletus edulis': 'Cèpe de Bordeaux',
  'Boletus pinophilus': 'Cèpe des pins',
  'Boletus reticulatus': "Cèpe d'été",
  'Cantharellus cibarius': 'Girolle',
  'Cantharellus tubaeformis': 'Chanterelle en tube',
  'Craterellus cornucopioides': 'Trompette de la mort',
  'Lactarius deliciosus': 'Lactaire délicieux',
  'Amanita phalloides': 'Amanite phalloïde (MORTELLE)',
  'Amanita muscaria': 'Amanite tue-mouches (toxique)',
  'Amanita rubescens': 'Amanite rougissante',
  'Macrolepiota procera': 'Coulemelle (Lépiote élevée)',
  'Marasmius oreades': 'Marasme des Oréades',
  'Agaricus campestris': 'Rosé des prés',
  'Coprinus comatus': 'Coprin chevelu',
  'Morchella esculenta': 'Morille comestible',
  'Hydnum repandum': 'Pied-de-mouton',
  'Pleurotus ostreatus': 'Pleurote en huître',
};

function frenchName(latin) {
  return COMMON_NAMES[latin] || null;
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch { return '—'; }
}

export default function IdentificationsHistory({ onSelectSpecies }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const confirm = useConfirm();

  async function load() {
    setLoading(true);
    try {
      const data = await api('/identifications');
      setItems(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function remove(id) {
    const ok = await confirm({
      title: 'Supprimer cette identification ?',
      description: 'La photo sera également supprimée du disque.',
      confirmLabel: 'Supprimer',
    });
    if (!ok) return;

    setDeleting(id);
    try {
      await api(`/identifications/${id}`, { method: 'DELETE' });
      setItems(items.filter(i => i.id !== id));
      toast.success('Identification supprimée');
    } catch (e) {
      toast.error('Erreur', e.message);
    } finally {
      setDeleting(null);
    }
  }

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">📚 Historique des identifications</h3>
        <p className="text-sm text-neutral-500">
          {items.length} analyse{items.length > 1 ? 's' : ''} enregistrée{items.length > 1 ? 's' : ''}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map(item => {
          const fr = frenchName(item.primary_latin);
          const isDeleting = deleting === item.id;

          return (
            <div
              key={item.id}
              className={`relative overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 transition-opacity ${isDeleting ? 'opacity-50' : ''}`}
            >
              <button
                type="button"
                onClick={() => setZoom(item.photo_url)}
                className="block w-full cursor-zoom-in bg-neutral-200"
              >
                <img
                  src={item.photo_url}
                  alt={item.primary_latin || 'Identification'}
                  className="h-24 w-full object-cover sm:h-28"
                  loading="lazy"
                />
              </button>

              <button
                type="button"
                onClick={() => remove(item.id)}
                disabled={isDeleting}
                title="Supprimer cette identification"
                aria-label="Supprimer"
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900/70 text-white shadow-sm transition-colors hover:bg-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>

              <div className="p-2.5">
                <button
                  type="button"
                  onClick={() => item.primary_latin && onSelectSpecies?.(item.primary_latin)}
                  className="line-clamp-1 w-full text-left text-xs font-semibold italic text-primary-700 underline-offset-2 hover:underline"
                  title={item.primary_latin || ''}
                >
                  {item.primary_latin || 'Non identifié'}
                </button>
                {fr && (
                  <div className="line-clamp-1 text-[11px] text-neutral-600">
                    {fr}
                  </div>
                )}
                <div className="mt-0.5 flex items-center justify-between text-[11px] text-neutral-500">
                  <span className="font-mono tabular-nums">
                    {item.confidence != null ? `${(item.confidence * 100).toFixed(0)} %` : '—'}
                  </span>
                  <span>{formatDate(item.created_at)}</span>
                </div>
                {item.spot_name && (
                  <div className="mt-0.5 line-clamp-1 text-[11px] text-neutral-500">
                    📍 {item.spot_name}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {zoom && (
        <div
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/85 p-6"
        >
          <img
            src={zoom}
            alt="Aperçu agrandi"
            className="max-h-[95vh] max-w-[95vw] rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setZoom(null)}
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
