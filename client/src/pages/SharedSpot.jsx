import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Circle } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Skeleton } from '../components/ui/skeleton';

const icon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41]
});

export default function SharedSpot() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [spot, setSpot] = useState(null);
  const [err, setErr] = useState('');
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [importError, setImportError] = useState('');

  useEffect(() => {
    fetch(`/api/spots/shared/${token}`)
      .then(r => r.ok ? r.json() : Promise.reject('Lien invalide ou expiré'))
      .then(setSpot)
      .catch(e => setErr(String(e)));
  }, [token]);

  async function importSpot() {
    setImporting(true);
    setImportError('');
    try {
      await api(`/spots/import/${token}`, { method: 'POST' });
      setImported(true);
    } catch (e) {
      if (e.message.includes('déjà')) {
        setImported(true);
      } else {
        setImportError(e.message);
      }
    } finally {
      setImporting(false);
    }
  }

  if (err) {
    return (
      <div className="container">
        <div className="card">
          <h2>Lien invalide</h2>
          <p>{err}</p>
        </div>
      </div>
    );
  }

  if (!spot) {
    return (
      <div className="container-page">
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
          <Skeleton className="mb-3 h-6 w-1/2" />
          <Skeleton className="mb-2 h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <Skeleton className="h-[400px] w-full rounded-xl sm:h-[500px]" />
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>🍄 {spot.name}</h2>
        {spot.owner_name && (
          <p style={{ color: '#666', fontSize: '.9rem', marginTop: '-.5rem' }}>
            Coin partagé par <strong>{spot.owner_name}</strong>
          </p>
        )}
        {spot.description && <p>{spot.description}</p>}
        <p style={{ fontSize: '.9rem', color: '#666' }}>
          📍 Rayon indicatif : {spot.radius_m} m — partagé le{' '}
          {new Date(spot.created_at).toLocaleDateString('fr-FR')}
        </p>

        {/* Cas 1 : utilisateur connecté, peut importer */}
        {user && !imported && (
          <div style={{
            marginTop: '1rem',
            padding: '.75rem 1rem',
            background: '#eef5e6',
            border: '1px solid #cfd6cc',
            borderRadius: 8
          }}>
            <p style={{ margin: '0 0 .5rem', fontSize: '.9rem' }}>
              Vous pouvez enregistrer ce coin dans votre compte pour le retrouver sur votre carte.
            </p>
            <button onClick={importSpot} disabled={importing}>
              {importing ? '⏳ Enregistrement…' : '💾 Enregistrer ce coin dans mon compte'}
            </button>
            {importError && (
              <p style={{ color: 'crimson', margin: '.5rem 0 0', fontSize: '.9rem' }}>
                {importError}
              </p>
            )}
          </div>
        )}

        {/* Cas 2 : import réussi */}
        {imported && (
          <div style={{
            marginTop: '1rem',
            padding: '.75rem 1rem',
            background: '#e7f4ea',
            border: '1px solid #a3c9a8',
            borderRadius: 8,
            color: '#2e6b3e'
          }}>
            <strong>✓ Coin enregistré dans votre compte</strong>
            <div style={{ marginTop: '.5rem' }}>
              <button
                type="button"
                className="secondary"
                onClick={() => navigate('/spots')}
              >
                Voir mes coins
              </button>{' '}
              <button
                type="button"
                className="secondary"
                onClick={() => navigate('/')}
              >
                Voir la carte
              </button>
            </div>
          </div>
        )}

        {/* Cas 3 : utilisateur non connecté */}
        {!user && (
          <div style={{
            marginTop: '1rem',
            padding: '.75rem 1rem',
            background: '#fff7e6',
            border: '1px solid #f0c674',
            borderRadius: 8
          }}>
            <p style={{ margin: 0, fontSize: '.9rem' }}>
              💡 <strong>Connectez-vous</strong> pour enregistrer ce coin dans votre compte et
              le retrouver sur votre carte.
            </p>
            <button
              type="button"
              onClick={() => navigate('/login')}
              style={{ marginTop: '.5rem' }}
            >
              Se connecter
            </button>
          </div>
        )}
      </div>

      <div className="map-wrap">
        <MapContainer
          center={[spot.lat, spot.lng]}
          zoom={14}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[spot.lat, spot.lng]} icon={icon} />
          <Circle
            center={[spot.lat, spot.lng]}
            radius={spot.radius_m}
            pathOptions={{ color: '#2e6b3e' }}
          />
        </MapContainer>
      </div>

      <div className="card" style={{ marginTop: '1rem', fontSize: '.85rem', color: '#666' }}>
        <strong>Note :</strong> ce coin partagé apparaîtra dans votre compte comme un coin
        privé. Vous seul y aurez accès. Le lien de partage original reste contrôlé par
        son propriétaire.
      </div>
    </div>
  );
}
