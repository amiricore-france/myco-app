import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import LegalLinks from '../components/LegalLinks.jsx';

/**
 * Pages légales publiques : /mentions-legales, /cgu, /confidentialite.
 *
 * À METTRE À JOUR si l'un de ces points change :
 *   - éditeur (aujourd'hui : particulier, à titre non professionnel et gratuit) ;
 *   - paiement (Stripe non activé) ;
 *   - identification IA (aujourd'hui : BioCLIP hébergé sur le serveur de Myco ;
 *     si AI_PROVIDER=openai, les photos partent chez OpenAI → section 4 à compléter) ;
 *   - durées de conservation (OUTING_RETENTION_DAYS, DANGER_RETENTION_DAYS…).
 */

export const LEGAL_UPDATED = '24 octobre 2026';
export const CONTACT = 'contact@app-fair.fr';
const Mail = () => <a href={`mailto:${CONTACT}`} className="font-medium text-primary-700 underline">{CONTACT}</a>;


function H2({ children }) {
  return <h2 className="mt-8 text-lg font-semibold text-neutral-900">{children}</h2>;
}
function P({ children }) {
  return <p className="mt-3 leading-relaxed text-neutral-700">{children}</p>;
}
function UL({ children }) {
  return <ul className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed text-neutral-700">{children}</ul>;
}

