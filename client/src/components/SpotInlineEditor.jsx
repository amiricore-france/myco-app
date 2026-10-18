import { useState } from 'react';
import { Loader2, Save, X } from 'lucide-react';
import { api } from '../api.js';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';

export default function SpotInlineEditor({ spot, onSave, onCancel }) {
  const [name, setName] = useState(spot.name);
  const [description, setDescription] = useState(spot.description || '');
  const [radius, setRadius] = useState(spot.radius_m || 50);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

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
      onSave(updated);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">✏️ Modifier le coin</h3>
        <Button type="button" variant="ghost" size="icon" onClick={onCancel} aria-label="Annuler">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div>
        <Label htmlFor={`name-${spot.id}`}>Nom du coin *</Label>
        <Input
          id={`name-${spot.id}`}
          required
          value={name}
          onChange={e => setName(e.target.value)}
          className="h-12"
          autoFocus
        />
      </div>

      <div>
        <Label htmlFor={`desc-${spot.id}`}>Description</Label>
        <Textarea
          id={`desc-${spot.id}`}
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={2}
          placeholder="Ex. sous les chênes au bord du chemin…"
        />
      </div>

      <div>
        <Label htmlFor={`radius-${spot.id}`}>Rayon indicatif (m)</Label>
        <Input
          id={`radius-${spot.id}`}
          type="number"
          min="10"
          max="1000"
          value={radius}
          onChange={e => setRadius(e.target.value)}
          className="h-12"
        />
        <p className="mt-1.5 text-xs text-neutral-500">
          Ce rayon est purement indicatif, il n'affecte pas la position exacte.
        </p>
      </div>

      {err && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-900">
          {err}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button type="submit" disabled={saving} className="flex-1 sm:flex-none">
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
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1 sm:flex-none">
          Annuler
        </Button>
      </div>
    </form>
  );
}
