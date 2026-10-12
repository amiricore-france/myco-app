import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function ShareSpotPanel({ spot }) {
  const [sent, setSent] = useState([]);
  const [email, setEmail] = useState('');
  const [found, setFound] = useState(null);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function loadSent() {
    try {
      const all = await api('/shares/sent');
      setSent(all.filter(s => s.spot_id === spot.id));
    } catch (e) { console.error(e); }
  }

  useEffect(() => { loadSent(); }, [spot.id]);

  useEffect(() => {
    setFound(null); setErr(''); setMsg('');
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
        else if (e.message.includes('vous-même')) setErr('Vous ne pouvez pas vous partager un coin à vous-même');
      } finally { setSearching(false); }
    }, 400);
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [email]);

  async function send() {
    if (!found) return;
    setSending(true); setErr(''); setMsg('');
    try {
      await api('/shares', { method: 'POST', body: { spot_id: spot.id, to_email: found.email } });
      setMsg(`Demande de partage envoyée à ${found.display_name}`);
      setEmail(''); setFound(null);
      loadSent();
      window.dispatchEvent(new CustomEvent('shares:changed'));
    } catch (e) { setErr(e.message); }
    finally { setSending(false); }
  }

  async function revoke(id) {
    if (!confirm('Révoquer ce partage ?')) return;
    try {
      await api(`/shares/${id}`, { method: 'DELETE' });
      loadSent();
      window.dispatchEvent(new CustomEvent('shares:changed'));
    } catch (e) { setErr(e.message); }
  }

  return (
    <div style={{ padding: '.9rem', background: '#f9faf7', border: '1px solid #dfe5db', borderRadius: 8, marginBottom: '.75rem' }}>
      <strong>👥 Partager ce coin avec un autre utilisateur</strong>
      <p style={{ fontSize: '.8rem', color: '#666', margin: '.25rem 0 .75rem' }}>
        Le destinataire recevra une demande qu'il pourra accepter ou refuser.
      </p>

      <div className="row" style={{ flexWrap: 'wrap' }}>
        <input
          type="email"
          placeholder="email@exemple.fr"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <button type="button" onClick={send} disabled={!found || sending}>
          {sending ? '⏳ Envoi…' : '📤 Envoyer'}
        </button>
      </div>

      {searching && <p style={{ fontSize: '.8rem', color: '#888', margin: '.25rem 0 0' }}>Recherche…</p>}
      {found && !searching && (
        <p style={{ fontSize: '.85rem', color: '#2e6b3e', margin: '.35rem 0 0' }}>
          ✓ Trouvé : <strong>{found.display_name}</strong> ({found.email})
        </p>
      )}
      {err && <p style={{ color: 'crimson', margin: '.35rem 0 0', fontSize: '.85rem' }}>{err}</p>}
      {msg && <p style={{ color: '#2e6b3e', margin: '.35rem 0 0', fontSize: '.85rem' }}>✓ {msg}</p>}

      {sent.length > 0 && (
        <div style={{ marginTop: '1rem', paddingTop: '.75rem', borderTop: '1px solid #e3e8df' }}>
          <strong style={{ fontSize: '.85rem' }}>Partages en cours pour ce coin :</strong>
          <ul style={{ margin: '.5rem 0 0', paddingLeft: '1.2rem', fontSize: '.85rem' }}>
            {sent.map(s => (
              <li key={s.id} style={{ marginBottom: '.35rem' }}>
                <strong>{s.to_display_name}</strong> ({s.to_email}) —{' '}
                <span style={{
                  color: s.status === 'accepted' ? '#2e6b3e'
                       : s.status === 'declined' ? '#b23b3b'
                       : '#8a6a00'
                }}>
                  {s.status === 'pending' ? '⏳ en attente'
                   : s.status === 'accepted' ? '✓ accepté'
                   : '✗ refusé'}
                </span>{' '}
                <button
                  type="button"
                  className="secondary"
                  onClick={() => revoke(s.id)}
                  style={{ padding: '.1rem .4rem', fontSize: '.75rem', marginLeft: '.25rem' }}
                >
                  Révoquer
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
