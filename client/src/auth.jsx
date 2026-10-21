import { createContext, useContext, useState, useEffect } from 'react';
import { api } from './api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [expiredMessage, setExpiredMessage] = useState('');

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (raw) setUser(JSON.parse(raw));
    setReady(true);
  }, []);

  // Écoute l'événement émis par api.js en cas de 401
  useEffect(() => {
    function onExpired() {
      setUser(null);
      setExpiredMessage('Votre session a expiré. Veuillez vous reconnecter.');
    }
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  async function login(email, password) {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    setExpiredMessage('');
  }

  async function register(email, password, name) {
    const data = await api('/auth/register', { method: 'POST', body: { email, password, name } });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    setExpiredMessage('');
    return data;
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setExpiredMessage('');
  }

  // Recharge le profil depuis le serveur et met à jour l'utilisateur stocké
  // (utile après vérification d'e-mail, changement de nom, etc.).
  async function refreshUser() {
    try {
      const p = await api('/auth/profile', { silent401: true });
      const next = {
        id: p.id, email: p.email, name: p.name,
        leaderboard_opt_in: p.leaderboard_opt_in || 0,
        email_verified: p.email_verified || 0
      };
      localStorage.setItem('user', JSON.stringify(next));
      setUser(next);
      return next;
    } catch { return null; }
  }

  return (
    <AuthCtx.Provider value={{ user, ready, login, register, logout, refreshUser, expiredMessage, clearExpiredMessage: () => setExpiredMessage('') }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
