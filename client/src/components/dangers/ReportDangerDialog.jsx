import { useEffect, useState } from 'react';
import { Loader2, Crosshair, MapPin, TriangleAlert, Phone } from 'lucide-react';
import { DANGER_TYPES, createDanger, addToday } from '../../lib/dangers.js';
import { getPosition } from '../../lib/outing.js';
import { toast } from '../../lib/toast-store';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';

/**
 * Signaler un danger à sa position GPS (par défaut) ou au centre de la carte.
 * getMapCenter : fonction facultative qui renvoie {lat, lng} du centre de la carte.
 */
export default function ReportDangerDialog({ open, onOpenChange, getMapCenter, initialPosition, onCreated }) {
  const [type, setType] = useState(null);
  const [comment, setComment] = useState('');
  const [where, setWhere] = useState('gps');
  const [gps, setGps] = useState(null);
  const [gpsError, setGpsError] = useState('');
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType(null); setComment(''); setGpsError('');
    if (initialPosition) { setGps(initialPosition); setWhere('gps'); return; }
    setGps(null);
    setWhere('gps');
    locate();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function locate() {
    setLocating(true); setGpsError('');
    try { setGps(await getPosition({ timeout: 20000 })); }
    catch (e) { setGpsError(e.message); if (getMapCenter) setWhere('map'); }
    finally { setLocating(false); }
  }

  const position = where === 'gps' ? gps : getMapCenter?.();

  async function submit() {
    if (!type || !position) return;
    setSaving(true);
    try {
      const report = await createDanger({ type, lat: position.lat, lng: position.lng, comment: comment.trim() || undefined });
      addToday(report);
      onCreated?.(report);
      toast.success('Merci, danger signalé', 'Il est visible aujourd’hui par les cueilleurs à proximité.');
      onOpenChange(false);
    } catch (e) {
      toast.error('Signalement impossible', e.message);
    } finally {
      setSaving(false);
    }
  }

  const needComment = type === 'autre' && !comment.trim();

  return (
    <Dialog open={open} onOpenChange={v => { if (!saving) onOpenChange(v); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="h-5 w-5 text-danger-600" />Signaler un danger
          </DialogTitle>
          <DialogDescription>
            Visible aujourd’hui par tous les cueilleurs, sans votre nom. Ceux qui passent à moins d’1 km sont prévenus.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Type de danger">
            {DANGER_TYPES.map(t => (
              <button key={t.id} type="button" role="radio" aria-checked={type === t.id} onClick={() => setType(t.id)}
                className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-md border px-2 py-2 text-center text-sm font-medium transition-colors ${
                  type === t.id ? 'border-danger-600 bg-danger-50 text-danger-900' : 'border-neutral-200 text-neutral-800 hover:bg-neutral-50'}`}>
                <span className="text-xl leading-none">{t.emoji}</span>{t.label}
              </button>
            ))}
          </div>

          {type === 'suspect' && (
            <div className="space-y-1.5 rounded-lg border border-warning-200 bg-warning-50 p-3 text-xs text-warning-900">
              <p>Décrivez un <strong>comportement</strong> (lieu, ce que vous avez vu), jamais l’apparence physique, l’origine ou l’identité d’une personne.</p>
              <p className="flex items-center gap-1.5 font-semibold"><Phone className="h-3.5 w-3.5" />Danger immédiat : appelez le 17 ou le 112.</p>
            </div>
          )}

          <div>
            <label htmlFor="danger-comment" className="mb-1.5 block text-sm font-medium text-neutral-700">
              Précisions {type === 'autre' ? '(obligatoire)' : '(facultatif)'}
            </label>
            <textarea id="danger-comment" value={comment} onChange={e => setComment(e.target.value.slice(0, 200))} rows={2}
              placeholder={type === 'chasse' ? 'Ex. battue au grand gibier, panneaux sur le chemin forestier' : 'Ce qu’il faut savoir, en quelques mots'}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary-600" />
            <div className="mt-1 text-right font-mono text-xs text-neutral-400">{comment.length}/200</div>
          </div>

          <div>
            <div className="mb-1.5 text-sm font-medium text-neutral-700">Emplacement</div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setWhere('gps'); if (!gps) locate(); }}
                className={`flex h-12 items-center justify-center gap-2 rounded-md border text-sm font-medium ${where === 'gps' ? 'border-primary-600 bg-primary-50 text-primary-900' : 'border-neutral-200 text-neutral-700'}`}>
                {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}Ma position
              </button>
              <button type="button" disabled={!getMapCenter} onClick={() => setWhere('map')}
                className={`flex h-12 items-center justify-center gap-2 rounded-md border text-sm font-medium disabled:opacity-40 ${where === 'map' ? 'border-primary-600 bg-primary-50 text-primary-900' : 'border-neutral-200 text-neutral-700'}`}>
                <MapPin className="h-4 w-4" />Centre de la carte
              </button>
            </div>
            <p className="mt-1.5 text-xs text-neutral-500">
              {where === 'gps'
                ? (gps ? `Position GPS à ±${gps.accuracy ?? '?'} m.` : gpsError || 'Recherche de votre position…')
                : 'Le danger sera placé au centre de la carte affichée.'}
            </p>
          </div>

          <Button type="button" onClick={submit} disabled={!type || !position || needComment || saving}
            className="h-12 w-full bg-danger-600 hover:bg-danger-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <TriangleAlert className="h-4 w-4" />}
            Signaler
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
