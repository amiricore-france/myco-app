import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import AuthShell from '../components/AuthShell.jsx';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { user, refreshUser } = useAuth();
  const [state, setState] = useState('loading'); // loading | ok | error

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!token) { setState('error'); return; }
      try {
        await api(`/auth/verify-email?token=${encodeURIComponent(token)}`, { silent401: true });
        if (cancelled) return;
        setState('ok');
        if (user) refreshUser();
      } catch {
        if (!cancelled) setState('error');
      }
    }
    run();
    return () => { cancelled = true; };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthShell
      title="Vérification de l'e-mail"
      footer={<Link to={user ? '/' : '/login'} className="text-primary-700 hover:underline">
        {user ? "Revenir à l'application" : 'Aller à la connexion'}
      </Link>}
    >
      {state === 'loading' && (
        <div className="flex items-center gap-3 text-sm text-neutral-600">
          <Loader2 className="h-5 w-5 animate-spin text-primary-600" /> Vérification en cours…
        </div>
      )}
      {state === 'ok' && (
        <div className="flex items-start gap-3 rounded-lg border border-sage-300 bg-sage-50 p-4 text-sm text-sage-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary-600" />
          <span>Votre adresse e-mail est confirmée. Merci !</span>
        </div>
      )}
      {state === 'error' && (
        <div className="flex items-start gap-3 rounded-lg border border-danger-200 bg-danger-50 p-4 text-sm text-danger-900">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <span>Ce lien de vérification est invalide ou a déjà été utilisé. Vous pouvez en renvoyer un depuis votre compte.</span>
        </div>
      )}
    </AuthShell>
  );
}
