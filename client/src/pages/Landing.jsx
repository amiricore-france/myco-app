import { Link } from 'react-router-dom';
import { MapPin, Camera, Share2, Trophy, ShieldCheck, Smartphone, WifiOff, BellRing, Mail } from 'lucide-react';
import { Button } from '../components/ui/button';

const CONTACT_EMAIL = 'contact@app-fair.fr';

const FEATURES = [
  { icon: WifiOff, premium: true, title: 'Cartes IGN hors-ligne', text: 'Téléchargez le Plan IGN autour de vos coins et retrouvez-les en forêt, même sans réseau.' },
  { icon: BellRing, premium: true, title: 'Alertes de poussée', text: 'Pluie, températures, gel : Myco surveille la météo de vos coins et vous prévient quand ça devient favorable.' },
  { icon: MapPin, title: 'Vos coins sur la carte', text: 'Enregistrez vos coins à champignons avec leur position, une zone et des notes privées.' },
  { icon: Camera, title: 'Aide à l\'identification', text: 'Prenez une photo : Myco propose des pistes à titre pédagogique, jamais une garantie de comestibilité.' },
  { icon: Share2, title: 'Partage entre confiance', text: 'Partagez un coin avec une personne précise, acceptez ou refusez ce qu\'on vous propose.' },
  { icon: Trophy, title: 'Suivi et podium', text: 'Historique de vos cueillettes, statistiques par espèce et classement optionnel.' },
  { icon: Smartphone, title: 'Pensé pour le terrain', text: 'S’installe sur l’écran d’accueil du téléphone pour consulter et saisir vos trouvailles en forêt.' },
  { icon: ShieldCheck, title: 'Vos données vous appartiennent', text: 'Coins privés par défaut. Vous choisissez ce que vous partagez, et avec qui.' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* En-tête */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2 text-lg font-bold">
          <span className="text-2xl">🍄</span> Myco
        </div>
        <Link to="/login">
          <Button variant="outline" size="sm">Connexion</Button>
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 pb-10 pt-8 text-center sm:pt-16">
        <div className="mb-6 text-6xl sm:text-7xl">🍄</div>
        <h1 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">
          Vos coins à champignons, cartographiés et partagés
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-neutral-600 sm:text-lg">
          Myco vous aide à repérer, suivre et partager vos coins de cueillette : cartes IGN
          utilisables hors-ligne, alertes quand la météo devient favorable, aide à
          l'identification et historique de vos trouvailles.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/login" className="w-full sm:w-auto">
            <Button size="xl" className="w-full sm:w-auto">Créer un compte gratuit</Button>
          </Link>
          <Link to="/login" className="w-full sm:w-auto">
            <Button size="xl" variant="outline" className="w-full sm:w-auto">J'ai déjà un compte</Button>
          </Link>
        </div>
      </section>

      {/* Avertissement sécurité */}
      <section className="mx-auto max-w-3xl px-4 pb-10">
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-4 text-center text-sm text-danger-900">
          ⚠️ Myco est un outil de repérage et d'aide pédagogique. Ne consommez jamais un
          champignon identifié uniquement par une application : faites-le vérifier par un
          pharmacien ou un mycologue. En cas de doute, abstenez-vous. Les alertes de poussée
          sont une indication météo, pas une garantie.
        </div>
      </section>

      {/* Fonctionnalités */}
      <section className="mx-auto max-w-5xl px-4 pb-16">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text, premium }) => (
            <div key={title}
              className={`rounded-xl border bg-white p-5 shadow-sm ${premium ? 'border-primary-300 ring-1 ring-primary-100' : 'border-neutral-200'}`}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                  <Icon className="h-5 w-5" />
                </div>
                {premium && (
                  <span className="rounded-sm bg-primary-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    Premium
                  </span>
                )}
              </div>
              <h3 className="text-base font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-neutral-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Premium offert au lancement */}
      <section className="mx-auto -mt-8 max-w-5xl px-4 pb-16">
        <p className="rounded-xl bg-primary-50 p-4 text-center text-sm text-primary-900">
          <strong>Premium offert pendant le lancement :</strong> cartes hors-ligne et alertes de
          poussée sont accessibles gratuitement à tous les comptes.
        </p>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-3xl px-4 pb-20 text-center">
        <h2 className="text-2xl font-bold sm:text-3xl">Prêt à cartographier vos coins ?</h2>
        <p className="mx-auto mt-3 max-w-lg text-neutral-600">
          Rejoignez Myco et gardez la mémoire de vos meilleures cueillettes.
        </p>
        <Link to="/login" className="mt-6 inline-block">
          <Button size="xl">Commencer maintenant</Button>
        </Link>
      </section>

      {/* Contact */}
      <section className="mx-auto max-w-3xl px-4 pb-16 text-center">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Une question, une idée, un souci ?</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-neutral-600">
            Écrivez-nous, chaque message est lu.
          </p>
          <a href={`mailto:${CONTACT_EMAIL}?subject=Myco`}
            className="mt-4 inline-flex h-11 items-center gap-2 rounded-md border border-neutral-300 px-4 text-sm font-medium text-neutral-900 hover:bg-neutral-50">
            <Mail className="h-4 w-4 text-primary-600" />{CONTACT_EMAIL}
          </a>
        </div>
      </section>

      <footer className="border-t border-neutral-200 py-6 text-center text-xs text-neutral-500">
        Myco — © {new Date().getFullYear()}. Cueillez responsable.
        <span className="mx-2" aria-hidden>·</span>
        <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-primary-700 hover:underline">Contact</a>
        <span className="mx-2" aria-hidden>·</span>
        Fond de carte © IGN / Géoplateforme
      </footer>
    </div>
  );
}
