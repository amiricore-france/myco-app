/**
 * Fond de carte : Plan IGN v2 (Géoplateforme), service « découverte »
 * gratuit et sans clé, sous Licence Ouverte Etalab.
 * Les tuiles sont servies avec CORS, ce qui permet de les mettre en cache
 * pour le hors-ligne (voir lib/offline.js et public/sw.js).
 */
export const IGN_LAYER = 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2';
export const IGN_HOST = 'data.geopf.fr';

export function ignTileUrl(z, x, y) {
  return `https://${IGN_HOST}/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&STYLE=normal` +
    `&TILEMATRIXSET=PM&FORMAT=image/png&LAYER=${IGN_LAYER}&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}`;
}
