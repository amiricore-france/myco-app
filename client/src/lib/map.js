import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

import { ignTileUrl } from './ign.js';

export { ignTileUrl };

export const BASE_LAYER = {
  url: ignTileUrl('{z}', '{x}', '{y}'),
  attribution: 'Carte © <a href="https://www.ign.fr/" target="_blank" rel="noopener">IGN</a> / Géoplateforme',
  minZoom: 2,
  maxZoom: 19,
  maxNativeZoom: 19,
  crossOrigin: true
};

/** Marqueur Leaflet servi localement (plus d'appel à unpkg : indispensable hors-ligne). */
export const markerIconDefault = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
});
