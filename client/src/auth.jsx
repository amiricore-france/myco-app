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
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setExpiredMessage('');
  }

  return (
    <AuthCtx.Provider value={{ user, ready, login, register, logout, expiredMessage, clearExpiredMessage: () => setExpiredMessage('') }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
