import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);

  async function refreshCount() {
    if (!user) return setPendingCount(0);
    try {
      const data = await api('/shares/pending-count', { silent401: true });
      setPendingCount(data.count || 0);
    } catch { setPendingCount(0); }
  }

  useEffect(() => { refreshCount(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const t = setInterval(refreshCount, 30000);
    function onChange() { refreshCount(); }
    window.addEventListener('shares:changed', onChange);
    return () => { clearInterval(t); window.removeEventListener('shares:changed', onChange); };
  }, [user]);

  return (
    <nav>
      <strong>🍄 Myco</strong>
      {user && (
        <>
          <NavLink to="/">Carte</NavLink>
          <NavLink to="/spots">Mes coins</NavLink>
          <NavLink to="/shares">
            Partages{pendingCount > 0 && (
              <span style={{
                marginLeft: '.35rem', background: '#f0c674', color: '#5a3c00',
                borderRadius: '50%', padding: '.05rem .4rem',
                fontSize: '.75rem', fontWeight: 700
              }}>{pendingCount}</span>
            )}
          </NavLink>
          <NavLink to="/dashboard">Tableau de bord</NavLink>
        </>
      )}
      <div className="spacer" />
      {user ? (
        <>
          <span style={{ opacity: 0.8 }}>{user.email}</span>
          <button className="secondary" onClick={() => { logout(); navigate('/login'); }}>
            Déconnexion
          </button>
        </>
      ) : (
        <NavLink to="/login">Connexion</NavLink>
      )}
    </nav>
  );
}
