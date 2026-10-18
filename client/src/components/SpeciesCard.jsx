import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../api.js';
import { Button } from './ui/button';

const EDIBILITY = {
  excellent:     { label: 'Excellent comestible', cls: 'bg-primary-600 text-white' },
  bon:           { label: 'Bon comestible',       cls: 'bg-sage-500 text-white' },
  comestible:    { label: 'Comestible',           cls: 'bg-sage-500 text-white' },
  non_comestible:{ label: 'Non comestible',       cls: 'bg-warning-500 text-warning-900' },
  toxique:       { label: 'Toxique',              cls: 'bg-danger-600 text-white' },
  mortel:        { label: 'MORTEL',               cls: 'bg-danger-700 text-white font-extrabold uppercase tracking-wider' },
  unknown:       { label: 'Comestibilité inconnue', cls: 'bg-neutral-200 text-neutral-700' },
};

export default function SpeciesCard({ latin, onClose }) {
  const [species, setSpecies] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!latin) return;
    setSpecies(null);
    setError('');
    api(`/species/${encodeURIComponent(latin)}`)
      .then(setSpecies)
      .catch(e => setError(e.message));
  }, [latin]);

  if (!latin) return null;

  return (
    <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h4 className="text-base font-semibold text-neutral-900">
          📖 <em>{latin}</em>
          {species?.common_fr && (
            <span className="text-neutral-600 font-normal"> — {species.common_fr}</span>
          )}
        </h4>
        {onClose && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Fermer"
            className="-mr-1 -mt-1 flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-danger-600">{error}</p>}
      {!species && !error && <p className="text-sm text-neutral-500">Chargement…</p>}

      {species && (
        <div className="space-y-3 text-sm">
          {species.edibility && EDIBILITY[species.edibility] && (
            <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${EDIBILITY[species.edibility].cls}`}>
              {EDIBILITY[species.edibility].label}
            </span>
          )}

          {species.season?.length > 0 && (
            <p className="text-neutral-700">
              <strong className="text-neutral-900">📅 Saison :</strong>{' '}
              {species.season.join(', ')}
            </p>
          )}

          {species.habitat && (
            <p className="text-neutral-700">
              <strong className="text-neutral-900">🌳 Habitat :</strong> {species.habitat}
            </p>
          )}

          {species.trees?.length > 0 && (
            <p className="text-neutral-700">
              <strong className="text-neutral-900">🌲 Arbres associés :</strong>{' '}
              {species.trees.join(', ')}
            </p>
          )}

          {species.notes && (
            <p className="text-neutral-600">{species.notes}</p>
          )}

          {species.confusions?.length > 0 && (
            <div className="rounded-lg border border-warning-300 bg-warning-50 p-3.5">
              <div className="mb-2 text-sm font-semibold text-warning-900">
                ⚠️ Confusions possibles
              </div>
              <ul className="space-y-2.5">
                {species.confusions.map((c, i) => (
                  <li key={i} className="text-sm">
                    <div className="text-neutral-900">
                      <em>{c.latin}</em>
                      {c.common_fr && ` (${c.common_fr})`}
                      {c.danger && (
                        <span className="ml-1 font-semibold text-danger-700">
                          — {c.danger}
                        </span>
                      )}
                    </div>
                    {c.how && (
                      <div className="mt-0.5 text-xs text-neutral-600">{c.how}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
