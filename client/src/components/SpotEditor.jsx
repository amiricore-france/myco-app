import { useState } from 'react';
import { Loader2, Save, X, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { toast } from '../lib/toast-store';
import { useConfirm } from '../hooks/useConfirm';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import ShareSpotPanel from './ShareSpotPanel.jsx';

export default function SpotEditor({ spot, onUpdated, onDeleted, onCancel }) {
  const [name, setName] = useState(spot.name);
  const [description, setDescription] = useState(spot.description || '');
  const [radius, setRadius] = useState(spot.radius_m || 50);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const confirm = useConfirm();

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      const updated = await api(`/spots/${spot.id}`, {
        method: 'PUT',
        body: {
          name: name.trim(),
          description: description.trim(),
          radius_m: Number(radius)
        }
      });
      toast.success('Coin enregistré');
      onUpdated(updated);
    } catch (e) {
      setErr(e.message);
      toast.error('Erreur', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `Supprimer "${spot.name}" ?`,
      description: 'Cette action est irréversible.',
      confirmLabel: 'Supprimer',
    });
    if (!ok) return;

    try {
      await api(`/spots/${spot.id}`, { method: 'DELETE' });
      toast.success('Coin supprimé');
      onDeleted(spot.id);
    } catch (e) {
      setErr(e.message);
      toast.error('Erreur', e.message);
    }
  }

  return (
    <div className="rounded-xl border border-primary-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">✏️ Modifier le coin</h3>
          <p className="mt-0.5 font-mono text-xs tabular-nums text-neutral-500">
            📍 {spot.lat.toFixed(5)}, {spot.lng.toFixed(5)}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onCancel}
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form onSubmit={save} className="space-y-4">
        <div>
          <Label htmlFor={`edit-name-${spot.id}`}>Nom du coin *</Label>
          <Input
            id={`edit-name-${spot.id}`}
            required
            value={name}
            onChange={e => setName(e.target.value)}
            className="h-12"
          />
        </div>

        <div>
          <Label htmlFor={`edit-desc-${spot.id}`}>Description</Label>
          <Textarea
            id={`edit-desc-${spot.id}`}
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
          />
        </div>

        <div>
          <Label htmlFor={`edit-radius-${spot.id}`}>Rayon indicatif (m)</Label>
          <Input
            id={`edit-radius-${spot.id}`}
            type="number"
            min="10"
            max="1000"
            value={radius}
            onChange={e => setRadius(e.target.value)}
            className="h-12"
          />
        </div>

        {err && (
          <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-900">
            {err}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap">
          <Button type="submit" disabled={saving} className="h-12 flex-1 sm:flex-none">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enregistrement…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Enregistrer
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            className="h-12 flex-1 sm:flex-none"
          >
            Annuler
          </Button>
          <div className="hidden flex-1 sm:block" />
          <Button
            type="button"
            variant="ghost"
            onClick={remove}
            className="h-12 gap-2 text-danger-600 hover:bg-danger-50 hover:text-danger-700"
          >
            <Trash2 className="h-4 w-4" />
            Supprimer
          </Button>
        </div>
      </form>

      <div className="mt-5 border-t border-neutral-100 pt-5">
        <ShareSpotPanel spot={spot} />
      </div>
    </div>
  );
}
