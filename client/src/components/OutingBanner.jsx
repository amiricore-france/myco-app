import { Link, useLocation } from 'react-router-dom';
import { Footprints, Siren, ChevronRight } from 'lucide-react';
import { useOuting } from '../lib/outing.js';
import { distance, formatDistance } from '../lib/geo.js';

/** Bandeau visible partout dans l'appli pendant une sortie (sauf sur la page Sortie). */
export default function OutingBanner() {
  const snap = useOuting();
  const { pathname } = useLocation();
  const o = snap.outing;
  if (!o || pathname === '/sortie') return null;

  const target = o.car || o.start;
  const d = snap.current && target ? distance(snap.current, target) : null;
  const sosOn = !!o.sosAt;

  return (
    <Link to="/sortie"
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white hover:no-underline ${sosOn ? 'bg-danger-700' : 'bg-sage-700'}`}>
      {sosOn ? <Siren className="h-4 w-4" /> : <Footprints className="h-4 w-4" />}
      <span className="flex-1 truncate">
        {sosOn ? 'Appel à l’aide en cours' : o.endedLocal ? 'Fin de sortie en attente de réseau' : 'Sortie en cours'}
        {d != null && !sosOn && <> · {o.car ? 'véhicule' : 'départ'} à {formatDistance(d)}</>}
      </span>
      <ChevronRight className="h-4 w-4" />
    </Link>
  );
}
