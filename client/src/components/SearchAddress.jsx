import { useEffect, useState } from 'react';
import { Search, Loader2, X } from 'lucide-react';
import { cn } from '../lib/utils';

export default function SearchAddress({ onSelect, className }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=fr&q=${encodeURIComponent(query)}`;
        const res = await fetch(url, {
          signal: ctrl.signal,
          headers: { Accept: 'application/json' }
        });
        const data = await res.json();
        setResults(data);
        setOpen(true);
      } catch (e) {
        if (e.name !== 'AbortError') console.warn('Recherche échouée', e);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [query]);

  function choose(r) {
    onSelect(
      { lat: parseFloat(r.lat), lng: parseFloat(r.lon) },
      r.display_name
    );
    setOpen(false);
    setQuery(r.display_name.split(',').slice(0, 2).join(','));
  }

  function clear() {
    setQuery('');
    setResults([]);
    setOpen(false);
  }

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          type="text"
          placeholder="Rechercher une ville, forêt, lieu-dit…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          className="h-11 w-full rounded-md border border-neutral-300 bg-white pl-9 pr-9 text-sm placeholder:text-neutral-400 focus-visible:border-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-neutral-400" />
        )}
        {!loading && query && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
            aria-label="Effacer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-neutral-200 bg-white p-1 shadow-lg">
          {results.map(r => (
            <li key={r.place_id}>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => choose(r)}
                className="block w-full rounded-sm px-2.5 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-100"
              >
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
