import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function TopSharers() {
  const [sharers, setSharers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/stats/top-sharers')
      .then(setSharers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || sharers.length === 0) return null;

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="card" style={{ borderLeft: '4px solid #f0c674' }}>
      <h3 style={{ marginTop: 0 }}>🏆 Top 10 des partageurs</h3>
      <p style={{ fontSize: '.85rem', color: '#666', marginTop: 0 }}>
        Les utilisateurs qui ont le plus partagé de coins (partages acceptés).
      </p>

      <ol style={{ margin: 0, paddingLeft: '1.5rem' }}>
        {sharers.map((s, i) => (
          <li key={s.id} style={{
            padding: '.35rem 0',
            borderBottom: i < sharers.length - 1 ? '1px solid #eee' : 'none',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>
              {i < 3 ? medals[i] + ' ' : ''}
              <strong>{s.display_name}</strong>
            </span>
            <span style={{
              color: '#2e6b3e',
              fontWeight: 600,
              fontSize: '.9rem'
            }}>
              {s.share_count} partage{s.share_count > 1 ? 's' : ''}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
