import { useState } from 'react';
import { Edit3, MapPin, Share2, Trash2, Users } from 'lucide-react';
import { Button } from './ui/button';
import SpotInlineEditor from './SpotInlineEditor.jsx';
import ShareSpotPanel from './ShareSpotPanel.jsx';

export default function SpotCard({ spot, finds = [], onUpdated, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [sharing, setSharing] = useState(false);

  const isImported = !!spot.imported_from_share_id;
  const totalG = finds.reduce((s, f) => s + (f.weight_g || 0), 0);

  // La suppression est gérée par le parent (Spots.jsx) qui affiche le dialogue
  function remove() {
    onDeleted(spot.id);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md">

      {editing ? (
        <div className="p-5">
          <SpotInlineEditor
            spot={spot}
            onSave={updated => {
              setEditing(false);
              onUpdated(updated);
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <>
          <div className="p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold leading-tight text-neutral-900">
                {spot.name}
                {isImported && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-warning-300 bg-warning-50 px-2.5 py-0.5 text-xs font-semibold text-warning-900">
                    🔗 reçu de {spot.import_owner_display || 'un utilisateur'}
                  </span>
                )}
              </h3>
            </div>

            {spot.description && (
              <p className="mb-3 text-sm text-neutral-600">{spot.description}</p>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-500">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                <span className="font-mono text-xs tabular-nums">
                  {spot.lat.toFixed(4)}, {spot.lng.toFixed(4)}
                </span>
              </span>
              <span>rayon {spot.radius_m} m</span>
            </div>

            <div className="mt-2 flex items-center gap-4 text-sm">
              <span className="text-neutral-700">
                🍄 <strong>{finds.length}</strong> cueillette{finds.length > 1 ? 's' : ''}
              </span>
              {totalG > 0 && (
                <span className="font-mono tabular-nums text-neutral-700">
                  {(totalG / 1000).toFixed(2)} kg
                </span>
              )}
            </div>

            {isImported && (
              <p className="mt-3 rounded-md bg-warning-50 px-3 py-2 text-xs text-warning-900">
                ⓘ Ce coin vous a été partagé. Son propriétaire peut le révoquer à tout moment.
              </p>
            )}
          </div>

          <div className="flex items-center gap-1 border-t border-neutral-100 bg-neutral-50 px-3 py-2">
            {!isImported && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => { setEditing(true); setSharing(false); }}
                  className="gap-1.5 text-neutral-700"
                >
                  <Edit3 className="h-4 w-4" />
                  Modifier
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => { setSharing(s => !s); setEditing(false); }}
                  className={`gap-1.5 ${sharing ? 'text-primary-700' : 'text-neutral-700'}`}
                >
                  {sharing ? <Users className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                  Partager
                </Button>
              </>
            )}
            <div className="flex-1" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={remove}
              className="gap-1.5 text-neutral-500 hover:bg-danger-50 hover:text-danger-700"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer
            </Button>
          </div>

          {sharing && !isImported && (
            <div className="border-t border-neutral-100 p-4">
              <ShareSpotPanel spot={spot} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
