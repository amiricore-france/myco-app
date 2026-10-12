import { useState } from 'react';
import { api } from '../api.js';
import ShareSpotPanel from './ShareSpotPanel.jsx';

export default function SpotEditor({ spot, onUpdated, onDeleted, onCancel }) {
  const [name, setName] = useState(spot.name);
  const [description, setDescription] = useState(spot.description || '');
  const [radius, setRadius] = useState(spot.radius_m || 50);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function save(e) {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      const updated = await api(`/spots/${spot.id}`, {
        method: 'PUT',
        body: { name, description, radius_m: Number(radius) }
      });
      onUpdated(updated);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!confirm(`Supprimer le coin "${spot.name}" ?`)) return;
    try {
      await api(`/spots/${spot.id}`, { method: 'DELETE' });
      onDeleted(spot.id);
    } catch (e) { setErr(e.message); }
  }

  return (
    <div className="card" style={{ borderLeft: '4px solid #2e6b3e' }}>
      <div className="row between" style={{ marginBottom: '.5rem' }}>
        <h3 style={{ margin: 0 }}>✏️ Modifier le coin</h3>
        <button className="secondary" type="button" onClick={onCancel}>✕</button>
      </div>

      <p style={{ fontSize: '.85rem', color: '#666', marginTop: 0 }}>
        📍 {spot.lat.toFixed(5)}, {spot.lng.toFixed(5)}
      </p>

      <form onSubmit={save}>
        <label>
          <span>Nom du coin *</span>
          <input required value={name} onChange={e => setName(e.target.value)} />
        </label>
        <label>
          <span>Description</span>
          <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} />
        </label>
        <label>
          <span>Rayon (m)</span>
          <input type="number" min="10" max="1000" value={radius} onChange={e => setRadius(e.target.value)} />
        </label>

        {err && <p style={{ color: 'crimson' }}>{err}</p>}

        <div className="row" style={{ marginTop: '1rem', flexWrap: 'wrap' }}>
          <button type="submit" disabled={saving}>
            {saving ? '⏳ Enregistrement…' : '💾 Enregistrer'}
          </button>
          <button type="button" className="secondary" onClick={onCancel}>Annuler</button>
          <button type="button" className="danger" onClick={remove}>🗑 Supprimer</button>
        </div>
      </form>

      <div style={{ marginTop: '1.25rem' }}>
        <ShareSpotPanel spot={spot} />
      </div>
    </div>
  );
}
