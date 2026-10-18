import { useEffect, useState } from 'react';
import { Trophy, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { api } from '../api.js';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';

const MEDALS = ['🥇', '🥈', '🥉'];

// Hauteur + style par rang réel (0=1er, 1=2e, 2=3e)
const STYLES = [
  { h: 'h-24', bg: 'bg-warning-100', text: 'text-warning-900', fontSize: 'text-2xl', weight: 'font-bold' },
  { h: 'h-18', bg: 'bg-neutral-100', text: 'text-neutral-700', fontSize: 'text-xl', weight: 'font-semibold' },
  { h: 'h-14', bg: 'bg-neutral-100', text: 'text-neutral-600', fontSize: 'text-xl', weight: 'font-semibold' },
];

function PodiumStep({ user, rank }) {
  // rank : 0 = 1er, 1 = 2e, 2 = 3e
  const s = STYLES[rank];
  const isFirst = rank === 0;

  if (!user) {
    return (
      <div className={`${s.h} ${s.bg} flex flex-1 items-end justify-center rounded-t-lg pb-2 opacity-50`}>
        <div className="text-center text-xs text-neutral-400">—</div>
      </div>
    );
  }

  const kg = (user.total_g / 1000).toFixed(2);

  return (
    <div className={`${s.h} ${s.bg} flex flex-1 flex-col items-center justify-end rounded-t-lg pb-2 px-1`}>
      <div className={`mb-0.5 ${s.fontSize}`}>{MEDALS[rank]}</div>
      <div className={`truncate w-full text-center text-xs ${s.weight} ${s.text}`} title={user.display_name}>
        {user.display_name}
      </div>
      <div className={`font-mono text-xs tabular-nums ${s.text} ${isFirst ? 'font-bold' : ''}`}>
        {kg} kg
      </div>
    </div>
  );
}

export default function Podium() {
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  async function load(p = period) {
    setLoading(true);
    try {
      const d = await api(`/stats/leaderboard?period=${p}`);
      setData(d);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(period); }, [period]);

  if (loading) return null;

  const top3 = data?.leaderboard?.slice(0, 3) || [];
  const top10 = data?.leaderboard || [];
  const me = data?.me;
  const isEmpty = top10.length === 0;
  const monthNames = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const periodLabel = period === 'month'
    ? monthNames[(data?.month || 1) - 1] + ' ' + (data?.year || '')
    : `année ${data?.year || ''}`;

  // Ordre visuel : 2e à gauche, 1er au centre, 3e à droite
  // On associe chaque élément à son rang réel : 1, 0, 2
  const podiumItems = [
    { user: top3[1], rank: 1 },  // 2e
    { user: top3[0], rank: 0 },  // 1er
    { user: top3[2], rank: 2 },  // 3e
  ];

  return (
    <div className="mb-4 rounded-xl border border-warning-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-warning-100 bg-warning-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-warning-600" />
          <h2 className="text-base font-semibold text-warning-900">
            Podium des cueillettes
          </h2>
        </div>
        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList className="h-8">
            <TabsTrigger value="month" className="px-3 py-1 text-xs">Mois</TabsTrigger>
            <TabsTrigger value="year" className="px-3 py-1 text-xs">Année</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="p-4">
        <p className="mb-3 text-xs text-neutral-500">
          Poids total cueilli — {periodLabel}
        </p>

        {isEmpty ? (
          <div className="flex items-start gap-2 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-500">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>Aucune cueillette enregistrée pour cette période. Soyez le premier à participer !</span>
          </div>
        ) : (
          <>
            {/* Podium visuel : 2e - 1er - 3e */}
            <div className="flex items-end justify-center gap-1 px-2">
              {podiumItems.map((item, i) => (
                <PodiumStep key={i} user={item.user} rank={item.rank} />
              ))}
            </div>

            {/* Lien vers le top 10 */}
            {top10.length > 3 && (
              <>
                <button
                  type="button"
                  onClick={() => setExpanded(e => !e)}
                  className="mt-3 flex w-full items-center justify-center gap-1 text-xs font-medium text-primary-700 hover:underline"
                >
                  {expanded ? (
                    <>Masquer le classement complet <ChevronUp className="h-3.5 w-3.5" /></>
                  ) : (
                    <>Voir le top {top10.length} <ChevronDown className="h-3.5 w-3.5" /></>
                  )}
                </button>

                {expanded && (
                  <ol className="mt-3 space-y-1 border-t border-neutral-100 pt-3 text-sm">
                    {top10.map((u, i) => (
                      <li key={u.id} className="flex items-center justify-between gap-3 py-1">
                        <span className="flex items-center gap-2 truncate">
                          <span className="w-5 flex-shrink-0 text-right font-mono text-xs text-neutral-400">{i + 1}.</span>
                          <span className="truncate font-medium text-neutral-800">{u.display_name}</span>
                        </span>
                        <span className="flex-shrink-0 font-mono text-xs tabular-nums text-neutral-600">
                          {(u.total_g / 1000).toFixed(2)} kg
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
          </>
        )}

        {/* Ma position */}
        {me && (
          <div className="mt-3 border-t border-neutral-100 pt-3">
            {me.opt_in ? (
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 text-neutral-700">
                  <span className="font-semibold">Ma position :</span>
                  {me.rank ? `#${me.rank}` : '—'}
                </span>
                <span className="font-mono text-xs tabular-nums text-neutral-600">
                  {(me.total_g / 1000).toFixed(2)} kg
                </span>
              </div>
            ) : (
              <p className="text-xs text-neutral-500">
                Vous ne participez pas au classement.{' '}
                <a href="/profile" className="font-medium text-primary-700 hover:underline">
                  Activer dans mon profil
                </a>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
