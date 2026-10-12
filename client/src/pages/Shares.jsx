import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Shares() {
  const [tab, setTab] = useState('received');
  const [received, setReceived] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([api('/shares/received'), api('/shares/sent')]);
      setReceived(r); setSent(s);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function accept(id) {
    try { await api(`/shares/${id}/accept`, { method: 'POST' }); await load(); window.dispatchEvent(new CustomEvent('shares:changed')); }
    catch (e) { setError(e.message); }
  }
  async function decline(id) {
    if (!confirm('Refuser ce partage ?')) return;
    try { await api(`/shares/${id}/decline`, { method: 'POST' }); await load(); window.dispatchEvent(new CustomEvent('shares:changed')); }
    catch (e) { setError(e.message); }
  }
  async function revoke(id) {
    if (!confirm('Révoquer ce partage ?')) return;
    try { await api(`/shares/${id}`, { method: 'DELETE' }); await load(); window.dispatchEvent(new CustomEvent('shares:changed')); }
    catch (e) { setError(e.message); }
  }

  function statusBadge(status) {
    const map = {
      pending:  { label: '⏳ En attente', color: '#8a6a00', bg: '#fff7e6' },
      accepted: { label: '✓ Accepté',    color: '#2e6b3e', bg: '#e7f4ea' },
      declined: { label: '✗ Refusé',     color: '#b23b3b', bg: '#fbe8e8' }
    };
    const s = map[status] || map.pending;
    return <span style={{ padding: '.15rem .55rem', borderRadius: 6, fontSize: '.8rem', fontWeight: 600, color: s.color, background: s.bg }}>{s.label}</span>;
  }

  if (loading) return <div className="container">Chargement…</div>;

  const pendingCount = received.filter(r => r.status === 'pending').length;

  return (
    <div className="container">
      <h2>Partages de coins</h2>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <div className="row" style={{ marginBottom: '1rem' }}>
        <button type="button" onClick={() => setTab('received')} className={tab === 'received' ? '' : 'secondary'}>
          📥 Reçus {pendingCount > 0 && `(${pendingCount} en attente)`}
        </button>
        <button type="button" onClick={() => setTab('sent')} className={tab === 'sent' ? '' : 'secondary'}>
          📤 Envoyés
        </button>
      </div>

      {tab === 'received' && (
        received.length === 0
          ? <div className="card"><p style={{ color: '#666' }}>Aucun partage reçu pour l'instant.</p></div>
          : received.map(sh => (
            <div key={sh.id} className="card" style={{
              borderLeft: sh.status === 'pending' ? '4px solid #f0c674'
                        : sh.status === 'accepted' ? '4px solid #2e6b3e'
                        : '4px solid #b23b3b'
            }}>
              <div className="row between">
                <h3 style={{ margin: 0 }}>🍄 {sh.spot_name}</h3>
                {statusBadge(sh.status)}
              </div>
              <p style={{ color: '#666', fontSize: '.9rem', margin: '.35rem 0' }}>
                De <strong>{sh.from_display_name}</strong> ({sh.from_email}) — {new Date(sh.created_at).toLocaleDateString('fr-FR')}
              </p>
              {sh.spot_description && <p style={{ fontSize: '.9rem' }}>{sh.spot_description}</p>}
              <p style={{ fontSize: '.85rem', color: '#666' }}>
                📍 {sh.lat.toFixed(5)}, {sh.lng.toFixed(5)} — rayon {sh.radius_m} m
              </p>
              {sh.status === 'pending' && (
                <div className="row" style={{ marginTop: '.5rem' }}>
                  <button onClick={() => accept(sh.id)}>✓ Accepter et ajouter à mes coins</button>
                  <button className="secondary" onClick={() => decline(sh.id)}>✗ Refuser</button>
                </div>
              )}
              {sh.status === 'accepted' && (
                <div style={{ marginTop: '.5rem' }}>
                  <p style={{ color: '#2e6b3e', fontSize: '.9rem', margin: 0 }}>
                    ✓ Ajouté à vos coins
                  </p>
                  <p style={{ color: '#8a6a00', fontSize: '.8rem', margin: '.25rem 0 0' }}>
                    ⓘ Le partageur peut révoquer ce partage à tout moment : le coin disparaîtra alors
                    de vos coins (vos trouvailles seront conservées mais détachées du coin).
                  </p>
                </div>
              )}
            </div>
          ))
      )}

      {tab === 'sent' && (
        sent.length === 0
          ? <div className="card"><p style={{ color: '#666' }}>Vous n'avez encore partagé aucun coin. Allez sur la carte, ouvrez un coin, et cliquez sur « Partager ».</p></div>
          : sent.map(sh => (
            <div key={sh.id} className="card">
              <div className="row between">
                <h3 style={{ margin: 0 }}>🍄 {sh.spot_name}</h3>
                {statusBadge(sh.status)}
              </div>
              <p style={{ color: '#666', fontSize: '.9rem', margin: '.35rem 0' }}>
                Envoyé à <strong>{sh.to_display_name}</strong> ({sh.to_email}) — {new Date(sh.created_at).toLocaleDateString('fr-FR')}
              </p>
              <div className="row" style={{ marginTop: '.5rem' }}>
                <button className="danger" onClick={() => revoke(sh.id)}>Révoquer</button>
              </div>
            </div>
          ))
      )}
    </div>
  );
}
