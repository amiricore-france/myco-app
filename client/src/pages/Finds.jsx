import { useEffect, useRef, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { Camera, Edit3, ImageIcon, Loader2, Trash2, X } from 'lucide-react';
import { api } from '../api.js';
import { toast } from '../lib/toast-store';
import { useConfirm } from '../hooks/useConfirm';
import PageHeader from '../components/PageHeader.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { Button } from '../components/ui/button';
import { SkeletonCard, SkeletonStat } from '../components/ui/skeleton';
import FindEditor from '../components/FindEditor.jsx';

const MAX_PHOTOS = 5;

export default function Finds() {
  const [stats, setStats] = useState(null);
  const [finds, setFinds] = useState([]);
  const [spots, setSpots] = useState([]);
  const [form, setForm] = useState({ species: '', weight_g: '', spot_id: '', notes: '' });
  const [photos, setPhotos] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const confirm = useConfirm();

  async function refresh() {
    setLoading(true);
    try {
      const [s, f, sp] = await Promise.all([
        api('/stats/summary'),
        api('/finds'),
        api('/spots')
      ]);
      setStats(s);
      setFinds(f);
      setSpots(sp);
    } catch (e) {
      toast.error('Erreur de chargement', e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const species = params.get('species');
    if (species) {
      setForm(f => ({ ...f, species }));
      setTimeout(() => {
        document.getElementById('find-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, []);

  useEffect(() => {
    return () => previews.forEach(p => URL.revokeObjectURL(p));
  }, [previews]);

  function addPhotos(files) {
    const list = Array.from(files || []).filter(f => f.type.startsWith('image/'));
    if (!list.length) return;
    const room = MAX_PHOTOS - photos.length;
    const selected = list.slice(0, room);
    setPhotos(prev => [...prev, ...selected]);
    setPreviews(prev => [...prev, ...selected.map(f => URL.createObjectURL(f))]);
  }

  function removePhoto(index) {
    URL.revokeObjectURL(previews[index]);
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  }

  function clearPhotos() {
    previews.forEach(p => URL.revokeObjectURL(p));
    setPhotos([]);
    setPreviews([]);
  }

  async function addFind(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('species', form.species);
      if (form.weight_g) formData.append('weight_g', Number(form.weight_g));
      if (form.spot_id) formData.append('spot_id', Number(form.spot_id));
      if (form.notes) formData.append('notes', form.notes);
      photos.forEach(f => formData.append('photos', f));

      const token = localStorage.getItem('token');
      const res = await fetch('/api/finds', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erreur' }));
        throw new Error(err.error || 'Erreur');
      }

      setForm({ species: '', weight_g: '', spot_id: '', notes: '' });
      clearPhotos();
      await refresh();
      toast.success('Cueillette ajoutée');
    } catch (err) {
      toast.error('Erreur', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function removeFind(id) {
    const ok = await confirm({
      title: 'Supprimer cette cueillette ?',
      description: 'La cueillette et ses photos seront définitivement supprimées.',
      confirmLabel: 'Supprimer',
    });
    if (!ok) return;

    try {
      await api(`/finds/${id}`, { method: 'DELETE' });
      setFinds(finds.filter(x => x.id !== id));
      toast.success('Cueillette supprimée');
    } catch (e) {
      toast.error('Erreur', e.message);
    }
  }

  async function deletePhoto(findId, filename) {
    const ok = await confirm({
      title: 'Supprimer cette photo ?',
      description: 'Cette action est irréversible.',
      confirmLabel: 'Supprimer',
    });
    if (!ok) return;

    try {
      await api(`/finds/${findId}/photos/${filename}`, { method: 'DELETE' });
      toast.success('Photo supprimée');
      refresh();
    } catch (e) {
      toast.error('Erreur', e.message);
    }
  }

  const speciesData = stats
    ? stats.bySpecies.map(s => ({ name: s.species, poids_kg: +(s.total_g / 1000).toFixed(2), count: s.count }))
    : [];
  const monthData = stats
    ? stats.byMonth.map(m => ({ name: m.month, poids_kg: +(m.total_g / 1000).toFixed(2), count: m.count }))
    : [];

  return (
    <div className="container-page">
      <PageHeader
        title="Mes cueillettes"
        subtitle="Toutes vos cueillettes enregistrées, avec leurs poids, leurs coins et leurs photos."
      />

      {loading && (
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SkeletonStat />
          <SkeletonStat />
          <SkeletonStat />
        </div>
      )}

      {!loading && stats && (
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="font-mono text-3xl font-bold text-primary-600 sm:text-4xl">{stats.totals.finds}</div>
            <div className="mt-1 text-sm text-neutral-500">Cueillettes</div>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="font-mono text-3xl font-bold text-primary-600 sm:text-4xl">{(stats.totals.total_g / 1000).toFixed(2)} kg</div>
            <div className="mt-1 text-sm text-neutral-500">Poids total cueilli</div>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="font-mono text-3xl font-bold text-primary-600 sm:text-4xl">{stats.totals.spots}</div>
            <div className="mt-1 text-sm text-neutral-500">Coins enregistrés</div>
          </div>
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-neutral-800">Par espèce (kg)</h3>
          {speciesData.length === 0 ? <p className="text-sm text-neutral-500">Aucune donnée</p> : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={speciesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e7e5e4', fontSize: 13 }} formatter={v => [`${v} kg`, 'Poids']} />
                <Bar dataKey="poids_kg" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-neutral-800">Par mois (kg)</h3>
          {monthData.length === 0 ? <p className="text-sm text-neutral-500">Aucune donnée</p> : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e7e5e4', fontSize: 13 }} formatter={v => [`${v} kg`, 'Poids']} />
                <Bar dataKey="poids_kg" fill="#4d7c5a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div id="find-form" className="mb-4 rounded-xl border border-primary-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="mb-4 text-lg font-semibold text-neutral-900">Nouvelle cueillette</h3>
        <form onSubmit={addFind} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="find-species" className="mb-1.5 block text-sm font-medium text-neutral-700">Espèce *</label>
            <input id="find-species" required value={form.species} onChange={e => setForm({ ...form, species: e.target.value })} placeholder="Ex. Boletus edulis" className="flex h-12 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus-visible:border-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600" />
          </div>
          <div>
            <label htmlFor="find-weight" className="mb-1.5 block text-sm font-medium text-neutral-700">Poids (g)</label>
            <input id="find-weight" type="number" min="0" value={form.weight_g} onChange={e => setForm({ ...form, weight_g: e.target.value })} className="flex h-12 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus-visible:border-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600" />
          </div>
          <div>
            <label htmlFor="find-spot" className="mb-1.5 block text-sm font-medium text-neutral-700">Coin</label>
            <select id="find-spot" value={form.spot_id} onChange={e => setForm({ ...form, spot_id: e.target.value })} className="flex h-12 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus-visible:border-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600">
              <option value="">— Aucun —</option>
              {spots.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="find-notes" className="mb-1.5 block text-sm font-medium text-neutral-700">Notes</label>
            <input id="find-notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="flex h-12 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus-visible:border-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600" />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              Photos <span className="font-normal text-neutral-400">({photos.length}/{MAX_PHOTOS})</span>
            </label>
            {photos.length < MAX_PHOTOS && (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="lg" onClick={() => cameraRef.current?.click()}>
                  <Camera className="h-4 w-4" />
                  Prendre une photo
                </Button>
                <Button type="button" variant="outline" size="lg" onClick={() => galleryRef.current?.click()}>
                  <ImageIcon className="h-4 w-4" />
                  Ajouter des photos
                </Button>
              </div>
            )}
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={e => { addPhotos(e.target.files); e.target.value = ''; }} style={{ display: 'none' }} />
            <input ref={galleryRef} type="file" accept="image/*" multiple onChange={e => { addPhotos(e.target.files); e.target.value = ''; }} style={{ display: 'none' }} />
            {previews.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {previews.map((p, i) => (
                  <div key={i} className="relative overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100">
                    <img src={p} alt={`Aperçu ${i + 1}`} className="h-20 w-full object-cover" />
                    <button type="button" onClick={() => removePhoto(i)} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900/70 text-white hover:bg-danger-600" aria-label="Retirer">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="sm:col-span-2">
            <Button type="submit" disabled={submitting} className="h-12 w-full sm:w-auto">
              {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" />Enregistrement…</>) : 'Ajouter la cueillette'}
            </Button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="mb-4 text-lg font-semibold text-neutral-900">Historique des cueillettes</h3>
        {loading ? (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : finds.length === 0 ? (
          <EmptyState icon="🍄" title="Aucune cueillette enregistrée" description="Ajoutez votre première cueillette via le formulaire ci-dessus." />
        ) : (
          <div className="space-y-3">
            {finds.map(f => (
              editingId === f.id ? (
                <FindEditor
                  key={f.id}
                  find={f}
                  spots={spots}
                  onSave={updated => {
                    setEditingId(null);
                    setFinds(finds.map(x => (x.id === updated.id ? updated : x)));
                    toast.success('Cueillette modifiée');
                  }}
                  onDeleted={id => {
                    setEditingId(null);
                    setFinds(finds.filter(x => x.id !== id));
                    refresh();
                    toast.success('Cueillette supprimée');
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div key={f.id} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-neutral-900">{f.species}</div>
                      <div className="mt-0.5 text-xs text-neutral-500">
                        {new Date(f.found_at).toLocaleDateString('fr-FR')}
                        {f.weight_g && <span className="ml-2 font-mono">{f.weight_g} g</span>}
                        {f.spot_name && <span className="ml-2">📍 {f.spot_name}</span>}
                      </div>
                      {f.notes && <div className="mt-1 text-xs italic text-neutral-500">{f.notes}</div>}
                    </div>
                    <div className="flex flex-shrink-0 gap-1">
                      <button type="button" onClick={() => setEditingId(f.id)} className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-primary-50 hover:text-primary-700" aria-label="Modifier" title="Modifier">
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => removeFind(f.id)} className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-danger-50 hover:text-danger-600" aria-label="Supprimer">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {f.photos?.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {f.photos.map((url, i) => {
                        const filename = url.replace('/uploads/', '');
                        return (
                          <div key={i} className="group relative overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100">
                            <img src={url} alt={`Photo ${i + 1}`} onClick={() => setZoom(url)} className="h-20 w-full cursor-zoom-in object-cover" loading="lazy" />
                            <button type="button" onClick={() => deletePhoto(f.id, filename)} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900/70 text-white opacity-0 transition-opacity hover:bg-danger-600 group-hover:opacity-100" aria-label="Supprimer cette photo">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )
            ))}
          </div>
        )}
      </div>

      {zoom && (
        <div onClick={() => setZoom(null)} className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/85 p-4">
          <img src={zoom} alt="Aperçu agrandi" className="max-h-[95vh] max-w-[95vw] rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
          <button type="button" onClick={() => setZoom(null)} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur hover:bg-white/30" aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
