import { useEffect, useState } from 'react';
import {
  Check, X, Trash2, Loader2, MapPin, Mail, Calendar, User
} from 'lucide-react';
import { api } from '../api.js';
import { toast } from '../lib/toast-store';
import { useConfirm } from '../hooks/useConfirm';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import PageHeader from '../components/PageHeader.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { SkeletonCard } from '../components/ui/skeleton';

function StatusBadge({ status }) {
  if (status === 'accepted') return <Badge variant="sage">✓ Accepté</Badge>;
  if (status === 'declined') return <Badge variant="danger">✗ Refusé</Badge>;
  return <Badge variant="warning">⏳ En attente</Badge>;
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch { return '—'; }
}

export default function Shares() {
  const [tab, setTab] = useState('received');
  const [received, setReceived] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const confirm = useConfirm();

  async function load() {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        api('/shares/received'),
        api('/shares/sent')
      ]);
      setReceived(r);
      setSent(s);
    } catch (e) {
      setError(e.message);
      toast.error('Erreur de chargement', e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function notifyChange() {
    window.dispatchEvent(new CustomEvent('shares:changed'));
  }

  async function accept(id) {
    setBusyId(id);
    setError('');
    try {
      await api(`/shares/${id}/accept`, { method: 'POST' });
      await load();
      notifyChange();
      toast.success('Coin ajouté à vos coins');
    } catch (e) {
      setError(e.message);
      toast.error('Erreur', e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function decline(id) {
    const ok = await confirm({
      title: 'Refuser ce partage ?',
      description: 'Le partageur ne sera pas notifié.',
      confirmLabel: 'Refuser',
    });
    if (!ok) return;

    setBusyId(id);
    setError('');
    try {
      await api(`/shares/${id}/decline`, { method: 'POST' });
      await load();
      notifyChange();
      toast.success('Partage refusé');
    } catch (e) {
      setError(e.message);
      toast.error('Erreur', e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function revoke(id) {
    const ok = await confirm({
      title: 'Révoquer ce partage ?',
      description: 'Le destinataire perdra l\'accès au coin.',
      confirmLabel: 'Révoquer',
    });
    if (!ok) return;

    setBusyId(id);
    setError('');
    try {
      await api(`/shares/${id}`, { method: 'DELETE' });
      await load();
      notifyChange();
      toast.success('Partage révoqué');
    } catch (e) {
      setError(e.message);
      toast.error('Erreur', e.message);
    } finally {
      setBusyId(null);
    }
  }

  const pendingCount = received.filter(r => r.status === 'pending').length;

  return (
    <div className="container-page">
      <PageHeader
        title="Partages de coins"
        subtitle="Coins que vous avez partagés ou que d'autres vous ont envoyés."
      />

      {error && (
        <div className="mb-4 rounded-lg border border-danger-200 bg-danger-50 p-3.5 text-sm text-danger-900">
          {error}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="received" className="flex-1 sm:flex-none">
            📥 Reçus
            {pendingCount > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warning-500 px-1.5 text-[10px] font-bold text-warning-900">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent" className="flex-1 sm:flex-none">
            📤 Envoyés ({sent.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="received">
          {loading ? (
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : received.length === 0 ? (
            <EmptyState icon="📥" title="Aucun partage reçu" description="Quand quelqu'un vous partagera un coin, vous le verrez ici." />
          ) : (
            <div className="space-y-3">
              {received.map(sh => (
                <div key={sh.id} className={`overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md ${
                  sh.status === 'pending'  ? 'border-warning-300'
                : sh.status === 'accepted' ? 'border-sage-300'
                : 'border-danger-200'
                }`}>
                  <div className="p-5">
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                      <h3 className="flex items-center gap-2 text-lg font-semibold leading-tight text-neutral-900">
                        🍄 {sh.spot_name}
                      </h3>
                      <StatusBadge status={sh.status} />
                    </div>

                    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-600">
                      <span className="inline-flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        De <strong className="text-neutral-800">{sh.from_display_name}</strong>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        {sh.from_email}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(sh.created_at)}
                      </span>
                    </div>

                    {sh.spot_description && (
                      <p className="mb-3 text-sm text-neutral-700">{sh.spot_description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-500">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="font-mono text-xs tabular-nums">
                          {sh.lat.toFixed(5)}, {sh.lng.toFixed(5)}
                        </span>
                      </span>
                      <span>rayon {sh.radius_m} m</span>
                    </div>
                  </div>

                  {sh.status === 'pending' && (
                    <div className="flex flex-col gap-2 border-t border-neutral-100 bg-neutral-50 px-4 py-3 sm:flex-row">
                      <Button onClick={() => accept(sh.id)} disabled={busyId === sh.id} className="h-11 w-full sm:w-auto">
                        {busyId === sh.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Accepter et ajouter à mes coins
                      </Button>
                      <Button variant="secondary" onClick={() => decline(sh.id)} disabled={busyId === sh.id} className="h-11 w-full sm:w-auto">
                        <X className="h-4 w-4" />
                        Refuser
                      </Button>
                    </div>
                  )}

                  {sh.status === 'accepted' && (
                    <div className="border-t border-sage-200 bg-sage-50 px-4 py-3">
                      <p className="text-sm text-sage-800">✓ Ajouté à vos coins</p>
                      <p className="mt-1 text-xs text-sage-700">
                        ⓘ Le partageur peut révoquer ce partage à tout moment. Si c'est le cas, le coin
                        disparaîtra de vos coins (vos cueillettes seront conservées mais détachées du coin).
                      </p>
                    </div>
                  )}

                  {sh.status === 'declined' && (
                    <div className="border-t border-danger-100 bg-danger-50 px-4 py-3">
                      <p className="text-sm text-danger-900">✗ Vous avez refusé ce partage</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sent">
          {loading ? (
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : sent.length === 0 ? (
            <EmptyState icon="📤" title="Aucun partage envoyé" description="Pour partager un coin, ouvrez-le depuis Mes coins et cliquez sur Partager." />
          ) : (
            <div className="space-y-3">
              {sent.map(sh => (
                <div key={sh.id} className={`overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md ${
                  sh.status === 'pending'  ? 'border-warning-300'
                : sh.status === 'accepted' ? 'border-sage-300'
                : 'border-danger-200'
                }`}>
                  <div className="p-5">
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                      <h3 className="flex items-center gap-2 text-lg font-semibold leading-tight text-neutral-900">
                        🍄 {sh.spot_name}
                      </h3>
                      <StatusBadge status={sh.status} />
                    </div>

                    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-600">
                      <span className="inline-flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        Envoyé à <strong className="text-neutral-800">{sh.to_display_name}</strong>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        {sh.to_email}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(sh.created_at)}
                      </span>
                    </div>

                    {sh.status === 'accepted' && sh.responded_at && (
                      <p className="text-xs text-sage-700">Accepté le {formatDate(sh.responded_at)}</p>
                    )}
                    {sh.status === 'declined' && sh.responded_at && (
                      <p className="text-xs text-neutral-500">Refusé le {formatDate(sh.responded_at)}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-neutral-100 bg-neutral-50 px-4 py-3">
                    <span className="text-xs text-neutral-500">
                      {sh.status === 'pending' && 'En attente de réponse du destinataire'}
                      {sh.status === 'accepted' && 'Le destinataire a accepté ce partage'}
                      {sh.status === 'declined' && 'Le destinataire a refusé ce partage'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revoke(sh.id)}
                      disabled={busyId === sh.id}
                      className="gap-1.5 text-neutral-500 hover:bg-danger-50 hover:text-danger-700"
                    >
                      <Trash2 className="h-4 w-4" />
                      Révoquer
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
