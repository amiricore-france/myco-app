import { useEffect, useState } from 'react';
import { Sparkles, CreditCard, Loader2, Bell, Mail, Smartphone, Send, Check } from 'lucide-react';
import { api } from '../api.js';
import { startCheckout, openBillingPortal } from '../lib/premium.js';
import { pushSupported, needsInstallForPush, currentSubscription, enablePush, disablePush } from '../lib/push.js';
import { toast } from '../lib/toast-store';
import { Button } from './ui/button';

const FEATURES = [
  'Alertes de poussée sur vos coins, par e-mail et notification',
  'Indice météo quotidien de chaque coin',
  'Cartes IGN hors-ligne autour de vos coins'
];

const STATUS_LABEL = {
  active: 'Actif', trialing: 'Période d’essai', past_due: 'Paiement en attente',
  canceled: 'Résilié', unpaid: 'Impayé', incomplete: 'Paiement incomplet'
};

/** Abonnement Myco Premium (section « Mon compte »). */
export function PremiumSection({ profile }) {
  const [config, setConfig] = useState(null);
  const [busy, setBusy] = useState('');

  useEffect(() => { api('/billing/config').then(setConfig).catch(() => setConfig({ enabled: false })); }, []);

  async function go(fn, key) {
    setBusy(key);
    try { await fn(); }
    catch (e) { toast.error('Paiement', e.message); setBusy(''); }
  }

  const subscribed = ['active', 'trialing', 'past_due'].includes(profile.subscription_status);
  const until = profile.premium_until ? new Date(profile.premium_until).toLocaleDateString('fr-FR') : null;
  const willEnd = profile.is_premium && !subscribed && until;

  return (
    <section id="premium" className="scroll-mt-24 rounded-xl border border-primary-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary-600" />
        <h2 className="text-lg font-semibold text-neutral-900">Myco Premium</h2>
        {profile.is_premium && (
          <span className="ml-auto rounded-sm bg-primary-600 px-2 py-0.5 text-xs font-semibold text-white">
            {profile.premium_for_all && !subscribed ? 'Offert' : 'Actif'}
          </span>
        )}
      </div>

      <ul className="mb-5 space-y-2">
        {FEATURES.map(f => (
          <li key={f} className="flex gap-2 text-sm text-neutral-700">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />{f}
          </li>
        ))}
      </ul>

      {subscribed && (
        <div className="space-y-3">
          <p className="text-sm text-neutral-600">
            Abonnement : <strong className="text-neutral-900">{STATUS_LABEL[profile.subscription_status] || profile.subscription_status}</strong>
            {until && <> · prochaine échéance le <span className="font-mono">{until}</span></>}
          </p>
          {profile.subscription_status === 'past_due' && (
            <p className="rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm text-warning-900">
              Le dernier paiement a échoué. Mettez à jour votre moyen de paiement pour garder Premium.
            </p>
          )}
          <Button variant="outline" className="h-12 w-full" disabled={!!busy} onClick={() => go(openBillingPortal, 'portal')}>
            {busy === 'portal' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            Gérer mon abonnement
          </Button>
          <p className="text-xs text-neutral-500">Carte bancaire, factures et résiliation, sur la page sécurisée de Stripe.</p>
        </div>
      )}

      {!subscribed && (
        <>
          {willEnd && !profile.premium_for_all && (
            <p className="mb-3 text-sm text-neutral-600">Premium reste actif jusqu’au <span className="font-mono">{until}</span>.</p>
          )}
          {profile.premium_for_all && (
            <p className="mb-3 rounded-lg bg-primary-50 p-3 text-sm text-primary-900">
              Pendant la phase de lancement, Premium est offert à tous les comptes.
            </p>
          )}
          {config?.enabled ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {config.monthly && (
                <Button className="h-14 flex-col gap-0" disabled={!!busy} onClick={() => go(() => startCheckout('monthly'), 'monthly')}>
                  {busy === 'monthly' ? <Loader2 className="h-4 w-4 animate-spin" /> : <>
                    <span className="text-sm font-semibold">S’abonner</span>
                    <span className="text-xs font-normal opacity-90">{config.monthly.label}</span></>}
                </Button>
              )}
              {config.yearly && (
                <Button variant="outline" className="h-14 flex-col gap-0" disabled={!!busy} onClick={() => go(() => startCheckout('yearly'), 'yearly')}>
                  {busy === 'yearly' ? <Loader2 className="h-4 w-4 animate-spin" /> : <>
                    <span className="text-sm font-semibold">Formule annuelle</span>
                    <span className="text-xs font-normal text-neutral-600">{config.yearly.label}</span></>}
                </Button>
              )}
            </div>
          ) : config && !profile.premium_for_all ? (
            <p className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-600">L’abonnement sera bientôt disponible.</p>
          ) : null}
          {config?.enabled && (
            <p className="mt-2 text-xs text-neutral-500">Paiement sécurisé par Stripe. Sans engagement, résiliable à tout moment.</p>
          )}
        </>
      )}
    </section>
  );
}

