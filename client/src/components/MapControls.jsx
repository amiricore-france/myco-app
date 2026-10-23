import { Plus, Download } from 'lucide-react';
import { Button } from './ui/button';

/**
 * Boutons flottants au-dessus de la carte (dans le conteneur Leaflet).
 * À placer en absolute top-X right-X sur le parent .map-wrap.
 */
export default function MapControls({ onLocate, onAdd, onOffline, locating }) {
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-[400] flex flex-col gap-2">
      <Button
        type="button"
        size="icon"
        onClick={onLocate}
        disabled={locating}
        title="Me localiser"
        aria-label="Me localiser"
        className="pointer-events-auto h-11 w-11 rounded-md shadow-md"
      >
        {locating ? '⏳' : '📍'}
      </Button>
      <Button
        type="button"
        size="icon"
        onClick={onAdd}
        title="Ajouter un coin ici"
        aria-label="Ajouter un coin ici"
        className="pointer-events-auto h-11 w-11 rounded-md bg-white text-primary-700 shadow-md hover:bg-neutral-50"
      >
        <Plus className="h-5 w-5" strokeWidth={2.5} />
      </Button>
      {onOffline && (
        <Button
          type="button"
          size="icon"
          onClick={onOffline}
          title="Cartes hors-ligne"
          aria-label="Cartes hors-ligne"
          className="pointer-events-auto h-11 w-11 rounded-md bg-white text-primary-700 shadow-md hover:bg-neutral-50"
        >
          <Download className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
