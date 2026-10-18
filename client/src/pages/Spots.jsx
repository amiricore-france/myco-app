import { useEffect, useState } from 'react';
import { MapPin, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { Button } from '../components/ui/button';
import { toast } from '../lib/toast-store';
import { useConfirm } from '../hooks/useConfirm';
import PageHeader from '../components/PageHeader.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { SkeletonCard } from '../components/ui/skeleton';
import SpotCard from '../components/SpotCard.jsx';

export default function Spots() {
  const [spots, setSpots] = useState([]);
  const [finds, setFinds] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const confirm = useConfirm();

  async function load() {
    setLoading(true);
    try {
      const [s, f] = await Promise.all([api('/spots'), api('/finds')]);
      setSpots(s);
      setFinds(f);
    } catch (e) {
      toast.error('Erreur de chargement', e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function handleUpdated(updated) {
    setSpots(spots.map(s => (s.id === updated.id ? updated : s)));
    toast.success('Coin mis à jour');
  }

  async function handleDeleted(id) {
    const ok = await confirm({
      title: 'Supprimer ce coin ?',
      description: 'Cette action est irréversible. Les cueillettes associées seront conservées.',
      confirmLabel: 'Supprimer',
    });
    if (!ok) return;

    try {
      await api(`/spots/${id}`, { method: 'DELETE' });
      setSpots(spots.filter(s => s.id !== id));
      toast.success('Coin supprimé');
    } catch (e) {
      toast.error('Erreur de suppression', e.message);
    }
  }

  return (
    <div className="container-page">
      <PageHeader
        title={`Mes coins${!loading ? ` (${spots.length})` : ''}`}
        subtitle="Vos coins à champignons enregistrés, publics ou privés."
        action={
          <Button onClick={() => navigate('/')} className="h-11">
            <Plus className="h-4 w-4" />
            Ajouter un coin
          </Button>
        }
      />

      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!loading && spots.length === 0 && (
        <EmptyState
          icon="🗺️"
          title="Aucun coin enregistré"
          description="Allez sur la carte, repérez un endroit prometteur et enregistrez-le pour le retrouver plus tard."
          action={
            <Button onClick={() => navigate('/')}>
              <MapPin className="h-4 w-4" />
              Ouvrir la carte
            </Button>
          }
        />
      )}

      {!loading && spots.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {spots.map(spot => (
            <SpotCard
              key={spot.id}
              spot={spot}
              finds={finds.filter(f => f.spot_id === spot.id)}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}
