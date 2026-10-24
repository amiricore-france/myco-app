import { Compass } from 'lucide-react';
import { bearing, cardinal, distance, formatDistance } from '../../lib/geo.js';
import { Button } from '../ui/button';

/**
 * Guidage vers le véhicule (ou le point de départ) : distance + flèche.
 * Avec la boussole du téléphone, le cadran tourne comme une vraie boussole
 * et la flèche montre la direction réelle à suivre. Sans boussole, le cadran
 * reste nord en haut.
 */
export default function ReturnCompass({ from, target, targetLabel, heading, needsPermission, onRequestPermission }) {
  if (!target) return null;
  if (!from) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
        <Compass className="h-5 w-5 animate-pulse text-neutral-400" />
        Recherche du signal GPS…
      </div>
    );
  }

  const d = distance(from, target);
  const b = bearing(from, target);
  const arrived = d <= Math.max(25, (from.accuracy || 0) * 0.8);
  const dial = heading != null ? -heading : 0;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 sm:p-5">
      <div className="flex items-center gap-4 sm:gap-6">
        <svg viewBox="0 0 200 200" className="h-36 w-36 flex-shrink-0 sm:h-44 sm:w-44" role="img"
          aria-label={arrived ? 'Arrivé' : `Direction ${cardinal(b)}`}>
          <circle cx="100" cy="100" r="96" fill="#fafaf9" stroke="#e7e5e4" strokeWidth="2" />
          <g transform={`rotate(${dial} 100 100)`} style={{ transition: 'transform 200ms linear' }}>
            {Array.from({ length: 36 }, (_, i) => (
              <line key={i} x1="100" y1="8" x2="100" y2={i % 9 === 0 ? 22 : 15}
                stroke={i === 0 ? '#b91c1c' : '#a8a29e'} strokeWidth={i % 9 === 0 ? 3 : 1.5}
                transform={`rotate(${i * 10} 100 100)`} />
            ))}
            {[['N', 0], ['E', 90], ['S', 180], ['O', 270]].map(([l, a]) => (
              <text key={l} x="100" y="40" textAnchor="middle" fontSize="15" fontWeight="700"
                fill={l === 'N' ? '#b91c1c' : '#57534e'} transform={`rotate(${a} 100 100)`}
                fontFamily="Inter, system-ui, sans-serif">{l}</text>
            ))}
            {!arrived && (
              <g transform={`rotate(${b} 100 100)`}>
                <path d="M100 46 L124 112 L100 100 L76 112 Z" fill="#16a34a" stroke="#14532d" strokeWidth="2" strokeLinejoin="round" />
                <path d="M100 100 L100 150" stroke="#14532d" strokeWidth="6" strokeLinecap="round" />
              </g>
            )}
          </g>
          {arrived && <text x="100" y="114" textAnchor="middle" fontSize="40">🎉</text>}
          <circle cx="100" cy="100" r="5" fill="#1c1917" />
        </svg>

        <div className="min-w-0">
          <p className="text-sm text-neutral-500">{targetLabel}</p>
          {arrived ? (
            <p className="text-2xl font-bold text-primary-700">Vous y êtes</p>
          ) : (
            <>
              <p className="text-mono-num text-4xl font-bold leading-none text-neutral-900 sm:text-5xl">{formatDistance(d)}</p>
              <p className="mt-2 text-base text-neutral-700">
                vers le <strong>{cardinal(b)}</strong> <span className="text-mono-num text-neutral-500">({Math.round(b)}°)</span>
              </p>
            </>
          )}
          <p className="mt-2 text-xs text-neutral-500">
            {heading != null
              ? 'Tenez le téléphone à plat : la flèche indique la direction à suivre.'
              : 'Sans boussole : le cadran est orienté nord en haut.'}
            {from.accuracy ? ` Précision GPS ± ${from.accuracy} m.` : ''}
          </p>
          {needsPermission && (
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onRequestPermission}>
              <Compass className="h-4 w-4" /> Activer la boussole
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
