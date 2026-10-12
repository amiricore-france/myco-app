import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { api } from '../api.js';
import AiIdentify from '../components/AiIdentify.jsx';
import IdentificationsHistory from '../components/IdentificationsHistory.jsx';
import TopSharers from '../components/TopSharers.jsx';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [finds, setFinds] = useState([]);
  const [spots, setSpots] = useState([]);
  const [form, setForm] = useState({ species: '', weight_g: '', spot_id: '', notes: '' });

  async function refresh() {
    const [s, f, sp] = await Promise.all([
      api('/stats/summary'),
      api('/finds'),
      api('/spots')
    ]);
    setStats(s); setFinds(f); setSpots(sp);
  }

  useEffect(() => { refresh().catch(() => {}); }, []);

  async function addFind(e) {
    e.preventDefault();
    await api('/finds', {
      method: 'POST',
      body: {
        species: form.species,
        weight_g: Number(form.weight_g) || null,
        spot_id: form.spot_id ? Number(form.spot_id) : null,
        notes: form.notes
      }
    });
    setForm({ species: '', weight_g: '', spot_id: '', notes: '' });
    refresh();
  }

  async function removeFind(id) {
    if (!confirm('Supprimer cette trouvaille ?')) return;
    await api(`/finds/${id}`, { method: 'DELETE' });
    refresh();
  }

  if (!stats) return <div className="container">Chargement…</div>;

  const speciesData = stats.bySpecies.map(s => ({
    name: s.species,
    poids_kg: +(s.total_g / 1000).toFixed(2),
    count: s.count
  }));

  const monthData = stats.byMonth.map(m => ({
    name: m.month,
    poids_kg: +(m.total_g / 1000).toFixed(2),
    count: m.count
  }));

  return (
    <div className="container">
      <h2>Tableau de bord</h2>

      {/* Bloc analyse IA */}
      <div id="ai-species-anchor">
        <AiIdentify
          onSpeciesSuggested={species => setForm(prev => ({ ...prev, species }))}
        />
      </div>

      {/* Historique des identifications IA */}
      <IdentificationsHistory
        onSelectSpecies={species => {
          // Scroll vers le bloc IA pour rappeler le contexte
          document.getElementById('ai-species-anchor')?.scrollIntoView({ behavior: 'smooth' });
          // On pourrait aussi ouvrir la fiche directement ici, mais on garde simple pour l'instant
          console.log('Espèce cliquée depuis l\'historique:', species);
        }}
      />

      <div className="grid cols-2" style={{ marginBottom: '1.5rem' }}>
        <TopSharers />
      </div>

      <div className="grid cols-3" style={{ marginBottom: '1.5rem' }}>
        <div className="stat">
          <div className="value">{stats.totals.finds}</div>
          <div className="label">Trouvailles</div>
        </div>
        <div className="stat">
          <div className="value">{(stats.totals.total_g / 1000).toFixed(2)} kg</div>
          <div className="label">Poids total cueilli</div>
        </div>
        <div className="stat">
          <div className="value">{stats.totals.spots}</div>
          <div className="label">Coins enregistrés</div>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3>Par espèce (kg)</h3>
          {speciesData.length === 0 ? (
            <p style={{ color: '#666' }}>Aucune donnée</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={speciesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="poids_kg" fill="#2e6b3e" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h3>Par mois (kg)</h3>
          {monthData.length === 0 ? (
            <p style={{ color: '#666' }}>Aucune donnée</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="poids_kg" fill="#6b8f2e" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card" id="add-find-form" style={{ marginTop: '1rem' }}>
        <h3>Ajouter une trouvaille</h3>
        <form onSubmit={addFind} className="grid cols-2">
          <label>
            <span>Espèce *</span>
            <input
              required
              value={form.species}
              onChange={e => setForm({ ...form, species: e.target.value })}
            />
          </label>
          <label>
            <span>Poids (g)</span>
            <input
              type="number"
              min="0"
              value={form.weight_g}
              onChange={e => setForm({ ...form, weight_g: e.target.value })}
            />
          </label>
          <label>
            <span>Coin</span>
            <select
              value={form.spot_id}
              onChange={e => setForm({ ...form, spot_id: e.target.value })}
            >
              <option value="">— Aucun —</option>
              {spots.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Notes</span>
            <input
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          <div style={{ gridColumn: '1 / -1' }}>
            <button type="submit">Ajouter</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3>Dernières trouvailles</h3>
        {finds.length === 0 ? (
          <p style={{ color: '#666' }}>Aucune trouvaille enregistrée.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ddd', textAlign: 'left' }}>
                <th>Date</th>
                <th>Espèce</th>
                <th>Poids</th>
                <th>Coin</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {finds.map(f => (
                <tr key={f.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td>{new Date(f.found_at).toLocaleDateString('fr-FR')}</td>
                  <td>{f.species}</td>
                  <td>{f.weight_g ? `${f.weight_g} g` : '—'}</td>
                  <td>{f.spot_name || '—'}</td>
                  <td>
                    <button
                      className="danger"
                      style={{ padding: '.25rem .5rem', fontSize: '.8rem' }}
                      onClick={() => removeFind(f.id)}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
