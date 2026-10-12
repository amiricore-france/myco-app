import { useState } from 'react';
import { api } from '../api.js';
export default function SpotForm({ position, onCreated, onCancel }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [radius, setRadius] = useState(50);
  async function submit(e) {
    e.preventDefault();
    const spot = await api('/spots', {
      method: 'POST',
      body: { name, description, lat: position.lat, lng: position.lng,
              radius_m: Number(radius), is_public: isPublic }
    });
    onCreated(spot);
  }
  return (
    <div className="card">
      <h3>Nouveau coin</h3>
      <p style={{ fontSize: '.85rem', color: '#666' }}>
        Position : {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
      </p>
      <form onSubmit={submit}>
        <label><span>Nom *</span><input required value={name} onChange={e => setName(e.target.value)} /></label>
        <label><span>Description</span><textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} /></label>
        <label><span>Rayon (m)</span><input type="number" min="10" max="1000" value={radius} onChange={e => setRadius(e.target.value)} /></label>
        <label style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />
          <span style={{ margin: 0 }}>Lien de partage public</span>
        </label>
        <div className="row">
          <button type="submit">Enregistrer</button>
          <button type="button" className="secondary" onClick={onCancel}>Annuler</button>
        </div>
      </form>
    </div>
  );
}
