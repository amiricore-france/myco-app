import { useState } from 'react';
import { ChevronDown, History } from 'lucide-react';
import { AGE_CLASSES, PERIODS } from '../../lib/dangers.js';

/** Choix de la période affichée + légende des couleurs d'ancienneté. Posée sur la carte. */
export default function DangerLegend({ days, onDaysChange, count, tooWide }) {
  const [open, setOpen] = useState(false);
  const visible = AGE_CLASSES.filter(c => c.max === 0 || c.max <= days || (days > 30 && c.id === 'older'));
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[400] max-w-[calc(100%-5rem)]">
      <div className="pointer-events-auto rounded-lg border border-neutral-200 bg-white/95 shadow-md backdrop-blur">
        <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open}
          className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-neutral-800">
          <History className="h-3.5 w-3.5 text-danger-600" />
          Dangers · {PERIODS.find(p => p.days === days)?.label}
          <span className="font-mono font-normal text-neutral-500">({count})</span>
          <ChevronDown className={`ml-auto h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="border-t border-neutral-100 px-3 pb-3 pt-2">
            <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label="Période des signalements">
              {PERIODS.map(p => (
                <button key={p.days} type="button" role="radio" aria-checked={days === p.days}
                  onClick={() => onDaysChange(p.days)}
                  className={`h-9 rounded-md px-1.5 text-xs font-medium ${days === p.days ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}>
                  {p.short}
                </button>
              ))}
            </div>
            <ul className="mt-2 space-y-1">
              {visible.map(c => (
                <li key={c.id} className="flex items-center gap-2 text-xs text-neutral-700">
                  <span className="inline-block h-3 w-3 rounded-full border-2 bg-white" style={{ borderColor: c.color }} />
                  {c.label}{c.id === 'today' && ' (actif, alerte à 1 km)'}
                </li>
              ))}
            </ul>
            {tooWide && <p className="mt-2 text-xs text-warning-700">Zoomez pour afficher les signalements.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
