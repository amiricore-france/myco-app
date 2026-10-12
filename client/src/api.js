const BASE = '/api';

function token() {
  return localStorage.getItem('token');
}

export async function api(path, { method = 'GET', body, silent401 = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (res.status === 401) {
    // Token invalide ou expiré : on nettoie et on prévient l'app
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (!silent401) {
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    const err = await res.json().catch(() => ({ error: 'Session expirée' }));
    throw new Error(err.error || 'Session expirée');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Erreur');
  }
  return res.json();
}
