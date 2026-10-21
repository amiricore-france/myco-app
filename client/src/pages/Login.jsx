import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, Clock, Loader2 } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';

export default function Login() {
  const { login, register, user, expiredMessage, clearExpiredMessage } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  function changeTab(value) {
    setTab(value);
    setErr('');
    clearExpiredMessage?.();
  }

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      if (tab === 'login') {
        await login(email.trim().toLowerCase(), password);
      } else {
        await register(email.trim().toLowerCase(), password, name.trim() || undefined);
      }
      navigate('/');
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 py-8 sm:py-12">

      {/* Marque */}
      <div className="mb-8 text-center">
        <div className="mb-3 text-5xl sm:text-6xl">🍄</div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
          Myco
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Vos coins à champignons, partagés et analysés
        </p>
      </div>

      {/* Carte formulaire */}
      <div className="w-full max-w-[420px]">

        {/* Bandeau session expirée */}
        {expiredMessage && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-warning-300 bg-warning-50 p-3.5 text-sm text-warning-900">
            <Clock className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{expiredMessage}</span>
          </div>
        )}

        {/* Carte */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">

          <Tabs value={tab} onValueChange={changeTab}>
            <TabsList className="w-full">
              <TabsTrigger value="login" className="flex-1">
                Connexion
              </TabsTrigger>
              <TabsTrigger value="register" className="flex-1">
                Créer un compte
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={submit} className="space-y-4">

                {err && <ErrorBanner message={err} />}

                <div>
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="vous@exemple.fr"
                    className="h-12"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">Mot de passe</Label>
                    <Link
                      to="/mot-de-passe-oublie"
                      className="text-xs text-primary-700 hover:underline"
                    >
                      Mot de passe oublié ?
                    </Link>
                  </div>
                  <Input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-12"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  size="xl"
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Connexion…
                    </>
                  ) : (
                    'Se connecter'
                  )}
                </Button>

              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={submit} className="space-y-4">

                {err && <ErrorBanner message={err} />}

                <div>
                  <Label htmlFor="register-name">
                    Nom <span className="text-neutral-400 font-normal">(optionnel)</span>
                  </Label>
                  <Input
                    id="register-name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Votre nom"
                    className="h-12"
                  />
                </div>

                <div>
                  <Label htmlFor="register-email">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="vous@exemple.fr"
                    className="h-12"
                  />
                </div>

                <div>
                  <Label htmlFor="register-password">Mot de passe</Label>
                  <Input
                    id="register-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Au moins 8 caractères"
                    className="h-12"
                  />
                  <p className="mt-1.5 text-xs text-neutral-500">
                    Minimum 8 caractères. Vous pourrez le modifier plus tard.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  size="xl"
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Création…
                    </>
                  ) : (
                    "S'inscrire"
                  )}
                </Button>

              </form>
            </TabsContent>
          </Tabs>

        </div>

        {/* Note légale */}
        <p className="mt-6 text-center text-xs text-neutral-400">
          En continuant, vous acceptez de ne jamais consommer un champignon identifié uniquement par une application.
        </p>

      </div>
    </div>
  );
}

function ErrorBanner({ message }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-danger-200 bg-danger-50 p-3.5 text-sm text-danger-900">
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}
