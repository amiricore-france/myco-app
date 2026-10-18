import { useState } from 'react';
import { Loader2, Save, X } from 'lucide-react';
import { api } from '../api.js';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';

export default function SpotForm({ position, onCreated, onCancel }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [radius, setRadius] = useState(50);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      const spot = await api('/spots', {
        method: 'POST',
        body: {
          name: name.trim(),
          description: description.trim(),
          lat: position.lat,
          lng: position.lng,
          radius_m: Number(radius)
        }
      });
      onCreated(spot);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-primary-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">Nouveau coin</h3>
          <p className="mt-0.5 font-mono text-xs tabular-nums text-neutral-500">
            📍 {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onCancel}
          aria-label="Annuler"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="new-name">Nom du coin *</Label>
          <Input
            id="new-name"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex. Sous les chênes du chemin"
            className="h-12"
            autoFocus
          />
        </div>

        <div>
          <Label htmlFor="new-desc">Description</Label>
          <Textarea
            id="new-desc"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            placeholder="Ex. à droite après le grand chêne…"
          />
        </div>

        <div>
          <Label htmlFor="new-radius">Rayon indicatif (m)</Label>
          <Input
            id="new-radius"
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

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
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
        </div>
      </form>
    </div>
  );
}
