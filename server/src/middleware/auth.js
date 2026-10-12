import jwt from 'jsonwebtoken';
const SECRET = process.env.JWT_SECRET || 'dev-secret';
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
