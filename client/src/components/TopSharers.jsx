import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { api } from '../api.js';
import { Skeleton } from './ui/skeleton';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function TopSharers() {
  const [sharers, setSharers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/stats/top-sharers')
      .then(setSharers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mb-4 rounded-xl border border-warning-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Trophy className="h-5 w-5 text-warning-600" />
          Top 10 des partageurs
        </h3>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sharers.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-warning-200 bg-white p-5 shadow-sm sm:p-6">
      <h3 className="mb-1 flex items-center gap-2 text-lg font-semibold">
        <Trophy className="h-5 w-5 text-warning-600" />
        Top 10 des partageurs
      </h3>
      <p className="mb-4 text-sm text-neutral-500">
        Les utilisateurs qui ont le plus partagé de coins (partages acceptés).
      </p>

      <ol className="space-y-1">
        {sharers.map((s, i) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2 last:border-b-0"
          >
            <span className="flex items-center gap-2 truncate">
              <span className="w-6 flex-shrink-0 text-center">
                {i < 3 ? MEDALS[i] : <span className="font-mono text-xs text-neutral-400">{i + 1}.</span>}
              </span>
              <span className="truncate font-medium text-neutral-800">{s.display_name}</span>
            </span>
            <span className="flex-shrink-0 font-mono text-sm tabular-nums text-primary-700">
              {s.share_count} partage{s.share_count > 1 ? 's' : ''}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