/** Canaux des alertes de poussée (section « Mon compte », Premium uniquement). */
export function AlertSettings({ profile, onChange }) {
  const [emailOn, setEmailOn] = useState(!!profile.alert_email);
  const [pushOn, setPushOn] = useState(false);
  const [busy, setBusy] = useState('');

  useEffect(() => { currentSubscription().then(s => setPushOn(!!s)).catch(() => {}); }, []);

  async function toggleEmail(v) {
    setEmailOn(v);
    try { await api('/auth/profile', { method: 'PUT', body: { alert_email: v } }); onChange?.(); }
    catch (e) { setEmailOn(!v); toast.error('Erreur', e.message); }
  }

  async function togglePush(v) {
    setBusy('push');
    try {
      if (v) { await enablePush(); toast.success('Notifications activées sur cet appareil'); }
      else { await disablePush(); }
      setPushOn(v);
      onChange?.();
    } catch (e) { toast.error('Notifications', e.message); }
    finally { setBusy(''); }
  }

  async function test() {
    setBusy('test');
    try { await api('/alerts/test', { method: 'POST' }); toast.success('Alerte de test envoyée'); }
    catch (e) { toast.error('Test impossible', e.message); }
    finally { setBusy(''); }
  }

  const iosInstall = needsInstallForPush();

  return (
    <section id="alertes" className="scroll-mt-24 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-neutral-900">
        <Bell className="h-5 w-5 text-primary-600" />Alertes de poussée
      </h2>
      <p className="mb-4 text-sm text-neutral-500">
        Un message chaque matin où l’un de vos coins devient favorable, au plus une fois par semaine et par coin.
      </p>

      <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
        <ToggleRow Icon={Mail} label="Par e-mail"
          hint={profile.email_verified ? profile.email : 'Confirmez d’abord votre adresse e-mail'}
          checked={emailOn} disabled={!profile.email_verified} onChange={toggleEmail} />
        <ToggleRow Icon={Smartphone} label="Notification sur cet appareil"
          hint={!pushSupported()
            ? (iosInstall ? 'Sur iPhone : ajoutez Myco à l’écran d’accueil (Partager → Sur l’écran d’accueil), puis ouvrez-le depuis l’icône' : 'Non pris en charge par ce navigateur')
            : 'À activer sur chaque téléphone ou ordinateur'}
          checked={pushOn} disabled={!pushSupported() || busy === 'push'} busy={busy === 'push'} onChange={togglePush} />
      </div>

      <Button variant="ghost" className="mt-3 h-11 w-full text-primary-700" onClick={test} disabled={!!busy || (!emailOn && !pushOn)}>
        {busy === 'test' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Envoyer une alerte de test
      </Button>
    </section>
  );
}

function ToggleRow({ Icon, label, hint, checked, disabled, busy, onChange }) {
  return (
    <label className={`flex items-center gap-3 p-3 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
      <Icon className="h-4 w-4 shrink-0 text-neutral-500" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-neutral-900">{label}</div>
        <div className="text-xs text-neutral-500">{hint}</div>
      </div>
      {busy ? <Loader2 className="h-4 w-4 animate-spin text-neutral-400" /> : (
        <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
          onClick={() => onChange(!checked)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-primary-600' : 'bg-neutral-300'}`}>
          <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      )}
    </label>
  );
}
