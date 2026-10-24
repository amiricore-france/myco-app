import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Siren, TriangleAlert, CircleCheck, Navigation, Copy, Phone, BatteryMedium, Loader2, EyeOff } from 'lucide-react';
import OutingMap from '../components/outing/OutingMap.jsx';
import { Button } from '../components/ui/button';
import { ago, formatClock, formatCoords, formatDuration } from '../lib/geo.js';
import { toast } from '../lib/toast-store';

/**
 * Page publique de suivi pour les proches (aucun compte requis).
 * Rafraîchie toutes les 20 s tant que la sortie est en cours.
 */
const REFRESH_MS = 20000;

export default function Follow() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [, tick] = useState(0);

  useEffect(() => {
    let stop = false, timer;
    async function load() {
      try {
        const r = await fetch(`/api/outings/follow/${encodeURIComponent(token)}`, { cache: 'no-store' });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Lien de suivi invalide');
        if (stop) return;
        setData(j); setError('');
        if (j.status === 'active') timer = setTimeout(load, REFRESH_MS);
      } catch (e) {
        if (stop) return;
        setError(e.message);
        if (!/invalide|expiré/.test(e.message)) timer = setTimeout(load, REFRESH_MS); // réseau : on réessaie
      }
    }
    load();
    const t = setInterval(() => tick(x => x + 1), 15000);
    return () => { stop = true; clearTimeout(timer); clearInterval(t); };
  }, [token]);

  useEffect(() => {
    document.title = data ? `Suivi de ${data.name} — Myco` : 'Suivi — Myco';
  }, [data]);

  if (error && !data) {
    return (
      <Shell>
        <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center">
          <p className="text-lg font-semibold text-neutral-900">Suivi indisponible</p>
          <p className="mt-1 text-sm text-neutral-600">{error}</p>
        </div>
      </Shell>
    );
  }
  if (!data) {
    return <Shell><p className="flex items-center gap-2 text-sm text-neutral-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement du suivi…</p></Shell>;
  }

  const pos = data.last || data.start;
  const active = data.status === 'active';
  const stale = active && data.last && Date.now() - new Date(data.last.at).getTime() > 30 * 60e3;

  async function copyCoords() {
    try { await navigator.clipboard.writeText(formatCoords(pos)); toast.success('Coordonnées copiées'); }
    catch { window.prompt('Coordonnées :', formatCoords(pos)); }
  }

  return (
    <Shell>
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
        {active ? `${data.name} est en cueillette` : `${data.name} est rentré(e)`}
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Parti(e) à {formatClock(data.started_at)}
        {active && data.expected_return_at && <> · retour prévu à <strong className="text-neutral-700">{formatClock(data.expected_return_at)}</strong></>}
        {!active && data.ended_at && <> · sortie terminée à {formatClock(data.ended_at)} ({formatDuration(new Date(data.ended_at) - new Date(data.started_at))})</>}
      </p>

      <div className="mt-4 space-y-3">
        {data.sos_at && active && (
          <div role="alert" className="rounded-lg border-2 border-danger-600 bg-danger-50 p-4 text-danger-900">
            <p className="flex items-center gap-2 text-lg font-bold"><Siren className="h-5 w-5" /> Appel à l’aide à {formatClock(data.sos_at)}</p>
            <p className="mt-1 text-sm">Essayez de l’appeler. Sans réponse, appelez le 112 et donnez la position ci-dessous : <strong className="text-mono-num">{formatCoords(pos)}</strong></p>
            <Button asChild variant="destructive" size="lg" className="mt-3"><a href="tel:112"><Phone className="h-4 w-4" /> Appeler le 112</a></Button>
          </div>
        )}
        {data.overdue && !data.sos_at && (
          <div className="rounded-lg border border-warning-300 bg-warning-50 p-4 text-sm text-warning-900">
            <p className="flex items-center gap-2 font-semibold"><TriangleAlert className="h-4 w-4" /> Heure de retour dépassée</p>
            <p className="mt-1">Ce n’est peut-être qu’un oubli de signaler son retour : essayez de l’appeler.</p>
          </div>
        )}
        {!active && (
          <div className="flex items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 p-3 text-sm text-primary-900">
            <CircleCheck className="h-4 w-4" /> Sortie terminée : le suivi est arrêté.
          </div>
        )}
        {!data.share_live && (
          <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
            <EyeOff className="h-4 w-4" /> {data.name} ne partage pas sa position en direct. Seul le point de départ est affiché.
          </div>
        )}
      </div>

      <OutingMap track={data.points} start={data.start} car={data.car} current={data.last} meColor="#c2410c" followCurrent
        className="mt-4 h-[380px] sm:h-[480px]" />

      {pos && (
        <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className={stale ? 'font-medium text-warning-700' : 'text-neutral-700'}>
              {data.last ? <>Dernière position {ago(data.last.at)}{data.last.accuracy ? ` (± ${data.last.accuracy} m)` : ''}</> : 'Point de départ'}
            </span>
            {data.battery != null && (
              <span className="inline-flex items-center gap-1 text-neutral-600"><BatteryMedium className="h-4 w-4" /> {data.battery} %</span>
            )}
            <span className="text-mono-num text-neutral-500">{formatCoords(pos)}</span>
          </div>
          {stale && <p className="mt-1 text-xs text-neutral-500">Pas de mise à jour récente : souvent l’absence de réseau en forêt ou un écran éteint.</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="lg">
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${pos.lat},${pos.lng}`} target="_blank" rel="noopener noreferrer">
                <Navigation className="h-4 w-4" /> Itinéraire
              </a>
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={copyCoords}><Copy className="h-4 w-4" /> Copier les coordonnées</Button>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-neutral-500">
        🚗 véhicule · 🏁 départ · pointillés : chemin parcouru. {active ? 'Mise à jour automatique toutes les 20 secondes.' : ''}
      </p>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-5 sm:px-6 sm:py-8">
      <div className="mb-4 flex items-center gap-2 font-bold text-neutral-900"><span className="text-2xl">🍄</span> Myco · suivi de sortie</div>
      {children}
    </div>
  );
}
