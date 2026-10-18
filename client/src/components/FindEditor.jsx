import { useRef, useState } from 'react';
import { Camera, ImageIcon, Loader2, Save, X, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { toast } from '../lib/toast-store';
import { useConfirm } from '../hooks/useConfirm';
import { Button } from './ui/button';

const MAX_PHOTOS = 5;

export default function FindEditor({ find, spots, onSave, onCancel, onDeleted }) {
  const [species, setSpecies] = useState(find.species || '');
  const [weight, setWeight] = useState(find.weight_g || '');
  const [spotId, setSpotId] = useState(find.spot_id || '');
  const [notes, setNotes] = useState(find.notes || '');
  const [photos, setPhotos] = useState(find.photos || []);
  const [newPhotos, setNewPhotos] = useState([]);
  const [newPreviews, setNewPreviews] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const [zoom, setZoom] = useState(null);

  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const confirm = useConfirm();

  const totalPhotos = photos.length + newPhotos.length;

  function addFiles(files) {
    const list = Array.from(files || []).filter(f => f.type.startsWith('image/'));
    if (!list.length) return;
    const room = MAX_PHOTOS - totalPhotos;
    const selected = list.slice(0, room);
    setNewPhotos(prev => [...prev, ...selected]);
    setNewPreviews(prev => [...prev, ...selected.map(f => URL.createObjectURL(f))]);
  }

  function removeNewPhoto(index) {
    URL.revokeObjectURL(newPreviews[index]);
    setNewPhotos(prev => prev.filter((_, i) => i !== index));
    setNewPreviews(prev => prev.filter((_, i) => i !== index));
  }

  async function removeExistingPhoto(url) {
    const ok = await confirm({
      title: 'Supprimer cette photo ?',
      description: 'Cette action est irréversible.',
      confirmLabel: 'Supprimer',
    });
    if (!ok) return;

    const filename = url.replace('/uploads/', '');
    try {
      await api(`/finds/${find.id}/photos/${filename}`, { method: 'DELETE' });
      setPhotos(prev => prev.filter(p => p !== url));
      toast.success('Photo supprimée');
    } catch (e) {
      setErr(e.message);
      toast.error('Erreur', e.message);
    }
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      const updated = await api(`/finds/${find.id}`, {
        method: 'PUT',
        body: {
          species: species.trim(),
          weight_g: weight === '' ? null : Number(weight),
          spot_id: spotId === '' ? null : Number(spotId),
          notes: notes.trim()
        }
      });

      if (newPhotos.length > 0) {
        setUploading(true);
        const formData = new FormData();
        newPhotos.forEach(f => formData.append('photos', f));

        const token = localStorage.getItem('token');
        const res = await fetch(`/api/finds/${find.id}/photos`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({ error: 'Erreur upload' }));
          throw new Error(e.error);
        }
        const final = await res.json();
        setUploading(false);
        newPreviews.forEach(p => URL.revokeObjectURL(p));
        onSave(final);
      } else {
        onSave(updated);
      }
    } catch (e) {
      setErr(e.message);
      toast.error('Erreur', e.message);
      setUploading(false);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: 'Supprimer cette cueillette ?',
      description: 'La cueillette et toutes ses photos seront définitivement supprimées.',
      confirmLabel: 'Supprimer',
    });
    if (!ok) return;

    try {
      await api(`/finds/${find.id}`, { method: 'DELETE' });
      onDeleted(find.id);
    } catch (e) {
      setErr(e.message);
      toast.error('Erreur', e.message);
    }
  }

  return (
    <div className="rounded-lg border border-primary-300 bg-white p-4 shadow-sm">
      <form onSubmit={save} className="space-y-3">

        <div className="flex items-center justify-between">
          <h4 className="text-base font-semibold">✏️ Modifier la cueillette</h4>
          <Button type="button" variant="ghost" size="icon" onClick={onCancel} aria-label="Fermer">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700">Espèce *</label>
            <input required value={species} onChange={e => setSpecies(e.target.value)} className="flex h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:border-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700">Poids (g)</label>
            <input type="number" min="0" value={weight} onChange={e => setWeight(e.target.value)} className="flex h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:border-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700">Coin</label>
            <select value={spotId} onChange={e => setSpotId(e.target.value)} className="flex h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:border-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600">
              <option value="">— Aucun —</option>
              {spots.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700">Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} className="flex h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:border-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600" />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-700">
            Photos <span className="font-normal text-neutral-400">({totalPhotos}/{MAX_PHOTOS})</span>
          </label>

          {totalPhotos < MAX_PHOTOS && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => cameraRef.current?.click()}>
                <Camera className="h-3.5 w-3.5" />
                Photo
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => galleryRef.current?.click()}>
                <ImageIcon className="h-3.5 w-3.5" />
                Ajouter
              </Button>
            </div>
          )}

          <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={e => { addFiles(e.target.files); e.target.value = ''; }} style={{ display: 'none' }} />
          <input ref={galleryRef} type="file" accept="image/*" multiple onChange={e => { addFiles(e.target.files); e.target.value = ''; }} style={{ display: 'none' }} />

          {(photos.length > 0 || newPreviews.length > 0) && (
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {photos.map((url, i) => (
                <div key={`ex-${i}`} className="group relative overflow-hidden rounded-md border border-neutral-200 bg-neutral-100">
                  <img src={url} alt={`Photo ${i + 1}`} onClick={() => setZoom(url)} className="h-16 w-full cursor-zoom-in object-cover" />
                  <button type="button" onClick={() => removeExistingPhoto(url)} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900/70 text-white opacity-0 transition-opacity hover:bg-danger-600 group-hover:opacity-100" aria-label="Supprimer">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {newPreviews.map((p, i) => (
                <div key={`new-${i}`} className="relative overflow-hidden rounded-md border border-primary-300 bg-neutral-100">
                  <img src={p} alt={`Nouvelle ${i + 1}`} className="h-16 w-full object-cover" />
                  <button type="button" onClick={() => removeNewPhoto(i)} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900/70 text-white hover:bg-danger-600" aria-label="Retirer">
                    <X className="h-3 w-3" />
                  </button>
                  <span className="absolute bottom-1 left-1 rounded bg-primary-600 px-1 text-[9px] font-semibold uppercase text-white">
                    Nouveau
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {err && (
          <div className="rounded-md border border-danger-200 bg-danger-50 p-2 text-xs text-danger-900">
            {err}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row">
          <Button type="submit" disabled={saving || uploading} size="sm" className="sm:w-auto">
            {(saving || uploading) ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {uploading ? 'Upload…' : 'Enregistrement…'}
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                Enregistrer
              </>
            )}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
            Annuler
          </Button>
          <div className="hidden flex-1 sm:block" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={remove}
            className="gap-1.5 text-danger-600 hover:bg-danger-50 hover:text-danger-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Supprimer
          </Button>
        </div>
      </form>

      {zoom && (
        <div onClick={() => setZoom(null)} className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/85 p-4">
          <img src={zoom} alt="Zoom" className="max-h-[95vh] max-w-[95vw] rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  );
}
