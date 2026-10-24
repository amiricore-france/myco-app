import { useEffect, useRef, useState } from 'react';
import {
  MapContainer, TileLayer, Marker, Popup, Circle,
  useMap, useMapEvents
} from 'react-leaflet';
import L from 'leaflet';
import { BASE_LAYER, markerIconDefault } from '../lib/map.js';
import { MapPin, Plus, Compass, Footprints } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOuting } from '../lib/outing.js';
import { api } from '../api.js';
import { Button } from '../components/ui/button';
import SearchAddress from '../components/SearchAddress.jsx';
import SpotForm from '../components/SpotForm.jsx';
import SpotEditor from '../components/SpotEditor.jsx';
import MapControls from '../components/MapControls.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Podium from '../components/Podium.jsx';
import OfflineMapsDialog from '../components/OfflineMapsDialog.jsx';
import DangerLayer from '../components/dangers/DangerLayer.jsx';
import DangerLegend from '../components/dangers/DangerLegend.jsx';
import ReportDangerDialog from '../components/dangers/ReportDangerDialog.jsx';
import {
  fetchDangers, notePosition, useNearbyDangers, updateToday, removeToday
} from '../lib/dangers.js';
import { toast } from '../lib/toast-store';

// --- Icônes ---
const icon = markerIconDefault;

