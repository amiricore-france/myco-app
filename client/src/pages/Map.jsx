import { useEffect, useRef, useState } from 'react';
import {
  MapContainer, TileLayer, Marker, Popup, Circle,
  useMap, useMapEvents
} from 'react-leaflet';
import L from 'leaflet';
import { api } from '../api.js';
import SpotForm from '../components/SpotForm.jsx';
import SpotEditor from '../components/SpotEditor.jsx';

// --- Icônes ---
const icon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41]
});

const userIcon = new L.DivIcon({
  className: 'user-dot',
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#2a7fff;border:3px solid white;box-shadow:0 0 0 2px #2a7fff;"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

// --- Sous-composants ---
function MapRef({ mapRef }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
}

function ClickHandler({ onClick }) {
  useMapEvents({ click: e => onClick(e.latlng) });
  return null;
}

// --- Recherche d'adresse ---
function SearchBar({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=fr&q=${encodeURIComponent(query)}`;
        const res = await fetch(url, {
          signal: ctrl.signal,
          headers: { 'Accept': 'application/json' }
        });
        const data = await res.json();
        setResults(data);
        setOpen(true);
      } catch (e) {
        if (e.name !== 'AbortError') console.warn('Recherche échouée', e);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [query]);

  function choose(r) {
    onSelect({ lat: parseFloat(r.lat), lng: parseFloat(r.lon) }, r.display_name);
    setOpen(false);
    setQuery(r.display_name);
  }

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 240, maxWidth: 420 }}>
      <input
        type="text"
        placeholder="🔎 Rechercher une ville, forêt, lieu-dit…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        style={{ width: '100%' }}
      />
      {loading && (
        <span style={{ position: 'absolute', right: 10, top: 10, fontSize: '.8rem', color: '#888' }}>
          …
        </span>
      )}
      {open && results.length > 0 && (
        <ul style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
          background: 'white', border: '1px solid #cfd6cc', borderRadius: 6,
          margin: '.25rem 0 0', padding: 0, listStyle: 'none',
          maxHeight: 260, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,.1)'
        }}>
          {results.map(r => (
            <li key={r.place_id}>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => choose(r)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  background: 'white', color: '#1e2a1e', border: 'none',
                  padding: '.5rem .75rem', fontSize: '.85rem', cursor: 'pointer',
                  borderBottom: '1px solid #f0f0f0'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f6f7f4'}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}
              >
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- Page principale ---
export default function MapPage() {
  const [spots, setSpots] = useState([]);
  const [pending, setPending] = useState(null);
  const [editingSpot, setEditingSpot] = useState(null);
  const [center, setCenter] = useState([46.6, 2.4]);
  const [zoom, setZoom] = useState(8);
  const [userPos, setUserPos] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');
  const [locInfo, setLocInfo] = useState('');

  const mapRef = useRef(null);

  useEffect(() => {
    api('/spots').then(setSpots).catch(() => {});
  }, []);

  function locateMe() {
    if (!navigator.geolocation) {
      setLocError('Géolocalisation non supportée par ce navigateur');
      return;
    }
    setLocating(true);
    setLocError('');
    setLocInfo('');

    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude, accuracy } = pos.coords;
        const newCenter = [latitude, longitude];
        setUserPos(newCenter);
        setCenter(newCenter);
        setZoom(16);
        mapRef.current?.flyTo(newCenter, 16, { duration: 1.2 });
        setLocating(false);
        setLocInfo(`Position obtenue (±${Math.round(accuracy)} m)`);
      },
      err => {
        setLocating(false);
        if (err.code === 1) {
          setLocError('Accès à la position refusé. Vérifiez les autorisations du navigateur (icône 🔒 dans la barre d’adresse).');
        } else if (err.code === 2) {
          setLocError('Position indisponible (Wi-Fi/GPS). Réessayez dans quelques secondes.');
        } else {
          setLocError('Localisation trop lente. Réessayez ou utilisez la recherche d’adresse.');
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 30000,
        maximumAge: 60000
      }
    );
  }

  function addAtCenter() {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    setPending({ lat: c.lat, lng: c.lng });
    setEditingSpot(null);
  }

  function gotoSearchResult({ lat, lng }, label) {
    const target = [lat, lng];
    setCenter(target);
    setZoom(15);
    mapRef.current?.flyTo(target, 15, { duration: 1.2 });
    setLocInfo(`Résultat : ${label.split(',').slice(0, 2).join(',')}`);
    setLocError('');
  }

  function openEditor(spot) {
    setEditingSpot(spot);
    setPending(null);
  }

  function handleSpotUpdated(updated) {
    setSpots(spots.map(s => (s.id === updated.id ? updated : s)));
    setEditingSpot(null);
  }

  function handleSpotDeleted(id) {
    setSpots(spots.filter(s => s.id !== id));
    setEditingSpot(null);
  }

  return (
    <div className="container">
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Carte de mes coins</h2>
        <p style={{ color: '#666', margin: '.25rem 0 0', fontSize: '.9rem' }}>
          Recherchez une adresse, cliquez sur la carte, ou cliquez sur un marqueur pour le modifier.
        </p>
      </div>

      <div className="row" style={{ marginBottom: '.75rem', flexWrap: 'wrap' }}>
        <SearchBar onSelect={gotoSearchResult} />
        <button onClick={locateMe} disabled={locating}>
          {locating ? '⏳ Localisation…' : '📍 Me localiser'}
        </button>
        <button className="secondary" onClick={addAtCenter}>
          ➕ Ajouter ici
        </button>
      </div>

      {locError && <p style={{ color: 'crimson', margin: '.25rem 0' }}>{locError}</p>}
      {locInfo && !locError && <p style={{ color: '#2e6b3e', margin: '.25rem 0', fontSize: '.9rem' }}>{locInfo}</p>}

      <div className="map-wrap">
        <MapContainer
          center={center}
          zoom={zoom}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <MapRef mapRef={mapRef} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onClick={setPending} />

          {userPos && (
            <>
              <Marker position={userPos} icon={userIcon} />
              <Circle
                center={userPos}
                radius={30}
                pathOptions={{ color: '#2a7fff', fillColor: '#2a7fff', fillOpacity: 0.15 }}
              />
            </>
          )}

          {spots.map(s => (
            <div key={s.id}>
              <Marker
                position={[s.lat, s.lng]}
                icon={icon}
                eventHandlers={{ click: () => openEditor(s) }}
              >
                <Popup>
                  <strong>{s.name}</strong>
                  {s.description && <><br /><em>{s.description}</em></>}
                  <br />
                  <button
                    type="button"
                    onClick={() => openEditor(s)}
                    style={{
                      marginTop: '.35rem', padding: '.25rem .5rem',
                      fontSize: '.8rem', cursor: 'pointer'
                    }}
                  >
                    ✏️ Modifier
                  </button>
                </Popup>
              </Marker>
              <Circle
                center={[s.lat, s.lng]}
                radius={s.radius_m}
                pathOptions={{ color: '#2e6b3e' }}
              />
            </div>
          ))}

          {pending && (
            <Marker position={[pending.lat, pending.lng]} icon={icon}>
              <Popup>Nouveau point — validez ci-dessous</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {pending && (
        <div style={{ marginTop: '1rem' }}>
          <SpotForm
            position={pending}
            onCreated={spot => { setSpots([spot, ...spots]); setPending(null); }}
            onCancel={() => setPending(null)}
          />
        </div>
      )}

      {editingSpot && (
        <div style={{ marginTop: '1rem' }}>
          <SpotEditor
            spot={editingSpot}
            onUpdated={handleSpotUpdated}
            onDeleted={handleSpotDeleted}
            onCancel={() => setEditingSpot(null)}
          />
        </div>
      )}

      {!pending && !editingSpot && (
        <div className="card" style={{ marginTop: '1rem', fontSize: '.9rem', color: '#666' }}>
          <strong>Astuce :</strong> cliquez sur un marqueur existant pour le modifier,
          le déplacer, ou le supprimer.
        </div>
      )}
    </div>
  );
}
