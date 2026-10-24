import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

/**
 * Statut premium de l'utilisateur connecté (profil serveur, mis en cache
 * le temps de la session de page). reload() force une relecture.
 */
let cache = null;
let inflight = null;
const listeners = new Set();

async function fetchProfile(force) {
  if (cache && !force) return cache;
  if (!inflight || force) {
    inflight = api('/auth/profile', { silent401: true })
      .then(p => { cache = p; listeners.forEach(fn => fn(p)); return p; })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export function resetPremiumCache() { cache = null; }

export function usePremium() {
  const [profile, setProfile] = useState(cache);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    const fn = p => setProfile(p);
    listeners.add(fn);
    fetchProfile(false).then(setProfile).catch(() => {}).finally(() => setLoading(false));
    return () => listeners.delete(fn);
  }, []);

  const reload = useCallback(() => fetchProfile(true).catch(() => null), []);
  return { profile, loading, premium: !!profile?.is_premium, reload };
}

export async function startCheckout(interval) {
  const { url } = await api('/billing/checkout', { method: 'POST', body: { interval } });
  window.location.assign(url);
}

export async function openBillingPortal() {
  const { url } = await api('/billing/portal', { method: 'POST' });
  window.location.assign(url);
}
