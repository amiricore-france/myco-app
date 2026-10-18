import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { toast } from '../lib/toast-store';
import AiIdentify from '../components/AiIdentify.jsx';
import IdentificationsHistory from '../components/IdentificationsHistory.jsx';
import TopSharers from '../components/TopSharers.jsx';
import SpeciesCard from '../components/SpeciesCard.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { SkeletonCard } from '../components/ui/skeleton';

export default function Dashboard() {
  const [openSpecies, setOpenSpecies] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadStats() {
    try {
      const s = await api('/stats/summary');
      setStats(s);
    } catch (e) {
      toast.error('Erreur de chargement', e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStats(); }, []);

  return (
    <div className="container-page">
      <PageHeader
        title="Tableau de bord"
        subtitle="Votre activité, vos identifications et la communauté."
      />

      <div id="ai-species-anchor">
        <AiIdentify
          onSpeciesSuggested={species => {
            window.location.href = `/cueillettes?species=${encodeURIComponent(species)}`;
          }}
        />
      </div>

      <IdentificationsHistory
        onSelectSpecies={species => setOpenSpecies(species)}
      />

      {openSpecies && (
        <div className="mb-4">
          <SpeciesCard latin={openSpecies} onClose={() => setOpenSpecies(null)} />
        </div>
      )}

      {loading ? (
        <SkeletonCard />
      ) : stats ? (
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="font-mono text-3xl font-bold text-primary-600 sm:text-4xl">
              {stats.totals.finds}
            </div>
            <div className="mt-1 text-sm text-neutral-500">Cueillettes</div>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="font-mono text-3xl font-bold text-primary-600 sm:text-4xl">
              {(stats.totals.total_g / 1000).toFixed(2)} kg
            </div>
            <div className="mt-1 text-sm text-neutral-500">Poids total cueilli</div>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="font-mono text-3xl font-bold text-primary-600 sm:text-4xl">
              {stats.totals.spots}
            </div>
            <div className="mt-1 text-sm text-neutral-500">Coins enregistrés</div>
          </div>
        </div>
      ) : null}

      <TopSharers />
    </div>
  );
}
