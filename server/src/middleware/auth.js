import jwt from 'jsonwebtoken';

const isProd = process.env.NODE_ENV === 'production';
const RAW_SECRET = process.env.JWT_SECRET;

// En production, on refuse de démarrer avec un secret manquant ou par défaut :
// sinon n'importe qui pourrait forger un jeton valide.
if (isProd && (!RAW_SECRET || RAW_SECRET === 'dev-secret' || RAW_SECRET === 'change-me-in-prod')) {
  console.error('FATAL : JWT_SECRET doit être défini (valeur robuste et unique) en production.');
  process.exit(1);
}

const SECRET = RAW_SECRET || 'dev-secret';
export function sign(user) {
  return jwt.sign({ id: user.id, email: user.email }, SECRET, { expiresIn: '30d' });
}
export function authRequired(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token manquant' });
  try { req.user = jwt.verify(token, SECRET); next(); }
  catch { res.status(401).json({ error: 'Token invalide' }); }
}
