import { useEffect, useState } from 'react';
import { CloudRain, Thermometer, RefreshCw, Info } from 'lucide-react';
import { api } from '../api.js';
import { usePremium } from '../lib/premium.js';
import PremiumUpsell from './PremiumUpsell.jsx';
import { Skeleton } from './ui/skeleton';

const LEVEL_STYLE = {
  excellente: { bar: 'bg-primary-600', text: 'text-primary-800', chip: 'border-primary-200 bg-primary-50 text-primary-900' },
  bonne:      { bar: 'bg-primary-500', text: 'text-primary-700', chip: 'border-primary-200 bg-primary-50 text-primary-900' },
  moyenne:    { bar: 'bg-warning-500', text: 'text-warning-700', chip: 'border-warning-200 bg-warning-50 text-warning-900' },
  faible:     { bar: 'bg-neutral-400', text: 'text-neutral-600', chip: 'border-neutral-200 bg-neutral-100 text-neutral-700' },
  inconnu:    { bar: 'bg-neutral-300', text: 'text-neutral-500', chip: 'border-neutral-200 bg-neutral-100 text-neutral-600' }
};

/** Indice de poussée de chaque coin, calculé chaque jour à partir de la météo (Premium). */
export default function FlushForecast() {
  const { premium, loading: loadingProfile } = usePremium();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  async function load() {
    setLoading(true); setError('');
    try { setData(await api('/alerts/forecast')); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (premium) load(); }, [premium]);

  if (loadingProfile) return null;
  if (!premium) {
    return (
      <section className="mb-6">
        <PremiumUpsell title="Alertes de poussée">
          Chaque matin, Myco croise la pluie des deux dernières semaines et les températures avec
          vos coins, et vous prévient par e-mail ou notification quand les conditions deviennent favorables.
        </PremiumUpsell>
      </section>
    );
  }

  const spots = data?.spots || [];
  const shown = showAll ? spots : spots.slice(0, 5);

  return (
    <section className="mb-6 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Conditions de poussée</h2>
          <p className="text-sm text-neutral-500">Indice météo de vos coins, du plus au moins favorable.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} aria-label="Actualiser"
          className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <p className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-900">{error}</p>}

      {!data && !error && (
        <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
      )}

      {data && spots.length === 0 && (
        <p className="text-sm text-neutral-500">Ajoutez un coin sur la carte pour voir son indice de poussée.</p>
      )}

      {shown.length > 0 && (
        <ul className="divide-y divide-neutral-100">
          {shown.map(s => {
            const st = LEVEL_STYLE[s.level] || LEVEL_STYLE.inconnu;
            return (
              <li key={s.spot_id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-neutral-900">{s.name}</div>
                    {s.score != null && (
                      <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-neutral-500">
                        <span className="inline-flex items-center gap-1"><CloudRain className="h-3 w-3" />{s.rain14} mm / 14 j</span>
                        <span className="inline-flex items-center gap-1"><Thermometer className="h-3 w-3" />{s.temp} °C</span>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-sm border px-2 py-0.5 text-xs font-medium ${st.chip}`}>{s.level}</span>
                    <span className={`w-12 text-right font-mono text-lg font-semibold ${st.text}`}>
                      {s.score ?? '—'}
                    </span>
                  </div>
                </div>
                {s.score != null && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                    <div className={`h-full rounded-full ${st.bar}`} style={{ width: `${s.score}%` }} />
                  </div>
                )}
                <p className="mt-1.5 text-xs text-neutral-500">{s.reasons.join(' · ')}</p>
              </li>
            );
          })}
        </ul>
      )}

      {spots.length > 5 && (
        <button type="button" onClick={() => setShowAll(v => !v)}
          className="mt-2 text-sm font-medium text-primary-700 hover:underline">
          {showAll ? 'Afficher moins' : `Afficher les ${spots.length} coins`}
        </button>
      )}

      <p className="mt-4 flex gap-2 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Indication fondée uniquement sur la météo (pluie, température, gel) : le sol, les essences et
        l’exposition comptent tout autant. Alerte envoyée au-delà de {data?.threshold ?? 60}/100.
      </p>
    </section>
  );
}
