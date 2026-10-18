import { useEffect, useState } from 'react';
import { Loader2, Send, Search, Trash2, Users } from 'lucide-react';
import { api } from '../api.js';
import { toast } from '../lib/toast-store';
import { useConfirm } from '../hooks/useConfirm';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';

function statusBadge(status) {
  if (status === 'accepted') return <Badge variant="sage">✓ Accepté</Badge>;
  if (status === 'declined') return <Badge variant="danger">✗ Refusé</Badge>;
  return <Badge variant="warning">⏳ En attente</Badge>;
}

export default function ShareSpotPanel({ spot }) {
  const [sent, setSent] = useState([]);
  const [email, setEmail] = useState('');
  const [found, setFound] = useState(null);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const confirm = useConfirm();

  async function loadSent() {
    try {
      const all = await api('/shares/sent');
      setSent(all.filter(s => s.spot_id === spot.id));
    } catch (e) { console.error(e); }
  }

  useEffect(() => { loadSent(); }, [spot.id]);

  useEffect(() => {
    setFound(null); setErr('');
    const value = email.trim().toLowerCase();
    if (value.length < 3 || !value.includes('@')) return;

    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const u = await api(`/users/lookup?email=${encodeURIComponent(value)}`, { silent401: true });
        setFound(u);
      } catch (e) {
        if (e.message.includes('introuvable')) setErr('Aucun utilisateur inscrit avec cet email');
        else if (e.message.includes('vous-même')) setErr('Vous ne pouvez pas partager un coin avec vous-même');
      } finally { setSearching(false); }
    }, 400);
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [email]);

  async function send() {
    if (!found) return;
    setSending(true); setErr('');
    try {
      await api('/shares', { method: 'POST', body: { spot_id: spot.id, to_email: found.email } });
      toast.success(`Demande envoyée à ${found.display_name}`);
      setEmail(''); setFound(null);
      loadSent();
      window.dispatchEvent(new CustomEvent('shares:changed'));
    } catch (e) {
      setErr(e.message);
      toast.error('Erreur', e.message);
    } finally {
      setSending(false);
    }
  }

  async function revoke(id) {
    const ok = await confirm({
      title: 'Révoquer ce partage ?',
      description: 'Le destinataire perdra l\'accès au coin.',
      confirmLabel: 'Révoquer',
    });
    if (!ok) return;

    try {
      await api(`/shares/${id}`, { method: 'DELETE' });
      toast.success('Partage révoqué');
      loadSent();
      window.dispatchEvent(new CustomEvent('shares:changed'));
    } catch (e) {
      setErr(e.message);
      toast.error('Erreur', e.message);
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <h4 className="mb-1 flex items-center gap-2 text-sm font-semibold text-neutral-800">
        <Users className="h-4 w-4" />
        Partager ce coin
      </h4>
      <p className="mb-3 text-xs text-neutral-500">
        Le destinataire recevra une demande qu'il pourra accepter ou refuser.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            type="email"
            placeholder="email@exemple.fr"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="h-11 pl-9"
          />
        </div>
        <Button type="button" onClick={send} disabled={!found || sending} className="h-11 sm:w-auto">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Envoyer
        </Button>
      </div>

      {searching && <p className="mt-2 text-xs text-neutral-500">Recherche…</p>}

      {found && !searching && (
        <p className="mt-2 text-sm text-primary-700">
          ✓ <strong>{found.display_name}</strong> ({found.email})
        </p>
      )}

      {err && <p className="mt-2 text-sm text-danger-600">{err}</p>}

      {sent.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-neutral-200 pt-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Partages en cours
          </div>
          {sent.map(s => (
            <div key={s.id} className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white p-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-neutral-900">{s.to_display_name}</div>
                <div className="truncate text-xs text-neutral-500">{s.to_email}</div>
              </div>
              {statusBadge(s.status)}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => revoke(s.id)}
                title="Révoquer ce partage"
                aria-label="Révoquer"
                className="flex-shrink-0 text-neutral-500 hover:text-danger-600"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
