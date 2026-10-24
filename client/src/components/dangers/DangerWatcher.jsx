import { useEffect } from 'react';
import { useOuting } from '../../lib/outing.js';
import { notePosition } from '../../lib/dangers.js';

/**
 * Veille globale : à chaque position GPS connue pendant une sortie, vérifie
 * les signalements du jour à moins d'1 km. Ne rend rien.
 */
export default function DangerWatcher() {
  const { current } = useOuting();
  useEffect(() => {
    if (current) notePosition(current);
  }, [current?.lat, current?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
