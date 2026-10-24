import { useState } from 'react';
import { Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import { ThumbsUp, Flag, CheckCircle2, Trash2 } from 'lucide-react';
import {
  typeInfo, ageClass, whenLabel, ALERT_RADIUS_M,
  confirmDanger, abuseDanger, endDanger, deleteDanger
} from '../../lib/dangers.js';
import { toast } from '../../lib/toast-store';

const iconCache = new Map();
function dangerIcon(r) {
  const age = ageClass(r);
  const key = `${r.type}-${age.id}-${r.active ? 1 : 0}`;
  if (!iconCache.has(key)) {
    const t = typeInfo(r.type);
    const size = r.active ? 36 : 28;
    iconCache.set(key, new L.DivIcon({
      className: `myco-danger${r.active ? ' myco-danger--active' : ''}`,
      html: `<div style="--c:${age.color};width:${size}px;height:${size}px;border-radius:50%;background:#fff;border:3px solid ${age.color};box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:${r.active ? 18 : 14}px;line-height:1;${r.active ? '' : 'opacity:.9'}">${t.emoji}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2]
    }));
  }
  return iconCache.get(key);
}

/** Signalements de danger sur une carte Leaflet, avec leurs actions. */
export default function DangerLayer({ reports, onChanged, showRadius = true }) {
  return reports.map(r => (
    <DangerMarker key={r.id} r={r} onChanged={onChanged} showRadius={showRadius} />
  ));
}

function DangerMarker({ r, onChanged, showRadius }) {
  const [busy, setBusy] = useState(false);
  const t = typeInfo(r.type);
  const age = ageClass(r);

  async function run(fn, done) {
    setBusy(true);
    try { const res = await fn(); onChanged?.(res); if (done) toast.success(done); }
    catch (e) { toast.error('Action impossible', e.message); }
    finally { setBusy(false); }
  }

  return (
    <>
      {r.active && showRadius && (
        <Circle center={[r.lat, r.lng]} radius={ALERT_RADIUS_M}
          pathOptions={{ color: age.color, weight: 1.5, dashArray: '6 6', fillColor: age.color, fillOpacity: 0.06 }} />
      )}
      <Marker position={[r.lat, r.lng]} icon={dangerIcon(r)} zIndexOffset={r.active ? 900 : 0}>
        <Popup autoPanPaddingTopLeft={[16, 16]} autoPanPaddingBottomRight={[68, 60]}>
          <div className="w-56 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-lg leading-none">{t.emoji}</span>
              <strong className="text-neutral-900">{t.label}</strong>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-neutral-600">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: age.color }} />
              {r.active ? 'Actif — ' : ''}signalé {whenLabel(r)}
              {r.ended_at && r.age_days === 0 && ' · terminé'}
            </div>
            {r.comment && <p className="mt-2 rounded bg-neutral-50 p-2 text-neutral-700">« {r.comment} »</p>}
            {r.confirmations > 0 && (
              <p className="mt-1 text-xs text-neutral-500">Confirmé par {r.confirmations} personne{r.confirmations > 1 ? 's' : ''}</p>
            )}

            <div className="mt-3 flex flex-wrap gap-1.5">
              {r.mine ? (
                <>
                  {r.active && (
                    <button type="button" disabled={busy} onClick={() => run(() => endDanger(r.id), 'Signalement clos')}
                      className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50">
                      <CheckCircle2 className="h-3.5 w-3.5" />C’est terminé
                    </button>
                  )}
                  <button type="button" disabled={busy}
                    onClick={() => run(async () => { await deleteDanger(r.id); return { id: r.id, removed: true }; }, 'Signalement supprimé')}
                    className="inline-flex items-center gap-1 rounded-md border border-danger-200 px-2 py-1.5 text-xs font-medium text-danger-700 hover:bg-danger-50">
                    <Trash2 className="h-3.5 w-3.5" />Supprimer
                  </button>
                </>
              ) : (
                <>
                  {r.active && (
                    <button type="button" disabled={busy || r.voted?.includes('confirm')}
                      onClick={() => run(() => confirmDanger(r.id), 'Merci, signalement confirmé')}
                      className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50">
                      <ThumbsUp className="h-3.5 w-3.5" />{r.voted?.includes('confirm') ? 'Confirmé' : 'Toujours là'}
                    </button>
                  )}
                  <button type="button" disabled={busy || r.voted?.includes('abuse')}
                    onClick={() => run(async () => { await abuseDanger(r.id); return { ...r, voted: `${r.voted || ''},abuse` }; },
                      'Merci, nous examinerons ce signalement')}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-neutral-500 hover:bg-neutral-50 hover:text-danger-700 disabled:opacity-50">
                    <Flag className="h-3.5 w-3.5" />{r.voted?.includes('abuse') ? 'Signalé' : 'Abusif'}
                  </button>
                </>
              )}
            </div>
          </div>
        </Popup>
      </Marker>
    </>
  );
}
