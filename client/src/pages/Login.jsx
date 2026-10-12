import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { login, register, user, expiredMessage, clearExpiredMessage } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password, name);
      navigate('/');
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <div className="card">
        <h2>{mode === 'login' ? 'Connexion' : 'Créer un compte'}</h2>

        {expiredMessage && (
          <div style={{
            padding: '.6rem .9rem',
            background: '#fff7e6',
            border: '1px solid #f0c674',
            borderRadius: 8,
            marginBottom: '1rem',
            fontSize: '.9rem',
            color: '#8a5a00'
          }}>
            ⏱ {expiredMessage}
          </div>
        )}

        <form onSubmit={submit}>
          {mode === 'register' && (
            <label>
              <span>Nom</span>
              <input value={name} onChange={e => setName(e.target.value)} />
            </label>
          )}
          <label>
            <span>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </label>
          <label>
            <span>Mot de passe</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </label>
          {err && <p style={{ color: 'crimson' }}>{err}</p>}
          <button type="submit">
            {mode === 'login' ? 'Se connecter' : "S'inscrire"}
          </button>
        </form>

        <p style={{ marginTop: '1rem', fontSize: '.9rem' }}>
          {mode === 'login' ? 'Pas de compte ?' : 'Déjà inscrit ?'}{' '}
          <a
            href="#"
            onClick={e => {
              e.preventDefault();
              clearExpiredMessage();
              setMode(mode === 'login' ? 'register' : 'login');
            }}
          >
            {mode === 'login' ? "S'inscrire" : 'Se connecter'}
          </a>
        </p>
      </div>
    </div>
  );
}
