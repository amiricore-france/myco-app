import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Trash2, MapPinned, Scan, WifiOff, HardDrive } from 'lucide-react';
import { usePremium } from '../lib/premium.js';
import {
  boundsAround, estimate, downloadZone, deleteZone, listZones,
  storageEstimate, offlineSupported, MAX_TILES
} from '../lib/offline.js';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';
import { toast } from '../lib/toast-store';
import PremiumUpsell from './PremiumUpsell.jsx';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';

const RADII = [1, 2, 3];

/**
 * Téléchargement de zones de carte (Plan IGN) pour une utilisation sans réseau,
 * autour d'un coin ou sur la zone affichée à l'écran.
 */
export default function OfflineMapsDialog({ open, onOpenChange, spots, mapRef }) {
  const { premium, loading } = usePremium();
  const online = useOnlineStatus();
  const [mode, setMode] = useState('spot');
  const [spotId, setSpotId] = useState('');
  const [radius, setRadius] = useState(2);
  const [viewBounds, setViewBounds] = useState(null);
  const [zones, setZones] = useState(listZones());
  const [storage, setStorage] = useState(null);
  const [progress, setProgress] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setZones(listZones());
    storageEstimate().then(setStorage);
    const map = mapRef.current;
    if (map) {
      const b = map.getBounds();
      setViewBounds({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() });
    }
    if (!spotId && spots.length) setSpotId(String(spots[0].id));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const spot = spots.find(s => String(s.id) === spotId);
  const target = useMemo(() => {
    if (mode === 'spot' && spot) {
      return { name: `${spot.name} (${radius} km)`, bounds: boundsAround(spot.lat, spot.lng, radius) };
    }
    if (mode === 'view' && viewBounds) return { name: 'Zone affichée', bounds: viewBounds };
    return null;
  }, [mode, spot, radius, viewBounds]);
  const est = target ? estimate(target.bounds) : null;

  async function start() {
    if (!target) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setProgress({ done: 0, total: est.count, failed: 0 });
    try {
      const zone = await downloadZone({ ...target, signal: ctrl.signal, onProgress: setProgress });
      setZones(listZones());
      storageEstimate().then(setStorage);
      if (zone.failed) toast.warning('Zone enregistrée', `${zone.failed} tuile(s) n’ont pas pu être téléchargées.`);
      else toast.success('Zone disponible hors-ligne', `${zone.tiles} tuiles · ${zone.mb} Mo`);
    } catch (e) {
      if (e.name === 'AbortError') toast.info('Téléchargement annulé');
      else toast.error('Téléchargement impossible', e.message);
    } finally {
      setProgress(null);
      abortRef.current = null;
    }
  }

  async function remove(id) {
    await deleteZone(id);
    setZones(listZones());
    storageEstimate().then(setStorage);
  }

  const busy = !!progress;

  return (
    <Dialog open={open} onOpenChange={v => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><WifiOff className="h-5 w-5 text-primary-700" />Cartes hors-ligne</DialogTitle>
          <DialogDescription>
            Téléchargez le Plan IGN d’une zone pour l’afficher en forêt, même sans réseau.
          </DialogDescription>
        </DialogHeader>

        {loading ? null : !premium ? (
          <PremiumUpsell title="Cartes hors-ligne" compact>
            En forêt, le réseau manque souvent. Avec Premium, téléchargez la carte autour de vos coins
            et retrouvez-les même en mode avion.
          </PremiumUpsell>
        ) : !offlineSupported() ? (
          <p className="rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm text-warning-900">
            Ce navigateur ne permet pas le stockage hors-ligne. Utilisez Chrome, Firefox, Edge ou Safari récents.
          </p>
        ) : (
          <div className="space-y-5">
            {/* Choix de la zone */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'spot', label: 'Autour d’un coin', Icon: MapPinned, disabled: !spots.length },
                { id: 'view', label: 'Zone affichée', Icon: Scan, disabled: !viewBounds }
              ].map(({ id, label, Icon, disabled }) => (
                <button key={id} type="button" disabled={disabled || busy} onClick={() => setMode(id)}
                  className={`flex items-center justify-center gap-2 rounded-md border px-3 py-3 text-sm font-medium transition-colors disabled:opacity-40 ${
                    mode === id ? 'border-primary-600 bg-primary-50 text-primary-900' : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'}`}>
                  <Icon className="h-4 w-4" />{label}
                </button>
              ))}
            </div>

            {mode === 'spot' && (
              <div className="space-y-3">
                <select value={spotId} onChange={e => setSpotId(e.target.value)} disabled={busy}
                  className="h-12 w-full rounded-md border border-neutral-300 bg-white px-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-600">
                  {spots.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <div>
                  <div className="mb-1.5 text-sm font-medium text-neutral-700">Rayon</div>
                  <div className="grid grid-cols-3 gap-2">
                    {RADII.map(r => (
                      <button key={r} type="button" disabled={busy} onClick={() => setRadius(r)}
                        className={`h-11 rounded-md border text-sm font-medium ${
                          radius === r ? 'border-primary-600 bg-primary-600 text-white' : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'}`}>
                        {r} km
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {mode === 'view' && (
              <p className="text-sm text-neutral-600">
                La partie de la carte visible à l’écran sera téléchargée jusqu’au zoom le plus détaillé.
                Zoomez sur la forêt qui vous intéresse avant d’ouvrir cette fenêtre.
              </p>
            )}

            {/* Estimation + action */}
            {est && (
              <div className="rounded-lg bg-neutral-50 p-4">
                {est.tooBig ? (
                  <p className="text-sm text-danger-800">
                    Zone trop grande ({est.count.toLocaleString('fr-FR')} tuiles, maximum {MAX_TILES.toLocaleString('fr-FR')}).
                    {mode === 'view' ? ' Zoomez davantage sur la carte.' : ' Choisissez un rayon plus petit.'}
                  </p>
                ) : (
                  <p className="text-sm text-neutral-700">
                    Environ <span className="font-mono font-semibold">{est.count.toLocaleString('fr-FR')}</span> tuiles,
                    soit <span className="font-mono font-semibold">~{est.mb} Mo</span>. Préférez le Wi-Fi.
                  </p>
                )}

                {progress ? (
                  <div className="mt-3 space-y-2">
                    <Progress value={(progress.done / progress.total) * 100} />
                    <div className="flex items-center justify-between text-xs text-neutral-600">
                      <span className="font-mono">{progress.done} / {progress.total}</span>
                      <button type="button" onClick={() => abortRef.current?.abort()} className="font-medium text-danger-700 hover:underline">
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <Button type="button" onClick={start} disabled={est.tooBig || !online} className="mt-3 h-12 w-full">
                    {online ? <><Download className="h-4 w-4" />Télécharger</> : <><WifiOff className="h-4 w-4" />Connexion requise</>}
                  </Button>
                )}
              </div>
            )}

            {/* Zones enregistrées */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-neutral-900">Zones sur cet appareil</h3>
              {zones.length === 0 ? (
                <p className="text-sm text-neutral-500">Aucune zone téléchargée pour l’instant.</p>
              ) : (
                <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                  {zones.map(z => (
                    <li key={z.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <button type="button" className="min-w-0 flex-1 text-left" disabled={busy}
                        title="Afficher cette zone sur la carte"
                        onClick={() => {
                          const b = z.bounds;
                          mapRef.current?.fitBounds([[b.south, b.west], [b.north, b.east]]);
                          onOpenChange(false);
                        }}>
                        <div className="truncate text-sm font-medium text-neutral-900 hover:text-primary-700">{z.name}</div>
                        <div className="text-xs text-neutral-500">
                          {new Date(z.created_at).toLocaleDateString('fr-FR')} · <span className="font-mono">{z.mb} Mo</span>
                        </div>
                      </button>
                      <button type="button" onClick={() => remove(z.id)} disabled={busy} aria-label={`Supprimer ${z.name}`}
                        className="rounded-md p-2 text-neutral-400 hover:bg-danger-50 hover:text-danger-700">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {storage && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500">
                  <HardDrive className="h-3.5 w-3.5" />
                  Stockage utilisé par Myco : <span className="font-mono">{storage.usedMb} Mo</span>
                </p>
              )}
              <p className="mt-2 text-xs text-neutral-500">
                Les zones sont effacées à la déconnexion, pour ne pas laisser vos coins sur un appareil partagé.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
