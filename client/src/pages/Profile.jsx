import { useEffect, useState } from 'react';
import { Loader2, Save, Trophy, ShieldCheck, MailWarning, KeyRound, Trash2, LogOut } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useConfirm } from '../hooks/useConfirm.jsx';
import { toast } from '../lib/toast-store';
import PageHeader from '../components/PageHeader.jsx';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Skeleton } from '../components/ui/skeleton';
import { PremiumSection, AlertSettings } from '../components/PremiumSettings.jsx';
import LegalLinks from '../components/LegalLinks.jsx';
import { resetPremiumCache } from '../lib/premium.js';

export default function Profile() {
  const { logout, refreshUser } = useAuth();
  const confirm = useConfirm();

  const [profile, setProfile] = useState(null);
  const [name, setName] = useState('');
  const [optIn, setOptIn] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const p = await api('/auth/profile');
      resetPremiumCache();
      setProfile(p);
      setName(p.name || '');
      setOptIn(!!p.leaderboard_opt_in);
    } catch (e) {
      toast.error('Erreur de chargement', e.message);
    }
  }
  useEffect(() => { load(); }, []);

  // Retour de Stripe Checkout (?premium=ok|annule) : le webhook peut arriver
  // quelques secondes après la redirection, on relit le profil jusqu'à activation.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('premium');
    if (!status) return;
    window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    if (status === 'annule') { toast.info('Paiement annulé', 'Aucun montant n’a été débité.'); return; }
    let tries = 0;
    const timer = setInterval(async () => {
      tries++;
      const p = await api('/auth/profile').catch(() => null);
      if (p?.is_premium && p.subscription_status) {
        clearInterval(timer); resetPremiumCache(); setProfile(p);
        toast.success('Bienvenue dans Myco Premium 🍄', 'Activez vos alertes de poussée ci-dessous.');
      } else if (tries >= 10) {
        clearInterval(timer);
        toast.info('Paiement reçu', 'L’activation peut prendre une minute : rechargez la page si besoin.');
      }
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  // Ancres #premium / #alertes (liens des e-mails et des encarts)
  useEffect(() => {
    if (!profile || !window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [!!profile]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api('/auth/profile', {
        method: 'PUT',
        body: { name: name.trim() || null, leaderboard_opt_in: optIn }
      });
      setProfile(p => ({ ...p, ...updated }));
      refreshUser();
      toast.success('Profil enregistré');
    } catch (e) {
      toast.error('Erreur', e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!profile) {
    return (
      <div className="container-page">
        <div className="mx-auto max-w-lg space-y-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
            <Skeleton className="mb-3 h-6 w-1/3" />
            <Skeleton className="mb-2 h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page">
      <PageHeader title="Mon compte" subtitle="Vos informations, votre sécurité et vos préférences." />

      <div className="mx-auto max-w-lg space-y-5">

        {/* --- Statut e-mail --- */}
        <EmailStatus profile={profile} onChange={load} />

        {/* --- Informations --- */}
        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">Informations</h2>
          <form onSubmit={save} className="space-y-5">
            <div>
              <Label>Email</Label>
              <Input type="email" disabled value={profile.email}
                className="h-12 cursor-not-allowed bg-neutral-50 text-neutral-500" />
            </div>
            <div>
              <Label htmlFor="profile-name">Nom affiché</Label>
              <Input id="profile-name" type="text" value={name}
                onChange={e => setName(e.target.value)} placeholder="Votre nom ou pseudo" className="h-12" />
              <p className="mt-1 text-xs text-neutral-500">
                Utilisé pour vous identifier dans les partages et le podium.
              </p>
            </div>

            <div className="rounded-lg border border-warning-200 bg-warning-50 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={optIn} onChange={e => setOptIn(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-600" />
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-warning-900">
                    <Trophy className="h-4 w-4 text-warning-600" /> Participer au podium
                  </div>
                  <p className="mt-1 text-xs text-warning-800">
                    Votre nom et le poids total de vos cueillettes apparaîtront dans le classement
                    mensuel et annuel visible par les autres utilisateurs connectés.
                  </p>
                </div>
              </label>
            </div>

            <Button type="submit" disabled={saving} className="h-12 w-full">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement…</>
                      : <><Save className="h-4 w-4" />Enregistrer</>}
            </Button>
          </form>
        </section>

        {/* --- Premium --- */}
        <PremiumSection profile={profile} />
        <AlertSettings profile={profile} onChange={load} />

        {/* --- Sécurité --- */}
        <ChangePassword />

        {/* --- Zone sensible --- */}
        <DangerZone email={profile.email} onDeleted={logout} confirm={confirm} />

        <Button variant="ghost" onClick={logout} className="h-12 w-full text-neutral-600">
          <LogOut className="h-4 w-4" /> Se déconnecter
        </Button>

        <LegalLinks className="pb-2 text-center text-xs text-neutral-500" />
      </div>
    </div>
  );
}

function EmailStatus({ profile, onChange }) {
  const { refreshUser } = useAuth();
  const [sending, setSending] = useState(false);

  if (profile.email_verified) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-sage-300 bg-sage-50 p-4 text-sm text-sage-900">
        <ShieldCheck className="h-5 w-5 flex-shrink-0 text-primary-600" />
        <span>Adresse e-mail vérifiée.</span>
      </div>
    );
  }

  async function resend() {
    setSending(true);
    try {
      const r = await api('/auth/resend-verification', { method: 'POST' });
      if (r.already) { refreshUser(); onChange?.(); toast.success('E-mail déjà vérifié'); }
      else if (r.email_sent) toast.success('E-mail de vérification envoyé');
      else toast.info('Envoi d\'e-mails non configuré', 'Contactez l\'administrateur.');
    } catch (e) {
      toast.error('Erreur', e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-xl border border-warning-300 bg-warning-50 p-4">
      <div className="flex items-start gap-3">
        <MailWarning className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning-600" />
        <div className="flex-1">
          <p className="text-sm font-medium text-warning-900">Adresse e-mail non vérifiée</p>
          <p className="mt-1 text-xs text-warning-800">
            Vérifiez votre e-mail pour sécuriser votre compte et pouvoir le récupérer en cas d'oubli.
          </p>
          <Button variant="outline" size="sm" onClick={resend} disabled={sending} className="mt-3">
            {sending ? <><Loader2 className="h-4 w-4 animate-spin" />Envoi…</> : 'Renvoyer l\'e-mail'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ChangePassword() {
  const [cur, setCur] = useState('');
  const [pwd, setPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (pwd !== confirmPwd) { toast.error('Les mots de passe ne correspondent pas'); return; }
    setLoading(true);
    try {
      await api('/auth/password', { method: 'PUT', body: { current_password: cur, new_password: pwd } });
      setCur(''); setPwd(''); setConfirmPwd('');
      toast.success('Mot de passe modifié');
    } catch (e) {
      toast.error('Erreur', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-neutral-900">
        <KeyRound className="h-5 w-5 text-neutral-500" /> Mot de passe
      </h2>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="cur-pwd">Mot de passe actuel</Label>
          <Input id="cur-pwd" type="password" autoComplete="current-password" required
            value={cur} onChange={e => setCur(e.target.value)} className="h-12" />
        </div>
        <div>
          <Label htmlFor="new-pwd">Nouveau mot de passe</Label>
          <Input id="new-pwd" type="password" autoComplete="new-password" required minLength={8}
            value={pwd} onChange={e => setPwd(e.target.value)} placeholder="Au moins 8 caractères" className="h-12" />
        </div>
        <div>
          <Label htmlFor="confirm-pwd">Confirmer</Label>
          <Input id="confirm-pwd" type="password" autoComplete="new-password" required minLength={8}
            value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} className="h-12" />
        </div>
        <Button type="submit" variant="outline" disabled={loading} className="h-12 w-full">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Modification…</> : 'Changer le mot de passe'}
        </Button>
      </form>
    </section>
  );
}

function DangerZone({ email, onDeleted, confirm }) {
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState('');
  const [loading, setLoading] = useState(false);

  async function remove(e) {
    e.preventDefault();
    const ok = await confirm({
      title: 'Supprimer définitivement votre compte ?',
      description: 'Tous vos coins, cueillettes, identifications et partages seront effacés. Cette action est irréversible.',
      confirmLabel: 'Supprimer mon compte',
      destructive: true
    });
    if (!ok) return;
    setLoading(true);
    try {
      await api('/auth/account', { method: 'DELETE', body: { password: pwd } });
      toast.success('Compte supprimé');
      onDeleted?.();
    } catch (e) {
      toast.error('Erreur', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-danger-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-danger-700">
        <Trash2 className="h-5 w-5" /> Supprimer le compte
      </h2>
      <p className="mb-4 text-sm text-neutral-600">
        Efface définitivement <span className="font-medium">{email}</span> et toutes vos données.
      </p>
      {!open ? (
        <Button variant="destructive" className="h-12" onClick={() => setOpen(true)}>
          Supprimer mon compte
        </Button>
      ) : (
        <form onSubmit={remove} className="space-y-3">
          <div>
            <Label htmlFor="del-pwd">Confirmez avec votre mot de passe</Label>
            <Input id="del-pwd" type="password" autoComplete="current-password" required
              value={pwd} onChange={e => setPwd(e.target.value)} className="h-12" />
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" className="h-12 flex-1"
              onClick={() => { setOpen(false); setPwd(''); }}>Annuler</Button>
            <Button type="submit" variant="destructive" disabled={loading} className="h-12 flex-1">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />…</> : 'Confirmer'}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
