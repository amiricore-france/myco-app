import { useEffect, useMemo, useState } from 'react';
import {
  Car, Flag, Loader2, LocateFixed, Share2, Sun, Siren, CircleCheck, Timer,
  WifiOff, TriangleAlert, Phone, X, Info, RefreshCw
} from 'lucide-react';
import { api } from '../api.js';
import {
  useOuting, startOuting, getPosition, setCar, setExpectedReturn, setShareLive,
  sos, cancelSos, endOuting, setKeepAwake, wakeLockSupported, followUrl, dismissNotice, sync
} from '../lib/outing.js';
import { formatClock, formatDistance, formatDuration, trackLength, ago } from '../lib/geo.js';
import { useHeading } from '../hooks/useHeading.js';
import { useConfirm } from '../hooks/useConfirm.jsx';
import { toast } from '../lib/toast-store';
import PageHeader from '../components/PageHeader.jsx';
import OutingMap from '../components/outing/OutingMap.jsx';
import ReturnCompass from '../components/outing/ReturnCompass.jsx';
import ContactsManager from '../components/outing/ContactsManager.jsx';
import DangerLayer from '../components/dangers/DangerLayer.jsx';
import ReportDangerDialog from '../components/dangers/ReportDangerDialog.jsx';
import { useNearbyDangers, updateToday, removeToday } from '../lib/dangers.js';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------
function defaultReturnTime() {
  const d = new Date(Date.now() + 3 * 3600e3);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
/** « 17:30 » → prochaine occurrence (aujourd'hui ou demain), en ISO. */
function timeToIso(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d.getTime() <= Date.now() + 60e3) d.setDate(d.getDate() + 1);
  return d.toISOString();
}
function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  return d.toDateString() === today.toDateString() ? 'aujourd’hui' : 'demain';
}

