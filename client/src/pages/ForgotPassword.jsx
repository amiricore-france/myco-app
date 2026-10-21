import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '../api.js';
import AuthShell from '../components/AuthShell.jsx';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email: email.trim().toLowerCase() } });
      setSent(true);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Mot de passe oublié"
      footer={<Link to="/login" className="text-primary-700 hover:underline">Retour à la connexion</Link>}
    >
      {sent ? (
        <div className="flex items-start gap-3 rounded-lg border border-sage-300 bg-sage-50 p-4 text-sm text-sage-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary-600" />
          <span>
            Si un compte existe avec cette adresse, un e-mail contenant un lien de
            réinitialisation vient d'être envoyé. Pensez à vérifier vos spams.
          </span>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-neutral-600">
            Saisissez votre adresse e-mail : nous vous enverrons un lien pour choisir un nouveau mot de passe.
          </p>
          {err && (
            <div className="flex items-start gap-3 rounded-lg border border-danger-200 bg-danger-50 p-3.5 text-sm text-danger-900">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{err}</span>
            </div>
          )}
          <div>
            <Label htmlFor="fp-email">Email</Label>
            <Input id="fp-email" type="email" autoComplete="email" required
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="vous@exemple.fr" className="h-12" />
          </div>
          <Button type="submit" disabled={loading} size="xl" className="w-full">
            {loading ? <><Loader2 className="h-5 w-5 animate-spin" />Envoi…</> : 'Envoyer le lien'}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
