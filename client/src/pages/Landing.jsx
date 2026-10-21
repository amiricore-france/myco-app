import { Link } from 'react-router-dom';
import { MapPin, Camera, Share2, Trophy, ShieldCheck, Smartphone } from 'lucide-react';
import { Button } from '../components/ui/button';

const FEATURES = [
  { icon: MapPin, title: 'Vos coins sur la carte', text: 'Enregistrez vos coins à champignons avec leur position, une zone et des notes privées.' },
  { icon: Camera, title: 'Aide à l\'identification', text: 'Prenez une photo : Myco propose des pistes à titre pédagogique, jamais une garantie de comestibilité.' },
  { icon: Share2, title: 'Partage entre confiance', text: 'Partagez un coin avec une personne précise, acceptez ou refusez ce qu\'on vous propose.' },
  { icon: Trophy, title: 'Suivi et podium', text: 'Historique de vos cueillettes, statistiques par espèce et classement optionnel.' },
  { icon: Smartphone, title: 'Pensé pour le terrain', text: 'Interface mobile pour consulter et saisir vos trouvailles directement en forêt.' },
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
          Myco vous aide à repérer, suivre et partager vos coins de cueillette, avec une aide
          à l'identification et un historique de vos trouvailles.
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
          champignon identifié uniquement par une application. En cas de doute, abstenez-vous.
        </div>
      </section>

      {/* Fonctionnalités */}
      <section className="mx-auto max-w-5xl px-4 pb-16">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-neutral-600">{text}</p>
            </div>
          ))}
        </div>
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

      <footer className="border-t border-neutral-200 py-6 text-center text-xs text-neutral-400">
        Myco — © {new Date().getFullYear()}. Cueillez responsable.
      </footer>
    </div>
  );
}