async function shareLink(url, name) {
  const text = `Je pars aux champignons. Tu peux suivre ma position en direct ici :`;
  if (navigator.share) {
    try { await navigator.share({ title: 'Ma sortie Myco', text, url }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast.success('Lien copié', 'Collez-le dans un SMS ou un message.');
  } catch {
    window.prompt('Copiez ce lien :', url);
  }
}

function Toggle({ id, checked, onChange, label, hint }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 py-2">
      <input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 flex-shrink-0 accent-primary-600" />
      <span>
        <span className="block text-sm font-medium text-neutral-900">{label}</span>
        {hint && <span className="block text-xs text-neutral-500">{hint}</span>}
      </span>
    </label>
  );
}

function Section({ title, step, children }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-neutral-900">
        <span className="text-mono-num flex h-6 w-6 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700">{step}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Préparation
// ---------------------------------------------------------------------------
function Setup() {
  const [pos, setPos] = useState(null);
  const [posError, setPosError] = useState('');
  const [locating, setLocating] = useState(true);
  const [carHere, setCarHere] = useState(true);
  const [returnTime, setReturnTime] = useState(defaultReturnTime);
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [shareLive, setShare] = useState(true);
  const [alertSilence, setAlertSilence] = useState(true);
  const [starting, setStarting] = useState(false);

  async function locate() {
    setLocating(true); setPosError('');
    try { setPos(await getPosition()); }
    catch (e) { setPosError(e.message); }
    finally { setLocating(false); }
  }

  useEffect(() => {
    locate();
    api('/outings/contacts').then(cs => { setContacts(cs); setSelected(cs.map(c => c.id)); }).catch(() => {});
  }, []);

  const returnIso = useMemo(() => timeToIso(returnTime), [returnTime]);

  function bump(hours) {
    const d = new Date(Date.now() + hours * 3600e3);
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    setReturnTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
  }

  async function start() {
    setStarting(true);
    try {
      await startOuting({
        start: pos,
        car: carHere && pos ? pos : null,
        expectedReturnAt: returnIso,
        contactIds: selected,
        contacts: contacts.filter(c => selected.includes(c.id)),
        shareLive,
        alertOnSilence: alertSilence
      });
      toast.success('Bonne cueillette !', selected.length ? 'Vos proches ont reçu le lien de suivi.' : 'Votre trace est enregistrée.');
    } finally { setStarting(false); }
  }

  return (
    <div className="space-y-4">
      <Section step="1" title="Point de départ">
        {locating ? (
          <p className="flex items-center gap-2 text-sm text-neutral-600"><Loader2 className="h-4 w-4 animate-spin" /> Recherche de votre position…</p>
        ) : pos ? (
          <p className="flex items-center gap-2 text-sm text-neutral-700">
            <LocateFixed className="h-4 w-4 text-primary-600" />
            Position trouvée <span className="text-mono-num text-neutral-500">(± {pos.accuracy} m)</span>
            <button type="button" onClick={locate} className="ml-auto inline-flex items-center gap-1 text-xs text-primary-700 hover:underline">
              <RefreshCw className="h-3.5 w-3.5" /> Actualiser
            </button>
          </p>
        ) : (
          <div className="rounded-md border border-danger-200 bg-danger-50 p-3 text-sm text-danger-900">
            {posError}
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={locate}>Réessayer</Button>
          </div>
        )}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[[true, '🚗', 'Mon véhicule est garé ici'], [false, '🚶', 'Pas de véhicule ici (je le placerai plus tard)']].map(([v, emoji, label]) => (
            <button key={String(v)} type="button" onClick={() => setCarHere(v)}
              className={cn('flex min-h-[52px] items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                carHere === v ? 'border-primary-600 bg-primary-50 text-primary-900' : 'border-neutral-200 hover:bg-neutral-50')}>
              <span className="text-xl">{emoji}</span>{label}
            </button>
          ))}
        </div>
        {pos && pos.accuracy > 50 && carHere && (
          <p className="mt-2 text-xs text-warning-700">Précision moyenne : vous pourrez déplacer le véhicule sur la carte.</p>
        )}
      </Section>

      <Section step="2" title="Heure de retour prévue">
        <div className="flex flex-wrap items-center gap-2">
          <input type="time" value={returnTime} onChange={e => setReturnTime(e.target.value)}
            className="text-mono-num h-11 rounded-md border border-neutral-300 px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600" />
          {[2, 3, 4].map(h => (
            <Button key={h} type="button" variant="secondary" className="h-11" onClick={() => bump(h)}>+{h} h</Button>
          ))}
        </div>
        {returnIso && (
          <p className="mt-2 text-sm text-neutral-600">
            Retour {dayLabel(returnIso)} à <strong>{formatClock(returnIso)}</strong>. Vous recevrez un rappel à cette heure ;
            sans réponse 30 min plus tard, vos proches seront alertés.
          </p>
        )}
      </Section>

      <Section step="3" title="Proches à prévenir">
        <ContactsManager contacts={contacts} setContacts={setContacts} selected={selected} setSelected={setSelected} />
        <div className="mt-3 border-t border-neutral-100 pt-2">
          <Toggle id="share-live" checked={shareLive} onChange={setShare}
            label="Partager ma position en direct"
            hint={shareLive ? 'Vos proches voient votre trace sur un lien privé.' : 'Seul le point de départ sera communiqué en cas d’alerte.'} />
          {shareLive && (
            <Toggle id="alert-silence" checked={alertSilence} onChange={setAlertSilence}
              label="Prévenir mes proches si ma position n’arrive plus pendant 1 h"
              hint="Message rassurant : c’est souvent juste l’absence de réseau." />
          )}
        </div>
      </Section>

      <div className="flex gap-3 rounded-lg border border-info-200 bg-info-50 p-3 text-sm text-info-900">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p>
          Gardez Myco ouvert pendant la sortie : écran éteint, le téléphone met la localisation en pause.
          Le retour au véhicule fonctionne sans réseau ; pensez à télécharger la carte de la zone.
        </p>
      </div>

      <Button type="button" size="xl" className="w-full" onClick={start} disabled={starting || locating}>
        {starting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Flag className="h-5 w-5" />}
        Démarrer la sortie
      </Button>
      {!pos && !locating && (
        <p className="text-center text-xs text-neutral-500">Sans position, la trace commencera dès que le GPS répondra.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sortie en cours
// ---------------------------------------------------------------------------
function Active({ snap }) {
  const o = snap.outing;
  const confirm = useConfirm();
  const { heading, needsPermission, requestPermission } = useHeading();
  const [target, setTarget] = useState(o.car ? 'car' : 'start');
  const [reportOpen, setReportOpen] = useState(false);
  const dangers = useNearbyDangers();
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(x => x + 1), 30000); return () => clearInterval(t); }, []);

  const here = snap.current || o.track[o.track.length - 1] || null;
  const goalIsCar = !!o.car && (target === 'car' || !o.start);
  const goal = goalIsCar ? o.car : o.start;
  const now = Date.now();
  const overdue = o.expectedReturnAt && new Date(o.expectedReturnAt).getTime() < now;
  const length = trackLength(o.track);
  const link = followUrl(o);

  async function parkHere() {
    if (!snap.current) return toast.warning('Position indisponible', 'Attendez le signal GPS.');
    if (o.car && !(await confirm({ title: 'Déplacer le véhicule ici ?', description: 'La position actuelle remplacera celle enregistrée.', confirmLabel: 'Déplacer', destructive: false }))) return;
    setCar(snap.current);
    setTarget('car');
    toast.success('Véhicule enregistré');
  }

  async function moveCar(p) {
    if (await confirm({ title: 'Déplacer le véhicule ?', description: 'Le véhicule sera placé à l’endroit où vous avez lâché le marqueur.', confirmLabel: 'Déplacer', destructive: false })) {
      setCar(p);
    } else {
      setCar(o.car); // repositionne le marqueur
    }
  }

  function extend(hours) {
    const base = Math.max(Date.now(), o.expectedReturnAt ? new Date(o.expectedReturnAt).getTime() : 0);
    const iso = new Date(base + hours * 3600e3).toISOString();
    setExpectedReturn(iso);
    toast.success(`Retour prévu à ${formatClock(iso)}`);
  }

  async function triggerSos() {
    const ok = await confirm({
      title: 'Envoyer un appel à l’aide ?',
      description: o.contacts?.length
        ? `${o.contacts.map(c => c.name).join(', ')} recevr${o.contacts.length > 1 ? 'ont' : 'a'} immédiatement votre position. En cas de danger immédiat, appelez aussi le 112.`
        : 'Aucun proche n’est désigné pour cette sortie : appelez le 112 en cas de danger.',
      confirmLabel: 'Envoyer l’alerte'
    });
    if (ok) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      await sos();
    }
  }

  async function finish() {
    const ok = await confirm({
      title: 'Terminer la sortie ?',
      description: o.contacts?.length ? 'Vos proches seront prévenus que vous êtes bien rentré(e).' : 'La trace ne sera plus enregistrée.',
      confirmLabel: 'Je suis rentré(e)',
      destructive: false
    });
    if (ok) await endOuting();
  }

  // Fin demandée hors-ligne : en attente d'envoi
  if (o.endedLocal) {
    return (
      <div className="rounded-lg border border-warning-200 bg-warning-50 p-5 text-warning-900">
        <p className="flex items-center gap-2 font-semibold"><WifiOff className="h-5 w-5" /> Fin de sortie en attente de réseau</p>
        <p className="mt-2 text-sm">
          Votre retour sera signalé à vos proches dès que le téléphone retrouvera du réseau.
          Laissez Myco ouvert quelques instants une fois à portée de réseau.
        </p>
        <Button type="button" variant="outline" className="mt-3" onClick={sync} disabled={snap.syncing}>
          {snap.syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Réessayer maintenant
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {o.sosAt && (
        <div role="alert" className="rounded-lg border-2 border-danger-600 bg-danger-50 p-4 text-danger-900">
          <p className="flex items-center gap-2 text-lg font-bold"><Siren className="h-5 w-5" /> Appel à l’aide {o.sosSent ? 'envoyé' : 'en attente de réseau'}</p>
          <p className="mt-1 text-sm">
            {o.sosSent
              ? `Vos proches ont reçu votre position (${formatClock(o.sosAt)}). Restez où vous êtes si possible.`
              : 'Pas de réseau data : l’alerte partira dès que possible. Un appel au 112 passe souvent même sans réseau de votre opérateur.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild variant="destructive" size="lg"><a href="tel:112"><Phone className="h-4 w-4" /> Appeler le 112</a></Button>
            <Button type="button" variant="outline" size="lg" onClick={cancelSos}><X className="h-4 w-4" /> Annuler l’alerte</Button>
          </div>
        </div>
      )}

      {overdue && !o.sosAt && (
        <div className="rounded-lg border border-warning-300 bg-warning-50 p-4 text-warning-900">
          <p className="flex items-center gap-2 font-semibold"><TriangleAlert className="h-5 w-5" /> Heure de retour dépassée ({formatClock(o.expectedReturnAt)})</p>
          <p className="mt-1 text-sm">Sans nouvelles de votre part, vos proches seront alertés {formatClock(new Date(new Date(o.expectedReturnAt).getTime() + 30 * 60e3).toISOString())}.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="lg" onClick={() => extend(1)}><Timer className="h-4 w-4" /> Prolonger d’1 h</Button>
            <Button type="button" variant="outline" size="lg" onClick={finish}><CircleCheck className="h-4 w-4" /> Je suis rentré(e)</Button>
          </div>
        </div>
      )}

      {snap.geoError && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-900">{snap.geoError}</div>
      )}

      {/* Retour */}
      {(o.car || o.start) && (
        <div>
          {o.car && o.start && (
            <div className="mb-2 inline-flex rounded-md border border-neutral-200 bg-white p-1" role="tablist">
              {[['car', '🚗 Véhicule'], ['start', '🏁 Départ']].map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={target === k} onClick={() => setTarget(k)}
                  className={cn('min-h-[40px] rounded px-4 text-sm font-medium', target === k ? 'bg-primary-600 text-white' : 'text-neutral-600 hover:bg-neutral-100')}>
                  {l}
                </button>
              ))}
            </div>
          )}
          <ReturnCompass
            from={here} target={goal}
            targetLabel={goalIsCar ? 'Votre véhicule est à' : 'Votre point de départ est à'}
            heading={heading} needsPermission={needsPermission} onRequestPermission={requestPermission} />
        </div>
      )}

      <OutingMap
        track={o.track} start={o.start} car={o.car} current={snap.current}
        onCarMove={moveCar} followCurrent className="h-[340px] sm:h-[440px]">
        <DangerLayer reports={dangers.today.filter(r => r.active)}
          onChanged={r => (r?.removed ? removeToday(r.id) : updateToday(r))} />
      </OutingMap>

      <Button type="button" variant="outline" onClick={() => setReportOpen(true)}
        className="h-12 w-full border-danger-200 text-danger-700 hover:bg-danger-50">
        <TriangleAlert className="h-4 w-4" />Signaler un danger (chasse, travaux…)
      </Button>
      <ReportDangerDialog open={reportOpen} onOpenChange={setReportOpen}
        initialPosition={snap.current ? { lat: snap.current.lat, lng: snap.current.lng, accuracy: snap.current.accuracy } : null} />

      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          ['Durée', formatDuration(now - new Date(o.startedAt).getTime())],
          ['Parcouru', formatDistance(length)],
          ['Retour prévu', o.expectedReturnAt ? formatClock(o.expectedReturnAt) : '—']
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-neutral-200 bg-white px-2 py-3">
            <dt className="text-xs text-neutral-500">{k}</dt>
            <dd className={cn('text-mono-num text-lg font-semibold', k === 'Retour prévu' && overdue ? 'text-warning-700' : 'text-neutral-900')}>{v}</dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="lg" onClick={parkHere} className="h-auto min-h-[52px] whitespace-normal py-2">
          <Car className="h-4 w-4 flex-shrink-0" /> {o.car ? 'Véhicule ici' : 'Garer ici'}
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={() => extend(1)} className="h-auto min-h-[52px] whitespace-normal py-2">
          <Timer className="h-4 w-4 flex-shrink-0" /> +1 h
        </Button>
        <Button type="button" variant="outline" size="lg" disabled={!link} onClick={() => shareLink(link)} className="h-auto min-h-[52px] whitespace-normal py-2">
          <Share2 className="h-4 w-4 flex-shrink-0" /> {link ? 'Partager' : 'Lien en attente…'}
        </Button>
        {wakeLockSupported() ? (
          <Button type="button" variant={snap.keepAwake ? 'default' : 'outline'} size="lg" onClick={() => setKeepAwake(!snap.keepAwake)} className="h-auto min-h-[52px] whitespace-normal py-2">
            <Sun className="h-4 w-4 flex-shrink-0" /> {snap.keepAwake ? 'Écran maintenu ✓' : 'Écran actif'}
          </Button>
        ) : (
          <Button type="button" variant={o.shareLive ? 'outline' : 'secondary'} size="lg" onClick={() => setShareLive(!o.shareLive)} className="h-auto min-h-[52px] whitespace-normal py-2">
            <Share2 className="h-4 w-4 flex-shrink-0" /> {o.shareLive ? 'Partage actif' : 'Partage coupé'}
          </Button>
        )}
      </div>

      <SyncStatus snap={snap} />

      <div className="grid gap-2 sm:grid-cols-2">
        {!o.sosAt && (
          <Button type="button" variant="destructive" size="xl" onClick={triggerSos}>
            <Siren className="h-5 w-5" /> Appel à l’aide
          </Button>
        )}
        <Button type="button" size="xl" onClick={finish} className={o.sosAt ? 'sm:col-span-2' : ''}>
          <CircleCheck className="h-5 w-5" /> Je suis rentré(e)
        </Button>
      </div>
    </div>
  );
}

function SyncStatus({ snap }) {
  const o = snap.outing;
  let text, tone = 'text-neutral-500';
  if (!o.shareLive) {
    text = 'Partage de position coupé : trace enregistrée sur ce téléphone uniquement.';
  } else if (!snap.online) {
    text = `Hors réseau : ${snap.pendingPoints} position(s) en attente d’envoi.`; tone = 'text-warning-700';
  } else if (!o.serverId) {
    text = 'Envoi de la sortie au serveur…';
  } else if (snap.lastError) {
    text = `Envoi en échec (${snap.lastError}). Nouvel essai dans une minute.`; tone = 'text-warning-700';
  } else {
    text = `Position transmise ${ago(snap.lastSyncAt)}.`;
  }
  const followers = o.contacts?.length ? ` · Suivi par ${o.contacts.map(c => c.name).join(', ')}` : '';
  return <p className={cn('text-center text-xs', tone)}>{text}{followers}</p>;
}

// ---------------------------------------------------------------------------
export default function Sortie() {
  const snap = useOuting();
  return (
    <div className="container-page">
      <PageHeader
        title={snap.outing ? 'Sortie en cours' : 'Nouvelle sortie'}
        subtitle={snap.outing
          ? `Depuis ${formatClock(snap.outing.startedAt)}`
          : 'Enregistrez votre véhicule, gardez la trace du chemin, et laissez vos proches vous suivre.'}
      />
      {snap.notice && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-primary-200 bg-primary-50 p-3 text-sm text-primary-900">
          <CircleCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p className="flex-1">{snap.notice}</p>
          <button type="button" onClick={dismissNotice} aria-label="Fermer"><X className="h-4 w-4" /></button>
        </div>
      )}
      {snap.outing ? <Active snap={snap} /> : <Setup />}
    </div>
  );
}
