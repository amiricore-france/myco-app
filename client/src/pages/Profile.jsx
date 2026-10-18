import { useEffect, useState } from 'react';
import { Loader2, Save, Trophy } from 'lucide-react';
import { api } from '../api.js';
import { toast } from '../lib/toast-store';
import PageHeader from '../components/PageHeader.jsx';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState('');
  const [optIn, setOptIn] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const p = await api('/auth/profile');
      setProfile(p);
      setName(p.name || '');
      setOptIn(!!p.leaderboard_opt_in);
    } catch (e) {
      toast.error('Erreur de chargement', e.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api('/auth/profile', {
        method: 'PUT',
        body: { name: name.trim() || null, leaderboard_opt_in: optIn }
      });
      setProfile(updated);
      toast.success('Profil enregistré');
    } catch (e) {
      toast.error('Erreur', e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!profile) {
    return (
      <div className="container-page">
        <div className="mx-auto max-w-lg rounded-xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
          <Skeleton className="mb-3 h-6 w-1/3" />
          <Skeleton className="mb-2 h-12 w-full" />
          <Skeleton className="mb-2 h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container-page">
      <PageHeader
        title="Mon compte"
        subtitle="Vos informations et vos préférences."
      />

      <div className="mx-auto max-w-lg rounded-xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <form onSubmit={save} className="space-y-5">

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              Email
            </label>
            <input
              type="email"
              disabled
              value={profile.email}
              className="flex h-12 w-full cursor-not-allowed rounded-md border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-500"
            />
          </div>

          <div>
            <label htmlFor="profile-name" className="mb-1.5 block text-sm font-medium text-neutral-700">
              Nom affiché
            </label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Votre nom ou pseudo"
              className="flex h-12 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:border-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
            />
            <p className="mt-1 text-xs text-neutral-500">
              Utilisé pour vous identifier dans les partages et le podium.
            </p>
          </div>

          <div className="rounded-lg border border-warning-200 bg-warning-50 p-4">
            <div className="flex items-start gap-3">
              <Trophy className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning-600" />
              <div className="flex-1">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={optIn}
                    onChange={e => setOptIn(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-600"
                  />
                  <div>
                    <div className="text-sm font-semibold text-warning-900">
                      Participer au podium des cueillettes
                    </div>
                    <p className="mt-1 text-xs text-warning-800">
                      Si activé, votre nom et le poids total de vos cueillettes apparaîtront
                      dans le classement mensuel et annuel visible par les autres utilisateurs connectés.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <Button type="submit" disabled={saving} className="h-12 w-full">
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

        </form>
      </div>
    </div>
  );
}
