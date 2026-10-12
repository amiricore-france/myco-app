import { useEffect, useState } from 'react';
import { api } from '../api.js';

const EDIBILITY_LABEL = {
  excellent: { label: 'Excellent comestible', color: '#2e6b3e', bg: '#e7f4ea' },
  bon: { label: 'Bon comestible', color: '#4a7d2e', bg: '#eef5e6' },
  comestible: { label: 'Comestible', color: '#6b8f2e', bg: '#f0f5e2' },
  non_comestible: { label: 'Non comestible', color: '#8a6a00', bg: '#fdf5dc' },
  toxique: { label: 'Toxique', color: '#b23b3b', bg: '#fbe8e8' },
  mortel: { label: 'MORTEL', color: '#7a0000', bg: '#f7d5d5' },
  unknown: { label: 'Comestibilité inconnue', color: '#666', bg: '#eee' }
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
    <div style={{
      marginTop: '1rem',
      padding: '1rem',
      background: '#f9faf7',
      border: '1px solid #dfe5db',
      borderRadius: 10
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h4 style={{ margin: 0 }}>
          📖 <em>{latin}</em>
          {species?.common_fr && <> — {species.common_fr}</>}
        </h4>
        {onClose && (
          <button
            type="button"
            className="secondary"
            onClick={onClose}
            style={{ padding: '.25rem .5rem', fontSize: '.8rem' }}
          >
            ✕
          </button>
        )}
      </div>

      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {!species && !error && <p style={{ color: '#888' }}>Chargement…</p>}

      {species && (
        <div style={{ marginTop: '.75rem', fontSize: '.9rem' }}>
          {species.edibility && EDIBILITY_LABEL[species.edibility] && (
            <p style={{ margin: '.25rem 0' }}>
              <span style={{
                display: 'inline-block',
                padding: '.15rem .55rem',
                borderRadius: 6,
                fontWeight: 600,
                color: EDIBILITY_LABEL[species.edibility].color,
                background: EDIBILITY_LABEL[species.edibility].bg
              }}>
                {EDIBILITY_LABEL[species.edibility].label}
              </span>
            </p>
          )}

          {species.season?.length > 0 && (
            <p style={{ margin: '.35rem 0' }}>
              <strong>📅 Saison :</strong> {species.season.join(', ')}
            </p>
          )}

          {species.habitat && (
            <p style={{ margin: '.35rem 0' }}>
              <strong>🌳 Habitat :</strong> {species.habitat}
            </p>
          )}

          {species.trees?.length > 0 && (
            <p style={{ margin: '.35rem 0' }}>
              <strong>🌲 Arbres associés :</strong> {species.trees.join(', ')}
            </p>
          )}

          {species.notes && (
            <p style={{ margin: '.5rem 0', color: '#444' }}>{species.notes}</p>
          )}

          {species.confusions?.length > 0 && (
            <div style={{
              marginTop: '.75rem',
              padding: '.75rem',
              background: '#fff7e6',
              border: '1px solid #f0c674',
              borderRadius: 8
            }}>
              <strong style={{ color: '#8a5a00' }}>⚠️ Confusions possibles</strong>
              <ul style={{ margin: '.5rem 0 0', paddingLeft: '1.2rem' }}>
                {species.confusions.map((c, i) => (
                  <li key={i} style={{ marginBottom: '.4rem' }}>
                    <em>{c.latin}</em> ({c.common_fr}) — <strong>{c.danger}</strong>
                    <br />
                    <span style={{ color: '#666', fontSize: '.85rem' }}>{c.how}</span>
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