const userIcon = new L.DivIcon({
  className: 'user-dot',
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#0284c7;border:3px solid white;box-shadow:0 0 0 2px #0284c7;"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

function MapRef({ mapRef }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
}

/** Recharge les signalements de la zone affichée quand la carte bouge ou que la période change. */
function DangerLoader({ days, onLoaded }) {
  const map = useMap();
  useEffect(() => {
    let timer = null;
    let cancelled = false;
    async function load() {
      const b = map.getBounds();
      try {
        const res = await fetchDangers({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() }, days);
        if (!cancelled) onLoaded(res);
      } catch { /* hors-ligne : on garde l'affichage précédent */ }
    }
    const onMove = () => { clearTimeout(timer); timer = setTimeout(load, 400); };
    load();
    map.on('moveend', onMove);
    return () => { cancelled = true; clearTimeout(timer); map.off('moveend', onMove); };
  }, [map, days]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

const DANGER_DAYS_KEY = 'myco-danger-days';

function ClickHandler({ onClick }) {
  useMapEvents({ click: e => onClick(e.latlng) });
  return null;
}

export default function MapPage() {
  const [spots, setSpots] = useState([]);
  const [pending, setPending] = useState(null);
  const [editingSpot, setEditingSpot] = useState(null);
  const [center] = useState([46.6, 2.4]);
  const [userPos, setUserPos] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');
  const [locInfo, setLocInfo] = useState('');
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [dangerDays, setDangerDays] = useState(() => {
    const v = Number(localStorage.getItem(DANGER_DAYS_KEY));
    return [0, 7, 30, 365].includes(v) ? v : 7;
  });
  const [dangerData, setDangerData] = useState({ reports: [], too_wide: false });
  const nearby = useNearbyDangers();

  const mapRef = useRef(null);
  const { outing } = useOuting();

  useEffect(() => {
    api('/spots').then(setSpots).catch(() => {});
  }, []);

  useEffect(() => { localStorage.setItem(DANGER_DAYS_KEY, String(dangerDays)); }, [dangerDays]);

  // Lien depuis une notification (/?danger=ID) : centrer la carte sur le signalement.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('danger');
    if (!id) return;
    window.history.replaceState(null, '', window.location.pathname);
    api(`/dangers/${encodeURIComponent(id)}`)
      .then(r => {
        setDangerData(d => ({ ...d, reports: [r, ...d.reports.filter(x => x.id !== r.id)] }));
        const go = () => mapRef.current ? mapRef.current.flyTo([r.lat, r.lng], 15, { duration: 1.2 }) : setTimeout(go, 200);
        go();
      })
      .catch(e => toast.info('Signalement indisponible', e.message));
  }, []);

  // Signalements affichés : zone visible (période choisie) + signalements du jour de la veille de proximité.
  const dangerReports = (() => {
    const byId = new Map();
    for (const r of [...nearby.today, ...dangerData.reports]) byId.set(r.id, { ...byId.get(r.id), ...r });
    return [...byId.values()].filter(r => r.age_days <= dangerDays);
  })();

  function handleDangerChanged(res) {
    if (res?.removed) {
      removeToday(res.id);
      setDangerData(d => ({ ...d, reports: d.reports.filter(r => r.id !== res.id) }));
    } else if (res?.id) {
      updateToday(res);
      setDangerData(d => ({ ...d, reports: d.reports.map(r => (r.id === res.id ? { ...r, ...res } : r)) }));
    }
  }

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
        notePosition({ lat: latitude, lng: longitude });
        mapRef.current?.flyTo(newCenter, 16, { duration: 1.2 });
        setLocating(false);
        setLocInfo(`Position obtenue (±${Math.round(accuracy)} m)`);
      },
      err => {
        setLocating(false);
        if (err.code === 1) setLocError('Accès à la position refusé. Vérifiez les autorisations du navigateur.');
        else if (err.code === 2) setLocError('Position indisponible. Réessayez dans quelques secondes.');
        else setLocError('Localisation trop lente. Réessayez ou utilisez la recherche d\'adresse.');
      },
      { enableHighAccuracy: false, timeout: 30000, maximumAge: 60000 }
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
    <div className="container-page">
      <PageHeader
        title="Carte de mes coins"
        subtitle="Recherchez une adresse, cliquez sur la carte, ou cliquez sur un marqueur pour le modifier."
        action={!outing && (
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link to="/sortie" className="hover:no-underline"><Footprints className="h-4 w-4" /> Partir en cueillette</Link>
          </Button>
        )}
      />

      <Podium />

      {/* Barre d'outils : recherche + boutons secondaires */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchAddress onSelect={gotoSearchResult} className="sm:flex-1 sm:max-w-md" />
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={locateMe}
            disabled={locating}
            className="h-11 flex-1 sm:flex-none"
          >
            <Compass className="h-4 w-4" />
            {locating ? 'Localisation…' : 'Me localiser'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={addAtCenter}
            className="h-11 flex-1 sm:flex-none"
          >
            <Plus className="h-4 w-4" />
            Ajouter ici
          </Button>
        </div>
      </div>

      {/* Messages d'état */}
      {locError && (
        <div className="mb-3 rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-900">
          {locError}
        </div>
      )}
      {locInfo && !locError && (
        <div className="mb-3 rounded-lg border border-primary-200 bg-primary-50 p-3 text-sm text-primary-900">
          {locInfo}
        </div>
      )}

      {/* Carte + contrôles flottants */}
      <div className="map-wrap relative mb-4 h-[400px] overflow-hidden rounded-xl border border-neutral-200 shadow-sm sm:h-[500px]">
        <MapContainer
          center={center}
          zoom={8}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <MapRef mapRef={mapRef} />
          <TileLayer {...BASE_LAYER} />
          <ClickHandler onClick={setPending} />

          {userPos && (
            <>
              <Marker position={userPos} icon={userIcon} />
              <Circle
                center={userPos}
                radius={30}
                pathOptions={{ color: '#0284c7', fillColor: '#0284c7', fillOpacity: 0.15 }}
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
                  <div className="text-sm">
                    <strong className="text-neutral-900">{s.name}</strong>
                    {s.description && (
                      <>
                        <br />
                        <span className="text-neutral-600 italic">{s.description}</span>
                      </>
                    )}
                  </div>
                </Popup>
              </Marker>
              <Circle
                center={[s.lat, s.lng]}
                radius={s.radius_m}
                pathOptions={{ color: '#16a34a', fillColor: '#16a34a', fillOpacity: 0.05 }}
              />
            </div>
          ))}

          <DangerLoader days={dangerDays} onLoaded={setDangerData} />
          <DangerLayer reports={dangerReports} onChanged={handleDangerChanged} />

          {pending && (
            <Marker position={[pending.lat, pending.lng]} icon={icon}>
              <Popup>Nouveau point — validez ci-dessous</Popup>
            </Marker>
          )}
        </MapContainer>

        {/* Contrôles flottants */}
        <MapControls onLocate={locateMe} onAdd={addAtCenter} onOffline={() => setOfflineOpen(true)}
          onReport={() => setReportOpen(true)} locating={locating} />
        <DangerLegend days={dangerDays} onDaysChange={setDangerDays}
          count={dangerReports.length} tooWide={dangerData.too_wide} />
      </div>

      <ReportDangerDialog open={reportOpen} onOpenChange={setReportOpen}
        getMapCenter={() => { const c = mapRef.current?.getCenter(); return c ? { lat: c.lat, lng: c.lng } : null; }}
        onCreated={r => setDangerData(d => ({ ...d, reports: [r, ...d.reports] }))} />

      <OfflineMapsDialog open={offlineOpen} onOpenChange={setOfflineOpen} spots={spots} mapRef={mapRef} />

      {/* Formulaire d'ajout */}
      {pending && (
        <div className="mb-4">
          <SpotForm
            position={pending}
            onCreated={spot => { setSpots([spot, ...spots]); setPending(null); }}
            onCancel={() => setPending(null)}
          />
        </div>
      )}

      {/* Éditeur de coin */}
      {editingSpot && (
        <div className="mb-4">
          <SpotEditor
            spot={editingSpot}
            onUpdated={handleSpotUpdated}
            onDeleted={handleSpotDeleted}
            onCancel={() => setEditingSpot(null)}
          />
        </div>
      )}

      {/* Astuce */}
      {!pending && !editingSpot && spots.length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600">
          <strong className="text-neutral-800">Astuce :</strong> cliquez sur un marqueur existant
          pour le modifier, ou sur la carte pour créer un nouveau coin.
        </div>
      )}
    </div>
  );
}
