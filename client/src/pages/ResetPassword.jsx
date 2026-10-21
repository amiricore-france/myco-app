import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '../api.js';
import AuthShell from '../components/AuthShell.jsx';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();

  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (pwd !== confirm) { setErr('Les deux mots de passe ne correspondent pas.'); return; }
    setLoading(true);
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, new_password: pwd } });
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthShell title="Lien invalide"
        footer={<Link to="/mot-de-passe-oublie" className="text-primary-700 hover:underline">Demander un nouveau lien</Link>}>
        <p className="text-sm text-neutral-600">Ce lien de réinitialisation est incomplet ou invalide.</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Nouveau mot de passe"
      footer={<Link to="/login" className="text-primary-700 hover:underline">Retour à la connexion</Link>}>
      {done ? (
        <div className="flex items-start gap-3 rounded-lg border border-sage-300 bg-sage-50 p-4 text-sm text-sage-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary-600" />
          <span>Mot de passe mis à jour. Redirection vers la connexion…</span>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {err && (
            <div className="flex items-start gap-3 rounded-lg border border-danger-200 bg-danger-50 p-3.5 text-sm text-danger-900">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{err}</span>
            </div>
          )}
          <div>
            <Label htmlFor="rp-pwd">Nouveau mot de passe</Label>
            <Input id="rp-pwd" type="password" autoComplete="new-password" required minLength={8}
              value={pwd} onChange={e => setPwd(e.target.value)}
              placeholder="Au moins 8 caractères" className="h-12" />
          </div>
          <div>
            <Label htmlFor="rp-confirm">Confirmer</Label>
            <Input id="rp-confirm" type="password" autoComplete="new-password" required minLength={8}
              value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="Retapez le mot de passe" className="h-12" />
          </div>
          <Button type="submit" disabled={loading} size="xl" className="w-full">
            {loading ? <><Loader2 className="h-5 w-5 animate-spin" />Mise à jour…</> : 'Changer le mot de passe'}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
