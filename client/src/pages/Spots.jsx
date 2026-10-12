import { useEffect, useState } from 'react';
import { api } from '../api.js';
import ShareSpotPanel from '../components/ShareSpotPanel.jsx';

export default function Spots() {
  const [spots, setSpots] = useState([]);
  const [finds, setFinds] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [sharingId, setSharingId] = useState(null);
  const [expandedShares, setExpandedShares] = useState(false);

  async function load() {
    const [s, f] = await Promise.all([api('/spots'), api('/finds')]);
    setSpots(s);
    setFinds(f);
  }

  useEffect(() => { load().catch(() => {}); }, []);

  async function remove(id, name) {
    if (!confirm(`Supprimer le coin "${name}" ?`)) return;
    await api(`/spots/${id}`, { method: 'DELETE' });
    setSpots(spots.filter(s => s.id !== id));
  }

  function handleUpdated(updated) {
    setSpots(spots.map(s => (s.id === updated.id ? updated : s)));
    setEditingId(null);
  }

  return (
    <div className="container">
      <h2>Mes coins ({spots.length})</h2>

      {spots.length === 0 && <p>Aucun coin enregistré pour l'instant.</p>}

      {spots.map(spot => {
        const spotFinds = finds.filter(f => f.spot_id === spot.id);
        const totalG = spotFinds.reduce((s, f) => s + (f.weight_g || 0), 0);
        const isImported = !!spot.imported_from_share_id;
        const isEditing = editingId === spot.id;
        const isSharing = sharingId === spot.id;

        return (
          <div key={spot.id} className="card" style={{
            borderLeft: isImported ? '4px solid #8a6a00' : undefined
          }}>
            {isEditing ? (
              <SpotInlineEditor
                spot={spot}
                onSave={handleUpdated}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <>
                <div className="row between">
                  <h3 style={{ margin: 0 }}>
                    {spot.name}
                    {isImported && (
                      <span style={{
                        marginLeft: '.5rem',
                        padding: '.15rem .55rem',
                        borderRadius: 6,
                        fontSize: '.75rem',
                        fontWeight: 600,
                        background: '#fff7e6',
                        color: '#8a5a00',
                        verticalAlign: 'middle'
                      }}>
                        🔗 reçu de {spot.import_owner_display || 'un utilisateur'}
                      </span>
                    )}
                  </h3>
                  <div className="row" style={{ gap: '.35rem' }}>
                    {!isImported && (
                      <>
                        <button
                          className="secondary"
                          style={{ padding: '.35rem .65rem', fontSize: '.85rem' }}
                          onClick={() => {
                            setEditingId(spot.id);
                            setSharingId(null);
                          }}
                        >
                          ✏️ Modifier
                        </button>
                        <button
                          className="secondary"
                          style={{ padding: '.35rem .65rem', fontSize: '.85rem' }}
                          onClick={() => {
                            setSharingId(isSharing ? null : spot.id);
                            setEditingId(null);
                          }}
                        >
                          👥 Partager
                        </button>
                      </>
                    )}
                    <button
                      className="danger"
                      style={{ padding: '.35rem .65rem', fontSize: '.85rem' }}
                      onClick={() => remove(spot.id, spot.name)}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>

                {spot.description && <p style={{ marginTop: '.5rem' }}>{spot.description}</p>}
                <p style={{ fontSize: '.9rem', color: '#555' }}>
                  📍 {spot.lat.toFixed(4)}, {spot.lng.toFixed(4)} — rayon {spot.radius_m} m<br />
                  🍄 {spotFinds.length} trouvaille(s) — {(totalG / 1000).toFixed(2)} kg
                </p>

                {isImported && (
                  <p style={{ fontSize: '.8rem', color: '#8a6a00', margin: '.25rem 0 0' }}>
                    ⓘ Ce coin vous a été partagé. Son propriétaire peut le révoquer à tout moment.
                  </p>
                )}

                {isSharing && !isImported && (
                  <div style={{ marginTop: '1rem' }}>
                    <ShareSpotPanel spot={spot} />
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Éditeur inline ---
function SpotInlineEditor({ spot, onSave, onCancel }) {
  const [name, setName] = useState(spot.name);
  const [description, setDescription] = useState(spot.description || '');
  const [radius, setRadius] = useState(spot.radius_m || 50);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      const updated = await api(`/spots/${spot.id}`, {
        method: 'PUT',
        body: { name, description, radius_m: Number(radius) }
      });
      onSave(updated);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save}>
      <h3 style={{ marginTop: 0 }}>✏️ Modifier le coin</h3>

      <label>
        <span>Nom *</span>
        <input required value={name} onChange={e => setName(e.target.value)} />
      </label>
      <label>
        <span>Description</span>
        <textarea
          rows={2}
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </label>
      <label>
        <span>Rayon (m)</span>
        <input
          type="number"
          min="10"
          max="1000"
          value={radius}
          onChange={e => setRadius(e.target.value)}
        />
      </label>

      {err && <p style={{ color: 'crimson' }}>{err}</p>}

      <div className="row" style={{ marginTop: '.75rem' }}>
        <button type="submit" disabled={saving}>
          {saving ? '⏳ Enregistrement…' : '💾 Enregistrer'}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}
