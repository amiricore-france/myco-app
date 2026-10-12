import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function IdentificationsHistory({ onSelectSpecies }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(null);

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
    if (!confirm('Supprimer cette identification ?')) return;
    await api(`/identifications/${id}`, { method: 'DELETE' });
    setItems(items.filter(i => i.id !== id));
  }

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>📚 Historique des identifications</h3>
      <p style={{ fontSize: '.85rem', color: '#666', marginTop: 0 }}>
        {items.length} analyse{items.length > 1 ? 's' : ''} enregistrée{items.length > 1 ? 's' : ''}
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '.75rem'
      }}>
        {items.map(item => (
          <div key={item.id} style={{
            background: '#fafbf8',
            border: '1px solid #e3e8df',
            borderRadius: 8,
            overflow: 'hidden',
            position: 'relative'
          }}>
            <img
              src={item.photo_url}
              alt={item.primary_latin || 'Identification'}
              onClick={() => setZoom(item.photo_url)}
              style={{
                width: '100%', height: 120, objectFit: 'cover',
                cursor: 'zoom-in', display: 'block'
              }}
            />
            <div style={{ padding: '.5rem .6rem', fontSize: '.8rem' }}>
              <div
                onClick={() => item.primary_latin && onSelectSpecies?.(item.primary_latin)}
                style={{
                  fontStyle: 'italic',
                  color: '#2e6b3e',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  marginBottom: '.15rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
                title={item.primary_latin}
              >
                {item.primary_latin || 'Non identifié'}
              </div>
              {item.primary_common_fr && (
                <div style={{ color: '#555', marginBottom: '.15rem' }}>
                  {item.primary_common_fr}
                </div>
              )}
              <div style={{ color: '#888', fontSize: '.75rem' }}>
                {item.confidence != null && `${(item.confidence * 100).toFixed(0)} % — `}
                {new Date(item.created_at).toLocaleDateString('fr-FR')}
              </div>
              {item.spot_name && (
                <div style={{ color: '#888', fontSize: '.75rem' }}>
                  📍 {item.spot_name}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => remove(item.id)}
              title="Supprimer"
              style={{
                position: 'absolute', top: 4, right: 4,
                background: 'rgba(0,0,0,.6)', color: 'white',
                border: 'none', borderRadius: '50%',
                width: 22, height: 22, lineHeight: '20px',
                padding: 0, cursor: 'pointer', fontSize: 14
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {zoom && (
        <div
          onClick={() => setZoom(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, cursor: 'zoom-out', padding: '2rem'
          }}
        >
          <img src={zoom} alt="Zoom" style={{ maxWidth: '95%', maxHeight: '95%', borderRadius: 8 }} />
        </div>
      )}
    </div>
  );
}
