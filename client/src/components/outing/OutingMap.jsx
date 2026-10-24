import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Crosshair, Maximize2 } from 'lucide-react';
import { BASE_LAYER } from '../../lib/map.js';

/** Carte d'une sortie : trace, départ, véhicule, position actuelle. Partagée avec la page de suivi. */

function badgeIcon(emoji, bg) {
  return new L.DivIcon({
    className: 'outing-badge',
    html: `<div style="width:34px;height:34px;border-radius:50%;background:${bg};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:17px;line-height:1">${emoji}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
}
export const carIcon = badgeIcon('🚗', '#0284c7');
export const startIcon = badgeIcon('🏁', '#57534e');
const meIcon = color => new L.DivIcon({
  className: 'outing-me',
  html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 0 0 2px ${color}"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

function MapRef({ mapRef, onReady }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; onReady(); }, [map, mapRef]);
  return null;
}

export default function OutingMap({
  track = [], start, car, current, onCarMove, meColor = '#16a34a', className = '', initialFocus = 'all', followCurrent = false,
  children
}) {
  const mapRef = useRef(null);
  const didFit = useRef(false);
  const [ready, setReady] = useState(false); // la carte Leaflet est créée après le premier rendu
  const all = [...track, start, car, current].filter(Boolean);

  function fitAll() {
    const map = mapRef.current;
    if (!map || !all.length) return;
    map.invalidateSize();
    if (all.length === 1) map.setView([all[0].lat, all[0].lng], 16);
    // Marge plus large à droite : les boutons flottants ne doivent pas masquer un marqueur.
    else map.fitBounds(L.latLngBounds(all.map(p => [p.lat, p.lng])), {
      paddingTopLeft: [50, 50], paddingBottomRight: [80, 50], maxZoom: 17
    });
  }
  function centerMe() {
    if (current) mapRef.current?.setView([current.lat, current.lng], Math.max(mapRef.current.getZoom(), 16));
  }

  // Cadrage initial dès qu'on a des données
  useEffect(() => {
    if (!ready || didFit.current || !all.length) return;
    didFit.current = true;
    // Laisse le conteneur prendre sa taille définitive avant de cadrer.
    requestAnimationFrame(() => { if (initialFocus === 'me' && current) centerMe(); else fitAll(); });
  });

  // Suit le marcheur : recentre quand la position s'approche du bord de la carte.
  useEffect(() => {
    const map = mapRef.current;
    if (!followCurrent || !map || !current || !didFit.current) return;
    const inner = map.getBounds().pad(-0.2);
    if (!inner.contains([current.lat, current.lng])) map.panTo([current.lat, current.lng], { animate: true });
  }, [followCurrent, current?.lat, current?.lng]);

  const center = all[0] ? [all[0].lat, all[0].lng] : [46.6, 2.4];

  return (
    <div className={`map-wrap relative overflow-hidden rounded-lg border border-neutral-200 ${className}`}>
      <MapContainer center={center} zoom={all.length ? 15 : 6} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <MapRef mapRef={mapRef} onReady={() => setReady(true)} />
        <TileLayer {...BASE_LAYER} />
        {track.length > 1 && (
          <Polyline positions={track.map(p => [p.lat, p.lng])} pathOptions={{ color: '#c2410c', weight: 4, opacity: 0.85, dashArray: '1 8', lineCap: 'round' }} />
        )}
        {start && <Marker position={[start.lat, start.lng]} icon={startIcon} title="Point de départ" />}
        {car && (
          <Marker
            position={[car.lat, car.lng]}
            icon={carIcon}
            title={onCarMove ? 'Véhicule (glisser pour déplacer)' : 'Véhicule'}
            draggable={!!onCarMove}
            eventHandlers={onCarMove ? { dragend: e => { const ll = e.target.getLatLng(); onCarMove({ lat: ll.lat, lng: ll.lng }); } } : undefined}
          />
        )}
        {current && (
          <>
            {current.accuracy > 0 && (
              <Circle center={[current.lat, current.lng]} radius={current.accuracy}
                pathOptions={{ color: meColor, fillColor: meColor, fillOpacity: 0.12, weight: 1 }} />
            )}
            <Marker position={[current.lat, current.lng]} icon={meIcon(meColor)} zIndexOffset={1000} />
          </>
        )}
        {children}
      </MapContainer>

      <div className="pointer-events-none absolute right-3 top-3 z-[400] flex flex-col gap-2">
        {current && (
          <button type="button" onClick={centerMe} aria-label="Centrer sur la position"
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-md bg-white text-neutral-800 shadow-md hover:bg-neutral-50">
            <Crosshair className="h-5 w-5" />
          </button>
        )}
        <button type="button" onClick={fitAll} aria-label="Tout afficher"
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-md bg-white text-neutral-800 shadow-md hover:bg-neutral-50">
          <Maximize2 className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