function MentionsLegales() {
  return (
    <>
      <H2>Éditeur</H2>
      <P>
        Myco (https://myco.app-fair.fr) est un service gratuit édité par un particulier, à titre non
        professionnel. Conformément à l’article 6, III, 2° de la loi n° 2004-575 du 21 juin 2004 pour la
        confiance dans l’économie numérique, ses nom et adresse ont été communiqués à l’hébergeur.
      </P>
      <P>Contact : <Mail /></P>

      <H2>Hébergement</H2>
      <P>
        OVH SAS, 2 rue Kellermann, 59100 Roubaix, France — téléphone : 1007 — https://www.ovhcloud.com.
        Les données sont hébergées en France.
      </P>

      <H2>Cartographie et données tierces</H2>
      <UL>
        <li>Fond de carte : Plan IGN, © IGN / Géoplateforme, Licence Ouverte Etalab 2.0.</li>
        <li>Recherche d’adresse : Nominatim, données © les contributeurs d’OpenStreetMap (licence ODbL).</li>
        <li>Météo des alertes de poussée : Open-Meteo.com (licence CC BY 4.0).</li>
      </UL>

      <H2>Propriété intellectuelle</H2>
      <P>
        Le code, le nom et l’identité visuelle de Myco sont protégés. Les contenus publiés par les
        utilisateurs (photos, notes, signalements) restent leur propriété, dans les conditions prévues
        par les <Link to="/cgu" className="text-primary-700 underline">CGU</Link>.
      </P>

      <H2>Signaler un contenu</H2>
      <P>
        Pour signaler un contenu illicite ou abusif, utilisez le bouton « Abusif » sur le signalement
        concerné ou écrivez à <Mail /> en précisant le contenu et le motif.
      </P>
    </>
  );
}

function CGU() {
  return (
    <>
      <P>
        Les présentes conditions générales d’utilisation (CGU) encadrent l’usage de Myco. En créant un
        compte, vous les acceptez. Si vous ne les acceptez pas, n’utilisez pas le service.
      </P>

      <H2>1. Le service</H2>
      <P>
        Myco est un carnet de cueillette de champignons : enregistrement de coins et de cueillettes,
        aide à l’identification, partage de coins, classement facultatif, cartes utilisables hors-ligne,
        alertes de poussée fondées sur la météo, sorties avec retour au véhicule et suivi par des proches,
        signalement de zones de danger.
      </P>
      <P>
        Myco est gratuit. Les fonctions « Premium » (cartes hors-ligne, alertes de poussée) sont
        offertes à tous pendant la phase de lancement. Si elles deviennent payantes, vous en serez
        informé à l’avance et rien ne vous sera facturé sans votre accord explicite.
      </P>

      <H2>2. Votre compte</H2>
      <UL>
        <li>Myco est réservé aux personnes de 15 ans et plus.</li>
        <li>Vous fournissez une adresse e-mail valide et gardez votre mot de passe confidentiel.</li>
        <li>Vous êtes responsable de l’usage fait de votre compte.</li>
        <li>Vous pouvez supprimer votre compte à tout moment depuis « Mon compte ».</li>
      </UL>

      <H2>3. Sécurité : ce que Myco n’est pas</H2>
      <P><strong>Identification.</strong> L’aide à l’identification est pédagogique et peut se tromper.
        Ne consommez jamais un champignon identifié par une application : faites-le vérifier par un
        pharmacien ou un mycologue. En cas de doute, abstenez-vous. En cas d’intoxication, appelez le 15
        ou un centre antipoison.</P>
      <P><strong>Alertes de poussée.</strong> L’indice est une estimation fondée sur la seule météo. Il
        ne garantit pas la présence de champignons.</P>
      <P><strong>Sortie, suivi et SOS.</strong> Myco n’est pas un service de secours. La position peut
        être imprécise ou ne plus être transmise (absence de réseau, batterie, téléphone en veille,
        limites des applications web). Les proches ne sont prévenus que dans la mesure où le service
        et les réseaux fonctionnent. En cas d’urgence, appelez le 112.</P>
      <P><strong>Signalements de danger.</strong> Ils sont publiés par des utilisateurs et ne sont pas
        vérifiés. L’absence de signalement ne signifie pas l’absence de danger : renseignez-vous sur les
        jours de chasse et respectez la signalisation sur place.</P>
      <P><strong>Cartes.</strong> Les cartes et distances sont indicatives. Préparez vos sorties et
        restez prudent.</P>

      <H2>4. Règles de cueillette</H2>
      <UL>
        <li>Respectez la réglementation locale (arrêtés préfectoraux ou municipaux, quantités autorisées,
          espèces protégées, règles de l’ONF en forêt domaniale).</li>
        <li>Les champignons appartiennent au propriétaire du terrain : ne cueillez pas sur une propriété
          privée sans autorisation.</li>
        <li>Respectez les milieux naturels, les autres usagers et les zones de chasse signalées.</li>
      </UL>

      <H2>5. Vos contenus</H2>
      <P>
        Vous restez propriétaire de vos photos, notes et signalements. Vous autorisez Myco à les
        héberger et à les afficher aux personnes à qui vous les destinez (vous seul par défaut, les
        personnes avec qui vous partagez un coin, ou tous les utilisateurs pour les signalements de
        danger et le classement si vous y participez), pour la seule durée nécessaire au service.
      </P>
      <P>Il est interdit de publier :</P>
      <UL>
        <li>des contenus illicites, injurieux, diffamatoires ou discriminatoires ;</li>
        <li>des données personnelles de tiers (nom, plaque d’immatriculation, photo d’une personne
          reconnaissable…) ;</li>
        <li>de faux signalements, ou des signalements destinés à éloigner d’autres cueilleurs d’un lieu.</li>
      </UL>

      <H2>6. Signalements de danger</H2>
      <UL>
        <li>Signalez de bonne foi, ce que vous avez constaté, à l’endroit où vous l’avez constaté.</li>
        <li>Pour un comportement suspect, décrivez le comportement, jamais l’apparence physique,
          l’origine ou l’identité d’une personne. En cas de danger immédiat, appelez le 17 ou le 112.</li>
        <li>Votre nom n’est jamais affiché. Un signalement est actif le jour même, puis reste visible en
          historique pendant un an.</li>
        <li>Un signalement déclaré abusif par plusieurs utilisateurs est masqué automatiquement.
          Myco peut retirer tout contenu contraire aux CGU.</li>
      </UL>

      <H2>7. Partage et suivi par des proches</H2>
      <P>
        Vous choisissez avec qui vous partagez un coin ou votre position. Avant d’ajouter un proche à
        prévenir, assurez-vous qu’il est d’accord pour recevoir les e-mails de Myco.
      </P>

      <H2>8. Disponibilité et responsabilité</H2>
      <P>
        Myco est fourni gratuitement, en l’état, sans garantie de disponibilité ni d’exactitude. Dans
        les limites permises par la loi, l’éditeur ne peut être tenu responsable des conséquences de
        l’usage du service, notamment d’une identification erronée, d’un signalement inexact ou d’une
        position non transmise.
      </P>

      <H2>9. Suspension</H2>
      <P>
        En cas de manquement grave ou répété aux CGU (faux signalements, contenus illicites,
        détournement du service), le compte concerné peut être suspendu ou supprimé.
      </P>

      <H2>10. Données personnelles</H2>
      <P>
        Leur traitement est décrit dans la <Link to="/confidentialite" className="text-primary-700 underline">politique de confidentialité</Link>.
      </P>

      <H2>11. Évolution des CGU</H2>
      <P>
        Les CGU peuvent évoluer. En cas de changement important, vous en serez informé dans l’application
        ou par e-mail. Continuer à utiliser Myco vaut acceptation de la nouvelle version.
      </P>

      <H2>12. Droit applicable et contact</H2>
      <P>
        Les CGU sont soumises au droit français. Pour toute question ou réclamation : <Mail />. À défaut
        d’accord amiable, les tribunaux compétents seront ceux désignés par la loi.
      </P>
    </>
  );
}

function Confidentialite() {
  return (
    <>
      <P>
        Myco collecte le moins de données possible, ne contient ni publicité ni outil de mesure
        d’audience, et ne vend aucune donnée.
      </P>

      <H2>1. Responsable du traitement</H2>
      <P>L’éditeur de Myco (voir les <Link to="/mentions-legales" className="text-primary-700 underline">mentions légales</Link>), joignable à <Mail />.</P>

      <H2>2. Données traitées, finalités et durées</H2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-300 text-neutral-900">
              <th className="py-2 pr-3 font-semibold">Données</th>
              <th className="py-2 pr-3 font-semibold">Pourquoi</th>
              <th className="py-2 font-semibold">Combien de temps</th>
            </tr>
          </thead>
          <tbody className="align-top text-neutral-700">
            {[
              ['Compte : e-mail, nom (facultatif), mot de passe haché (jamais stocké en clair)', 'Créer et sécuriser votre compte, vous écrire (vérification, mot de passe oublié)', 'Jusqu’à la suppression du compte'],
              ['Coins, cueillettes, photos, notes, identifications', 'Tenir votre carnet', 'Jusqu’à leur suppression ou celle du compte'],
              ['Partages de coins', 'Partager un coin avec la personne de votre choix', 'Jusqu’à la fin du partage ou la suppression du compte'],
              ['Classement (poids cueilli)', 'Podium, uniquement si vous l’activez', 'Tant que l’option est active'],
              ['Sorties : départ, véhicule, trace GPS, dernière position, niveau de batterie', 'Retour au véhicule, suivi par vos proches, alertes en cas de retard ou de silence', 'Trace détaillée supprimée 30 jours après la fin de la sortie ; résumé conservé jusqu’à la suppression du compte'],
              ['Proches à prévenir : nom et e-mail', 'Les prévenir de vos sorties et en cas d’alerte', 'Jusqu’à leur retrait de votre liste ou la suppression du compte'],
              ['Signalements de danger : type, position, commentaire, date', 'Prévenir les autres cueilleurs (sans afficher votre nom)', '1 an, puis suppression ; à la suppression de votre compte, ils deviennent anonymes'],
              ['Préférences d’alerte, abonnements aux notifications', 'Vous envoyer les alertes choisies', 'Jusqu’à leur désactivation ou la suppression du compte'],
              ['Journaux techniques du serveur (adresse IP, pages appelées)', 'Sécurité et bon fonctionnement', 'Quelques semaines (rotation automatique)'],
              ['Messages envoyés à contact@app-fair.fr', 'Vous répondre', 'Le temps nécessaire au traitement de la demande']
            ].map(([d, f, t]) => (
              <tr key={d} className="border-b border-neutral-100">
                <td className="py-2 pr-3">{d}</td><td className="py-2 pr-3">{f}</td><td className="py-2">{t}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <P>
        Bases légales : l’exécution des CGU pour le fonctionnement du service ; votre consentement pour
        les options (classement, notifications, suivi par des proches, partage de position), que vous
        pouvez retirer à tout moment ; l’intérêt légitime pour la sécurité du service et la modération
        des signalements.
      </P>
      <P>
        Vos coins sont privés par défaut. Pour une sortie, le point de départ et l’emplacement du
        véhicule sont enregistrés sur le serveur ; votre trace et votre position en direct n’y sont
        envoyées que si vous activez le partage avec vos proches ou déclenchez un SOS. Le lien de suivi
        cesse de fonctionner 24 heures après la fin de la sortie.
      </P>

      <H2>3. Stockage sur votre appareil</H2>
      <P>
        Myco n’utilise pas de cookies. Il conserve dans votre navigateur votre jeton de connexion, la
        sortie en cours, les cartes téléchargées et les dernières données consultées, pour fonctionner
        hors-ligne. Les cartes et données hors-ligne sont effacées à la déconnexion.
      </P>

      <H2>4. Destinataires</H2>
      <UL>
        <li><strong>OVH</strong> (France) : hébergement du service et envoi des e-mails.</li>
        <li><strong>IGN – Géoplateforme</strong> : votre navigateur télécharge les fonds de carte directement
          auprès de l’IGN, qui reçoit votre adresse IP et la zone affichée.</li>
        <li><strong>Nominatim (OpenStreetMap Foundation)</strong> : reçoit le texte d’une recherche
          d’adresse et votre adresse IP.</li>
        <li><strong>Open-Meteo</strong> : reçoit, depuis notre serveur, des coordonnées arrondies à
          environ 10 km pour calculer les alertes de poussée, sans aucune information sur vous.</li>
        <li><strong>Services de notification</strong> de votre navigateur (Google, Apple, Mozilla ou
          Microsoft) : acheminent les notifications, dont le contenu est chiffré.</li>
        <li><strong>Google (Gmail)</strong> : les messages écrits à contact@app-fair.fr sont reçus dans une
          messagerie Gmail.</li>
        <li><strong>Vos proches</strong> désignés pour une sortie, et les personnes avec qui vous partagez un coin.</li>
      </UL>
      <P>
        L’identification des champignons est réalisée sur le serveur de Myco : vos photos ne sont pas
        transmises à un tiers. Aucun paiement n’est collecté pour le moment.
      </P>
      <P>
        Certains de ces prestataires (services de notification, Gmail) peuvent traiter des données hors
        de l’Union européenne, dans le cadre des garanties prévues par le RGPD (décision d’adéquation ou
        clauses contractuelles types).
      </P>

      <H2>5. Sécurité</H2>
      <P>
        Connexions chiffrées (HTTPS), mots de passe hachés, accès aux données limité
        à votre compte, liens de partage et de suivi non devinables.
      </P>

      <H2>6. Vos droits</H2>
      <P>
        Vous disposez d’un droit d’accès, de rectification, d’effacement, de limitation, d’opposition et
        de portabilité de vos données. Vous pouvez corriger votre profil et supprimer votre compte depuis
        « Mon compte » ; pour toute autre demande, écrivez à <Mail />. Réponse sous un mois au plus.
      </P>
      <P>
        Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la
        CNIL (www.cnil.fr).
      </P>
    </>
  );
}

const PAGES = {
  '/mentions-legales': { title: 'Mentions légales', Body: MentionsLegales },
  '/cgu': { title: 'Conditions générales d’utilisation', Body: CGU },
  '/confidentialite': { title: 'Politique de confidentialité', Body: Confidentialite }
};


export default function Legal() {
  const { pathname } = useLocation();
  const page = PAGES[pathname] || PAGES['/cgu'];
  const { Body } = page;
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold hover:no-underline">
          <span className="text-2xl">🍄</span> Myco
        </Link>
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-primary-700">
          <ArrowLeft className="h-4 w-4" />Retour
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16">
        <article className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{page.title}</h1>
          <p className="mt-1 text-sm text-neutral-500">Dernière mise à jour : {LEGAL_UPDATED}</p>
          <Body />
        </article>
        <LegalLinks className="mt-6 text-center text-xs text-neutral-500" />
      </main>
    </div>
  );
}
